import { z } from 'zod';

/** Shape only; the business rules (valid email, 8–200 characters) live in the domain use cases. */
export const CredentialsRequest = z.object({
  email: z.string().max(320),
  password: z.string().max(1000),
});
export type CredentialsRequest = z.infer<typeof CredentialsRequest>;

/** Sign-up may also say where the verify link should lead afterwards (an app path such as /join/abc). */
export const SignUpRequest = CredentialsRequest.extend({
  returnTo: z.string().max(500).optional(),
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

export const AuthUserResponse = z.object({
  user: z.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() }),
});
export type AuthUserResponse = z.infer<typeof AuthUserResponse>;

export const ConfirmEmailRequest = z.object({ token: z.string().max(200) });
export type ConfirmEmailRequest = z.infer<typeof ConfirmEmailRequest>;

export const ConfirmEmailResponse = z.object({ email: z.string() });
export type ConfirmEmailResponse = z.infer<typeof ConfirmEmailResponse>;

export const ResendVerificationRequest = z.object({ returnTo: z.string().max(500).optional() });
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequest>;

export const ResendVerificationResponse = z.object({ result: z.enum(['sent', 'too_soon', 'already_verified']) });
export type ResendVerificationResponse = z.infer<typeof ResendVerificationResponse>;

export const ForgotPasswordRequest = z.object({ email: z.string().max(320) });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequest>;

export const ResetPasswordRequest = z.object({ token: z.string().max(200), password: z.string().max(1000) });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;
