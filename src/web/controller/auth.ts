import type { Context } from "hono";
import { db, DB_ERRORS, type DatabaseError } from "../../lib/database.js";
import { verify } from "../../lib/encryption.js";
import { type JWTPayload, encode } from "../../lib/jwt.js";
import type { UserService } from "../../service/user.js";
import sendWelcomeEmailAsync from "../../task/client/sendWelcomeEmailAsync.js";
import type {
  EmailVerificationBody,
  LoginBody,
  RegistrationBody,
} from "../validator/user.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveUnauthorized,
} from "./resp/error.js";
import { serveData } from "./resp/resp.js";
import { serializeUser } from "./serializer/user.js";
import { sendTransactionalEmail } from "../../task/sendWelcomeEmail.ts";
import { userSchema } from "../../schema/schema.ts";
import { eq } from "drizzle-orm";

export class AuthController {
  private service: UserService;

  constructor(userService: UserService) {
    this.service = userService;

    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.me = this.me.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
  }

  public async login(c: Context) {
    const body: LoginBody = await c.req.json();
    const user = await this.service.findByEmail(body.email);
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Invalid email, please try again",
          code: "AUTH_INVALID_CREDENTIALS",
        },
        401
      );
    }
    const isVerified = verify(body.password, user.password);
    if (!isVerified) {
      return c.json(
        {
          success: false,
          message: "Invalid password, please try again",
          code: "AUTH_INVALID_CREDENTIALS",
        },
        401
      );
    }

    const token = await encode(user.id, user.email);
    const serializedUser = serializeUser(user);
    return serveData(c, { token, user: serializedUser });
  }

  public async register(c: Context) {
    const body: RegistrationBody = await c.req.json();
    try {
      await this.service.create(body.name, body.email, body.password);
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

  public async verifyEmail(c: Context) {
    const body: EmailVerificationBody = await c.req.json();
    const user = await this.service.findByEmail(body.email);
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Invalid email, please check",
          code: "AUTH_INVALID_CREDENTIALS",
        },
        401
      );
    }
    //6 digint random number
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    await db
      .update(userSchema)
      .set({ email_token: token })
      .where(eq(userSchema.id, user.id));
    try {
      await sendTransactionalEmail(user, {
        subject: "Welcome to our app",
        message: "Welcome to our app",
      });
    } catch (err) {
      return serveInternalServerError(c, err);
    }

    return serveData(c, {
      success: true,
      message: 'Email token sent successfully',
    });
  }

  public async me(c: Context) {
    const payload: JWTPayload = c.get("jwtPayload");
    const user = await this.service.findByEmail(payload.email as string);
    if (!user) {
      return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
    }

    const serializedUser = serializeUser(user);
    return serveData(c, { user: serializedUser });
  }
}
