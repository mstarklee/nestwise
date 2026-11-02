import type { Family } from '../../src/family';

/** The test family f1: INR, India, created by u1. */
export const familyRecord = (overrides: Partial<Family> = {}): Family => ({
  id: 'f1',
  name: 'Family',
  currencyCode: 'INR',
  minorUnit: 2,
  numberLocale: 'en-IN',
  timeZone: 'Asia/Kolkata',
  countryCode: 'IN',
  setAsideOverrideMinor: null,
  alertThresholds: [80, 100],
  createdBy: 'u1',
  createdAt: new Date('2026-11-01T04:00:00Z'),
  ...overrides,
});
