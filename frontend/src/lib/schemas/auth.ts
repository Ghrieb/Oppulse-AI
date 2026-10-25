import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/**
 * Authentication schemas.
 *
 * Phase A uses FastAPI-owned auth (argon2id + JWT), so there is no
 * third-party email-confirmation step between a judge and the product.
 */

export const sessionUserSchema = z.object({
  id: uuidSchema,
  email: z.email(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  headline: z.string().nullable(),
  /**
   * Whether the backend has proved the student owns this address.
   *
   * This is account state, not a preference and not consent. It is proven by
   * the backend and can never be set by the client. Sensitive alerts are
   * never sent to an unverified address.
   */
  emailVerified: z.boolean(),
  emailVerifiedAt: isoDateTimeSchema.nullable(),
});

export const sessionSchema = z.object({
  user: sessionUserSchema,
  expiresAt: isoDateTimeSchema,
});

export const signInRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const signUpRequestSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(200)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
  fullName: z.string().min(1, 'Tell us your name.').max(120),
});

export const signUpResponseSchema = z.object({
  user: sessionUserSchema,
  /** False when email confirmation is required by the deployment. */
  signedIn: z.boolean(),
});

/**
 * Asking for a password reset link.
 *
 * The response never says whether the address has an account: that would
 * turn the endpoint into a way of discovering who has one.
 */
export const passwordForgotRequestSchema = z.object({
  email: z.email(),
});

export const passwordForgotResponseSchema = z.object({
  /** Always true, whether or not the address is known. */
  accepted: z.literal(true),
});

/** Setting a new password with a reset token. */
export const passwordResetRequestSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(200)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
});

export const passwordResetResponseSchema = z.object({
  /** True when the password was changed. */
  changed: z.literal(true),
});

/**
 * The result of asking for a verification link.
 *
 * The token is returned because in the prototype the student cannot receive
 * email yet. In the backend it only ever travels in the message.
 */
export const emailVerificationLinkSchema = z.object({
  token: z.string(),
  sentTo: z.email(),
  expiresAt: isoDateTimeSchema,
});

/** The result of confirming an address. */
export const emailVerificationResultSchema = z.object({
  user: sessionUserSchema,
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type EmailVerificationLink = z.infer<typeof emailVerificationLinkSchema>;
export type EmailVerificationResult = z.infer<typeof emailVerificationResultSchema>;
export type PasswordForgotRequest = z.infer<typeof passwordForgotRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
