import { validator } from 'hono/validator';
import { z } from 'zod';
import { validateSchema } from './validator.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(20),
});

const loginValidator = validator('json', (value, c) => {
  return validateSchema(c, loginSchema, value);
});

const registrationSchema = loginSchema.extend({
  name: z.string().min(4).max(40),
  phone: z.string().min(10).max(15),
});

const registrationValidator = validator('json', (value, c) => {
  return validateSchema(c, registrationSchema, value);
});

const emailVerificationSchema = z.object({
  email: z.string().email(),
});

const emailVerificationValidator = validator('json', (value, c) => {
  return validateSchema(c, emailVerificationSchema, value);
});

const registerTokenSchema = z.object({
  token: z.number(),
  id: z.number(),
});

const registerTokenValidator = validator('json', (value, c) => {
  return validateSchema(c, registerTokenSchema, value);
});

const requestResetPasswordSchema = z.object({
  email: z.string().email(),
});

const requestResetPasswordValidator = validator('json', (value, c) => {
  return validateSchema(c, requestResetPasswordSchema, value);
});

const resetPasswordSchema = z.object({
  token: z.number(),
  email: z.string().email(),
  password: z.string().min(8).max(20),
});

const resetPasswordValidator = validator('json', (value, c) => {
  return validateSchema(c, resetPasswordSchema, value);
});

type LoginBody = z.infer<typeof loginSchema>;
type RegistrationBody = z.infer<typeof registrationSchema>;
type EmailVerificationBody = z.infer<typeof emailVerificationSchema>;
type RegisterTokenBody = z.infer<typeof registerTokenSchema>;
type RequestResetPasswordBody = z.infer<typeof requestResetPasswordSchema>;
type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export {
  type EmailVerificationBody,
  type LoginBody,
  type RegistrationBody,
  type RegisterTokenBody,
  type RequestResetPasswordBody,
  type ResetPasswordBody,
  emailVerificationValidator,
  loginValidator,
  registrationValidator,
  registerTokenValidator,
  requestResetPasswordValidator,
  resetPasswordValidator,
};
