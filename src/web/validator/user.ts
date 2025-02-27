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

type LoginBody = z.infer<typeof loginSchema>;
type RegistrationBody = z.infer<typeof registrationSchema>;
type EmailVerificationBody = z.infer<typeof emailVerificationSchema>;
type RegisterTokenBody = z.infer<typeof registerTokenSchema>;

export {
  type EmailVerificationBody,
  type LoginBody,
  type RegistrationBody,
  type RegisterTokenBody,
  emailVerificationValidator,
  loginValidator,
  registrationValidator,
  registerTokenValidator,
};
