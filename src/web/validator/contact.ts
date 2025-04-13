import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registrationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

export const emailVerificationSchema = z.object({
  email: z.string().email(),
});

export const registerTokenSchema = z.object({
  id: z.number(),
  token: z.string(),
});

export const requestResetPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  password: z.string().min(6),
});

export const inAppResetPasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const updateContactDetailsSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type RegistrationBody = z.infer<typeof registrationSchema>;
export type EmailVerificationBody = z.infer<typeof emailVerificationSchema>;
export type RegisterTokenBody = z.infer<typeof registerTokenSchema>;
export type RequestResetPasswordBody = z.infer<typeof requestResetPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type InAppResetPasswordBody = z.infer<typeof inAppResetPasswordSchema>;
export type UpdateContactDetailsBody = z.infer<typeof updateContactDetailsSchema>;
