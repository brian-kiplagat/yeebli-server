import { eq } from 'drizzle-orm';
import type { Context } from 'hono';

import { type DatabaseError, db, DB_ERRORS } from '../../lib/database.js';
import { encrypt, verify } from '../../lib/encryption.js';
import env from '../../lib/env.js';
import { encode, type JWTPayload } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.ts';
import type { UserRepository } from '../../repository/user.js';
import { userSchema } from '../../schema/schema.ts';
import type { AssetService } from '../../service/asset.js';
import type { BusinessService } from '../../service/business.js';
import type { S3Service } from '../../service/s3.js';
import type { UserService } from '../../service/user.js';
import sendWelcomeEmailAsync from '../../task/client/sendWelcomeEmailAsync.js';
import { sendTransactionalEmail } from '../../task/sendWelcomeEmail.ts';
import { getContentType } from '../../util/string.ts';
import type {
  EmailVerificationBody,
  InAppResetPasswordBody,
  LoginBody,
  RegisterTokenBody,
  RegistrationBody,
  RequestResetPasswordBody,
  ResetPasswordBody,
  UpdateUserDetailsBody,
} from '../validator/user.js';
import { ERRORS, MAIL_CONTENT, serveBadRequest, serveInternalServerError } from './resp/error.js';
import { serveData } from './resp/resp.js';
import { serializeUser } from './serializer/user.js';

export class AuthController {
  private service: UserService;
  private businessService: BusinessService;
  private s3Service: S3Service;
  private assetService: AssetService;
  private userRepository: UserRepository;

  constructor(
    userService: UserService,
    businessService: BusinessService,
    s3Service: S3Service,
    assetService: AssetService,
    userRepository: UserRepository,
  ) {
    this.service = userService;
    this.businessService = businessService;
    this.s3Service = s3Service;
    this.assetService = assetService;
    this.userRepository = userRepository;
  }

  /**
   * Authenticates a user with email and password
   * @param {Context} c - The Hono context containing login credentials
   * @returns {Promise<Response>} Response containing JWT token and user data
   * @throws {Error} When authentication fails
   */
  public login = async (c: Context) => {
    try {
      const body: LoginBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Invalid email, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      const isVerified = verify(body.password, user.password);
      if (!isVerified) {
        return c.json(
          {
            success: false,
            message: 'Invalid password, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }

      const token = await encode(user.id, user.email);
      const serializedUser = await serializeUser(user);
      return serveData(c, { token, user: serializedUser });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Registers a new user in the system
   * @param {Context} c - The Hono context containing registration data
   * @returns {Promise<Response>} Response containing JWT token and user data
   * @throws {Error} When registration fails or user already exists
   */
  public register = async (c: Context) => {
    const body: RegistrationBody = await c.req.json();
    try {
      await this.service.create(body.name, body.email, body.password, 'host', body.phone);
    } catch (err) {
      const e = err as DatabaseError;
      if (e.code === DB_ERRORS.DUPLICATE_KEY) {
        return serveBadRequest(c, ERRORS.USER_EXISTS);
      }
      return serveInternalServerError(c, err);
    }
    const user = await this.service.findByEmail(body.email);
    if (!user) {
      return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
    }

    await sendWelcomeEmailAsync(user.id);

    const token = await encode(user.id, user.email);
    const serializedUser = await serializeUser(user);
    return serveData(c, { token, user: serializedUser });
  };

  /**
   * Sends a verification token to user's email
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating success or failure of token sending
   * @throws {Error} When token generation or email sending fails
   */
  public sendToken = async (c: Context) => {
    try {
      const body: EmailVerificationBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Invalid email, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      //6 digint random number
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await db.update(userSchema).set({ email_token: token }).where(eq(userSchema.id, user.id));

      await sendTransactionalEmail(user.email, user.name, 1, {
        subject: 'Your code',
        title: 'Thanks for signing up',
        subtitle: `${token}`,
        body: `Welcome to Yeebli. Your code code is ${token}`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      return serveData(c, {
        success: true,
        message: 'Email token sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Verifies the registration token sent to user's email
   * @param {Context} c - The Hono context containing token and user ID
   * @returns {Promise<Response>} Response indicating verification status
   * @throws {Error} When token verification fails
   */
  public verifyRegistrationToken = async (c: Context) => {
    try {
      const body: RegisterTokenBody = await c.req.json();
      const user = await this.service.find(body.id);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Ops, could not verify account, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      if (user.email_token !== String(body.token)) {
        return c.json(
          {
            success: false,
            message: 'Ops, wrong code, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      await this.service.update(user.id, { is_verified: true });
      return serveData(c, {
        success: true,
        message: 'Email verified successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Initiates password reset process by sending reset token
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating reset link sent status
   * @throws {Error} When reset token generation or email sending fails
   */
  public requestResetPassword = async (c: Context) => {
    try {
      const body: RequestResetPasswordBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await db.update(userSchema).set({ reset_token: token }).where(eq(userSchema.id, user.id));
      await sendTransactionalEmail(user.email, user.name, 1, {
        subject: 'Reset password',
        title: 'Reset password',
        subtitle: `${token}`,
        body: `Please click this link to reset your password: ${env.FRONTEND_URL}/onboarding/reset?token=${token}&email=${user.email}`,
        buttonText: 'Reset password',
        buttonLink: `${env.FRONTEND_URL}/onboarding/reset?token=${token}&email=${user.email}`,
      });
      return serveData(c, {
        success: true,
        message: 'Reset password link sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.service.findByEmail(email);
    return user;
  };

  /**
   * Resets user's password using token sent via email
   * @param {Context} c - The Hono context containing new password and token
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPassword = async (c: Context) => {
    try {
      const body: ResetPasswordBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (user.reset_token !== String(body.token)) {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      const hashedPassword = encrypt(body.password);
      await this.service.update(user.id, { password: hashedPassword });
      await db.update(userSchema).set({ reset_token: null }).where(eq(userSchema.id, user.id));
      await sendTransactionalEmail(user.email, user.name, 1, {
        subject: 'Password reset',
        title: 'Password reset',
        subtitle: `Your password has been reset successfully`,
        body: `Your password has been reset successfully. If this was not you, please contact support. Thanks again for using Yeebli!`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });
      return serveData(c, {
        success: true,
        message: 'Password reset successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Resets user's password while logged in
   * @param {Context} c - The Hono context containing new password
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPasswordInApp = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InAppResetPasswordBody = await c.req.json();

      // Verify old password
      const isOldPasswordValid = verify(body.oldPassword, user.password);
      if (!isOldPasswordValid) {
        return serveBadRequest(c, ERRORS.AUTH_INVALID_PASSWORD);
      }
      const hashedPassword = encrypt(body.newPassword);
      // Update password
      await this.service.update(user.id, { password: hashedPassword });

      // Send confirmation email
      await sendTransactionalEmail(user.email, user.name, 1, MAIL_CONTENT.PASSWORD_CHANGED_IN_APP);

      return serveData(c, {
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves current user's profile information
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing user profile data
   * @throws {Error} When profile retrieval fails
   */
  public me = async (c: Context) => {
    const payload: JWTPayload = c.get('jwtPayload');
    const user = await this.service.findByEmail(payload.email as string);
    if (!user) {
      return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
    }

    const serializedUser = await serializeUser(user);
    return serveData(c, { user: serializedUser });
  };

  /**
   * Updates user's profile details
   * @param {Context} c - The Hono context containing updated user information
   * @returns {Promise<Response>} Response containing updated user data
   * @throws {Error} When profile update fails
   */
  public updateUserDetails = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: UpdateUserDetailsBody = await c.req.json();

      // If email is being changed, check if it's already taken
      if (body.email && body.email !== user.email) {
        const existingUser = await this.service.findByEmail(body.email);
        if (existingUser) {
          return serveBadRequest(c, ERRORS.USER_EXISTS);
        }
      }

      //if updating the profile image, check if the image is valid
      if (body.imageBase64 && body.fileName) {
        const { imageBase64, fileName } = body;

        // Convert base64 to buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create asset using AssetService
        const { asset: assetId } = await this.assetService.createAsset(
          user.id,
          fileName.replace(/[^\w.-]/g, ''),
          getContentType(imageBase64),
          'profile_picture',
          buffer.length,
          0,
          buffer,
        );

        // Get the full asset object to access the URL
        const asset = await this.assetService.getAsset(assetId);
        if (!asset || !asset.asset_url) {
          return serveInternalServerError(c, new Error('Failed to get asset URL'));
        }

        // Update user profile image with the asset URL
        await this.service.updateProfileImage(user.id, asset.asset_url);
      }

      // Update user details
      await this.service.update(user.id, {
        ...(body.name && { name: body.name }),
        ...(body.phone && { phone: body.phone }),
        ...(body.email && { email: body.email }),
      });

      // Get updated user
      const updatedUser = await this.service.find(user.id);
      if (!updatedUser) {
        return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
      }

      const serializedUser = await serializeUser(updatedUser);
      return serveData(c, {
        success: true,
        message: 'User details updated successfully',
        user: serializedUser,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
