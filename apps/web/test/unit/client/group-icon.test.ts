import { expect, test } from 'vitest';
import { iconFor } from '@/client/group-icon';

test("icons for the family's own names", () => {
  expect(iconFor('Health Insurance — In-laws')).toBe('shield');
  expect(iconFor('Pongal')).toBe('pot');
  expect(iconFor('Native-place Festival')).toBe('pot');
  expect(iconFor('Fourth Family Birthday')).toBe('cake');
  expect(iconFor('Kids’ School Fees — Term 1')).toBe('book');
  expect(iconFor('Family Tour / Vacation')).toBe('plane');
  expect(iconFor('Car & Bike Servicing')).toBe('car');
  expect(iconFor('Household Electronics & Appliance Repairs')).toBe('wrench');
  expect(iconFor('Kids’ Games / Indoor Play')).toBe('child');
  expect(iconFor('Food & Dining')).toBe('food');
  expect(iconFor('Utilities & Bills')).toBe('bolt');
  expect(iconFor('Subscriptions & Learning')).toBe('screen');
  expect(iconFor('Something new')).toBe('tag');
});
