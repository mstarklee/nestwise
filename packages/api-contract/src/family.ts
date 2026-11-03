import { z } from 'zod';

const Role = z.enum(['admin', 'member', 'viewer']);

/** Shape only. Amounts are integer minor units (the client parses "₹ 500" with parseMinor). */
export const CreateFamilyRequest = z.object({
  name: z.string().max(400),
  currencyCode: z.string().max(3),
  timeZone: z.string().max(100),
  countryCode: z.string().max(2).nullish(),
  openingPotMinor: z.number().int(),
});
export type CreateFamilyRequest = z.infer<typeof CreateFamilyRequest>;

export const FamilyResponse = z.object({
  family: z.object({
    id: z.string(),
    name: z.string(),
    currencyCode: z.string(),
    minorUnit: z.number().int(),
    numberLocale: z.string(),
    timeZone: z.string(),
    countryCode: z.string().nullable(),
  }),
  role: Role,
});
export type FamilyResponse = z.infer<typeof FamilyResponse>;

export const CreateInviteRequest = z.object({ role: Role });
export type CreateInviteRequest = z.infer<typeof CreateInviteRequest>;

export const InviteResponse = z.object({
  inviteId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  /** Path of the join page; the app prefixes its own address. */
  joinPath: z.string(),
});
export type InviteResponse = z.infer<typeof InviteResponse>;

export const MembershipResponse = z.object({ familyId: z.string(), role: Role });
export type MembershipResponse = z.infer<typeof MembershipResponse>;

export const UpdateFamilyRequest = z.object({ name: z.string().max(200).optional(), alertThresholds: z.array(z.number().int()).max(10).optional() });
export type UpdateFamilyRequest = z.infer<typeof UpdateFamilyRequest>;

export const FamilySettingsResponse = z.object({
  family: z.object({ id: z.string(), name: z.string(), currencyCode: z.string(), alertThresholds: z.array(z.number().int()) }),
});
export type FamilySettingsResponse = z.infer<typeof FamilySettingsResponse>;
