import { beforeEach, describe, expect, it } from 'vitest';
import { GetVoiceUsageUseCase } from '../../src/capture';
import type { Actor } from '../../src/shared';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryUsageGateway } from '../fakes/in-memory-capture-gateways';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';

const FAMILY = 'f1';
const NOV = { year: 2026, month: 11 };
const admin: Actor = { userId: 'u1', familyId: FAMILY, role: 'admin' };
const viewer: Actor = { userId: 'u3', familyId: FAMILY, role: 'viewer' };

function build(cap = 400) {
  const usage = new InMemoryUsageGateway();
  const families = new InMemoryFamilyGateway();
  // 8am India on 5 November, so the month comes from the family's zone and not from UTC.
  const useCase = new GetVoiceUsageUseCase(usage, families, new FixedClock('2026-11-05T02:30:00Z'), cap);
  return { usage, families, useCase };
}

describe('GetVoiceUsageUseCase', () => {
  let h: ReturnType<typeof build>;

  beforeEach(async () => {
    h = build();
    await h.families.save(familyRecord({ id: FAMILY, timeZone: 'Asia/Kolkata' }));
  });

  it('reports nothing used in a month with no recordings', async () => {
    expect(await h.useCase.execute({ actor: admin })).toEqual({ period: NOV, used: 0, secondsRecorded: 0, capPerMonth: 400 });
  });

  it("reports this month's recordings against the cap", async () => {
    h.usage.set(FAMILY, NOV, 37, 540);

    expect(await h.useCase.execute({ actor: admin })).toMatchObject({ used: 37, secondsRecorded: 540, capPerMonth: 400 });
  });

  it('reads the month from the family time zone, not UTC', async () => {
    // 02:30 UTC on 5 Nov is already 08:00 on 5 Nov in India; both land in November, and the zone is what decides.
    expect((await h.useCase.execute({ actor: admin })).period).toEqual(NOV);
  });

  it('says there is no limit for a family that is uncapped', async () => {
    const uncapped = build(Number.POSITIVE_INFINITY);
    await uncapped.families.save(familyRecord({ id: FAMILY }));

    expect((await uncapped.useCase.execute({ actor: admin })).capPerMonth).toBeNull();
  });

  it('lets a Viewer see it — it is the family’s usage, not a private figure', async () => {
    await expect(h.useCase.execute({ actor: viewer })).resolves.toMatchObject({ used: 0 });
  });

  it('counts only this family', async () => {
    h.usage.set('f2', NOV, 99);

    expect((await h.useCase.execute({ actor: admin })).used).toBe(0);
  });

  it('refuses when the family is not there', async () => {
    const empty = build();

    await expect(empty.useCase.execute({ actor: admin })).rejects.toThrow();
  });
});
