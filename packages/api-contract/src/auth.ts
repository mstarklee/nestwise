import { z } from 'zod';

/** Shape only; the business rules (valid email, 8–200 characters) live in the domain use cases. */
export const CredentialsRequest = z.object({
  email: z.string().max(320),
  password: z.string().max(1000),
});
export type CredentialsRequest = z.infer<typeof CredentialsRequest>;

export const AuthUserResponse = z.object({
  user: z.object({ id: z.string(), email: z.string() }),
});
export type AuthUserResponse = z.infer<typeof AuthUserResponse>;
