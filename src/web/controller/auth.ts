import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { DB_ERRORS, type DatabaseError, db } from '../../lib/database.js';
import { verify } from '../../lib/encryption.js';
import { type JWTPayload, encode } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.ts';
import { userSchema } from '../../schema/schema.ts';
import type { UserService } from '../../service/user.js';
import sendWelcomeEmailAsync from '../../task/client/sendWelcomeEmailAsync.js';
import { sendTransactionalEmail } from '../../task/sendWelcomeEmail.ts';
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
import { ERRORS, MAIL_CONTENT, serveBadRequest, serveInternalServerError, serveUnauthorized } from './resp/error.js';
import { serveData } from './resp/resp.js';
import { serializeUser } from './serializer/user.js';

export class AuthController {
  private service: UserService;

  constructor(userService: UserService) {
    this.service = userService;

    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.me = this.me.bind(this);
    this.sendToken = this.sendToken.bind(this);
    this.verifyRegistrationToken = this.verifyRegistrationToken.bind(this);
    this.requestResetPassword = this.requestResetPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.resetPasswordInApp = this.resetPasswordInApp.bind(this);
    this.updateUserDetails = this.updateUserDetails.bind(this);
  }

  public async login(c: Context) {
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
      const serializedUser = serializeUser(user);
      return serveData(c, { token, user: serializedUser });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  }

  public async register(c: Context) {
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
    const serializedUser = serializeUser(user);
    return serveData(c, { token, user: serializedUser });
  }

  public async sendToken(c: Context) {
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
      });

      return serveData(c, {
        success: true,
        message: 'Email token sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  }

  public async verifyRegistrationToken(c: Context) {
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
  }

  public async requestResetPassword(c: Context) {
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
        body: `Please click this link to reset your password: https://yeebli-e10656.webflow.io/onboarding/reset?token=${token}&email=${user.email}`,
        cta_url: `https://yeebli-e10656.webflow.io/onboarding/reset?token=${token}&email=${user.email}`,
      });
      return serveData(c, {
        success: true,
        message: 'Reset password link sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  }
  private async getUser(c: Context) {
    const email = c.get('jwtPayload').email;
    const user = await this.service.findByEmail(email);
    return user;
  }
  public async resetPassword(c: Context) {
    try {
      const body: ResetPasswordBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (user.reset_token !== String(body.token)) {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      await this.service.update(user.id, { password: body.password });
      await db.update(userSchema).set({ reset_token: null }).where(eq(userSchema.id, user.id));
      await sendTransactionalEmail(user.email, user.name, 1, {
        subject: 'Password reset',
        title: 'Password reset',
        subtitle: `Your password has been reset successfully`,
        body: `Your password has been reset successfully. If this was not you, please contact support. Thanks again for using Yeebli!`,
      });
      return serveData(c, {
        success: true,
        message: 'Password reset successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  }

  public async resetPasswordInApp(c: Context) {
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

      // Update password
      await this.service.update(user.id, { password: body.newPassword });

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
  }

  public async me(c: Context) {
    const payload: JWTPayload = c.get('jwtPayload');
    const user = await this.service.findByEmail(payload.email as string);
    if (!user) {
      return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
    }

    const serializedUser = serializeUser(user);
    return serveData(c, { user: serializedUser });
  }

  public async updateUserDetails(c: Context) {
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

      const serializedUser = serializeUser(updatedUser);
      return serveData(c, {
        success: true,
        message: 'User details updated successfully',
        user: serializedUser,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }
}
