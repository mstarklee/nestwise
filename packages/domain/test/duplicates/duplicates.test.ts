import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import {
  DuplicateAlreadyResolvedError,
  DuplicateMatchNotFoundError,
  findDuplicateCandidates,
  InvalidDuplicateAnswerError,
  ListInboxUseCase,
  pairKey,
  ResolveDuplicateUseCase,
} from '../../src/duplicates';
import {
  DeleteExpenseUseCase,
  EditExpenseUseCase,
  type RecordExpenseCommand,
  RecordExpenseUseCase,
  RestoreExpenseUseCase,
  type Transaction,
} from '../../src/expenses';
import { EnsureMonthBudgetUseCase, GetMonthSummaryUseCase } from '../../src/month-budget';
import { ImportPlanUseCase } from '../../src/plan';
import { type Actor, type IsoDate, NotAllowedError } from '../../src/shared';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryExpensesUnitOfWork, InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryFamilyGateway, InMemoryMembershipGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const me: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const spouse: Actor = { userId: 'u2', familyId: 'f1', role: 'member' };
const viewer: Actor = { userId: 'u3', familyId: 'f1', role: 'viewer' };
const OCT = { year: 2026, month: 10 };
const uuid = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const date = (value: string) => value as IsoDate;

let ledger: InMemoryTransactionGateway;
let uow: InMemoryExpensesUnitOfWork;
let clock: FixedClock;
let record: RecordExpenseUseCase;
let edit: EditExpenseUseCase;
let remove: DeleteExpenseUseCase;
let resolve: ResolveDuplicateUseCase;
let inbox: ListInboxUseCase;
let summary: GetMonthSummaryUseCase;
let itemId: (seedKey: string) => string;

beforeEach(async () => {
  const planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2026-11-08T06:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: me, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;

  const families = new InMemoryFamilyGateway();
  await families.save(familyRecord());
  const memberships = new InMemoryMembershipGateway();
  for (const userId of ['u1', 'u2', 'u3']) await memberships.save({ userId, familyId: 'f1', role: 'admin', joinedAt: clock.now() });

  ledger = new InMemoryTransactionGateway();
  uow = new InMemoryExpensesUnitOfWork(ledger);
  const ensureMonth = new EnsureMonthBudgetUseCase(new InMemoryMonthBudgetGateway(), planUow.plan, ids);
  const matchIds = new SequentialIds('match');
  record = new RecordExpenseUseCase(uow, ledger, planUow.plan, memberships, families, ensureMonth, clock, matchIds);
  edit = new EditExpenseUseCase(uow, ledger, planUow.plan, memberships, ensureMonth, clock);
  remove = new DeleteExpenseUseCase(uow, ledger, clock);
  resolve = new ResolveDuplicateUseCase(uow, new SequentialIds('evidence'), clock);
  inbox = new ListInboxUseCase(uow.duplicates, ledger);
  summary = new GetMonthSummaryUseCase(ensureMonth, ledger.actuals(), planUow.plan);
});

const spend = (actor: Actor, n: number, overrides: Partial<RecordExpenseCommand> = {}): RecordExpenseCommand => ({
  actor,
  id: uuid(n),
  amountMinor: 94_500,
  txnDate: date('2026-10-07'),
  allocations: [{ itemId: itemId('groceries'), amountMinor: 94_500 }],
  ...overrides,
});
const groceries = async () => (await summary.execute({ actor: me, period: OCT })).lines.find((l) => l.itemId === itemId('groceries'))!.actualMinor;
const advance = (minutes: number) => clock.set(new Date(clock.now().getTime() + minutes * 60_000).toISOString());

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: uuid(99),
    familyId: 'f1',
    kind: 'expense',
    amountMinor: 94_500,
    currencyCode: 'INR',
    txnDate: date('2026-10-07'),
    period: OCT,
    merchant: null,
    note: null,
    enteredBy: 'u1',
    paidBy: 'u1',
    captureMethod: 'typed',
    status: 'confirmed',
    mergedInto: null,
    allocations: [],
    entryTimeZone: 'Asia/Kolkata',
    deletedAt: null,
    createdAt: new Date('2026-10-07T06:00:00Z'),
    updatedAt: new Date('2026-10-07T06:00:00Z'),
    ...overrides,
  };
}

describe('findDuplicateCandidates', () => {
  it('needs the same amount and kind, at most a day apart, and another person, method or shop', () => {
    const saved = txn({ id: 'b', enteredBy: 'u2', txnDate: date('2026-10-08') });
    const others = [
      txn({ id: 'a' }),
      txn({ id: 'c', amountMinor: 95_000 }),
      txn({ id: 'd', kind: 'refund' }),
      txn({ id: 'e', txnDate: date('2026-10-10') }),
      txn({ id: 'f', enteredBy: 'u2' }),
      txn({ id: 'g', enteredBy: 'u2', captureMethod: 'receipt' }),
      txn({ id: 'h', enteredBy: 'u2', merchant: 'Local Grocery Shop, Anna Nagar' }),
    ];
    const found = findDuplicateCandidates({ ...saved, merchant: 'local grocery shop' }, others, new Set());
    expect(found.map((c) => [c.other.id, c.reasons])).toEqual([
      ['a', ['other_person']],
      ['g', ['other_method']],
      ['h', ['same_shop']],
    ]);
  });

  it('skips the same id, pairs already marked different, deleted and merged ones', () => {
    const saved = txn({ id: 'b', enteredBy: 'u2' });
    const others = [txn({ id: 'b' }), txn({ id: 'a' }), txn({ id: 'c', deletedAt: new Date() }), txn({ id: 'd', mergedInto: 'x' })];
    expect(findDuplicateCandidates(saved, others, new Set([pairKey('a', 'b')]))).toEqual([]);
  });
});

describe('RecordExpenseUseCase with duplicate checks', () => {
  it('₹945 typed by me and ₹945 typed by my spouse the next day: the second is pending with reason other_person', async () => {
    await record.execute(spend(me, 1));
    advance(60);
    const second = await record.execute(spend(spouse, 2, { txnDate: date('2026-10-08') }));
    expect(second.transaction.status).toBe('pending');
    expect(second.duplicate).toMatchObject({ other: { id: uuid(1) } });
    const [entry] = await inbox.execute({ actor: me });
    expect(entry).toMatchObject({ matchId: second.duplicate!.matchId, pending: { id: uuid(2) }, other: { id: uuid(1) }, reasons: ['other_person'] });
  });

  it('two ₹23 teas typed by the same person on the same day: no match, both confirmed', async () => {
    const tea = { amountMinor: 2_300, allocations: [{ itemId: itemId('groceries'), amountMinor: 2_300 }] };
    await record.execute(spend(me, 1, tea));
    const second = await record.execute(spend(me, 2, tea));
    expect(second.transaction.status).toBe('confirmed');
    expect(second.duplicate).toBeNull();
    expect(await groceries()).toBe(4_600);
  });

  it('the ₹1,250 vegetables on 6 and 13 October are never compared (PRD §7 test 11)', async () => {
    const veg = { amountMinor: 125_000, allocations: [{ itemId: itemId('vegetables'), amountMinor: 125_000 }] };
    await record.execute(spend(me, 1, { ...veg, txnDate: date('2026-10-06') }));
    const second = await record.execute(spend(spouse, 2, { ...veg, txnDate: date('2026-10-13') }));
    expect(second.duplicate).toBeNull();
    expect(await inbox.execute({ actor: me })).toEqual([]);
  });

  it('a resend of the same id returns created:false and creates no match (Review Focus 2)', async () => {
    await record.execute(spend(me, 1));
    const again = await record.execute(spend(me, 1));
    expect(again).toMatchObject({ created: false, duplicate: null });
    expect(await inbox.execute({ actor: me })).toEqual([]);
  });

  it('a pending expense is excluded from actuals until answered', async () => {
    await record.execute(spend(me, 1));
    await record.execute(spend(spouse, 2));
    expect(await groceries()).toBe(94_500);
  });
});

describe('ResolveDuplicateUseCase', () => {
  it('Same: the pending one is merged into the earlier; the month actual counts ₹945 once', async () => {
    await record.execute(spend(me, 1));
    advance(60);
    const { duplicate } = await record.execute(spend(spouse, 2));
    await resolve.execute({ actor: spouse, matchId: duplicate!.matchId, answer: 'same' });
    expect(await groceries()).toBe(94_500);
    expect(ledger.rows.get(uuid(2))!.mergedInto).toBe(uuid(1));
    expect(uow.evidence.forTransaction(uuid(1))).toMatchObject([{ kind: 'merged_entry', extracted: { id: uuid(2), amountMinor: 94_500 } }]);
    expect(await inbox.execute({ actor: me })).toEqual([]);
    expect(uow.activity.all().at(-1)).toMatchObject({ action: 'duplicate.same', actorId: 'u2' });
  });

  it('Same with keepId keeps the pending one and merges the other into it', async () => {
    await record.execute(spend(me, 1));
    const { duplicate } = await record.execute(spend(spouse, 2));
    await resolve.execute({ actor: me, matchId: duplicate!.matchId, answer: 'same', keepId: uuid(2) });
    expect(ledger.rows.get(uuid(1))!.mergedInto).toBe(uuid(2));
    expect(ledger.rows.get(uuid(2))!.status).toBe('confirmed');
    expect(await groceries()).toBe(94_500);
  });

  it('₹945 typed, voice and receipt resolve Same twice → one ₹945 expense with 3 proofs (PRD §7 test 10)', async () => {
    await record.execute(spend(me, 1));
    advance(1);
    const voice = await record.execute(spend(me, 2, { captureMethod: 'voice' }));
    advance(1);
    const receipt = await record.execute(spend(me, 3, { captureMethod: 'receipt' }));
    await resolve.execute({ actor: me, matchId: voice.duplicate!.matchId, answer: 'same' });
    await resolve.execute({ actor: me, matchId: receipt.duplicate!.matchId, answer: 'same' });
    expect(await groceries()).toBe(94_500);
    const kept = [...ledger.rows.values()].filter((t) => t.mergedInto === null && t.deletedAt === null);
    expect(kept.map((t) => t.id)).toEqual([uuid(1)]);
    expect(1 + uow.evidence.forTransaction(uuid(1)).length).toBe(3);
  });

  it('Different: both count, and the pair is never matched again', async () => {
    await record.execute(spend(me, 1));
    const { duplicate } = await record.execute(spend(spouse, 2));
    await resolve.execute({ actor: me, matchId: duplicate!.matchId, answer: 'different' });
    expect(await groceries()).toBe(189_000);
    expect(ledger.rows.get(uuid(2))!.status).toBe('confirmed');
    expect(await uow.duplicates.differentPairsFor('f1', uuid(2))).toEqual(new Set([pairKey(uuid(1), uuid(2))]));
    expect(uow.activity.all().at(-1)).toMatchObject({ action: 'duplicate.different' });
  });

  it('refuses a second answer, an unknown match, a keepId outside the pair, and a viewer', async () => {
    await record.execute(spend(me, 1));
    const { duplicate } = await record.execute(spend(spouse, 2));
    const matchId = duplicate!.matchId;
    await expect(resolve.execute({ actor: viewer, matchId, answer: 'same' })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(resolve.execute({ actor: me, matchId, answer: 'same', keepId: uuid(7) })).rejects.toBeInstanceOf(InvalidDuplicateAnswerError);
    await expect(resolve.execute({ actor: me, matchId: 'nope', answer: 'same' })).rejects.toBeInstanceOf(DuplicateMatchNotFoundError);
    await expect(resolve.execute({ actor: { ...me, familyId: 'f2' }, matchId, answer: 'same' })).rejects.toBeInstanceOf(DuplicateMatchNotFoundError);
    await resolve.execute({ actor: me, matchId, answer: 'different' });
    await expect(resolve.execute({ actor: me, matchId, answer: 'same' })).rejects.toBeInstanceOf(DuplicateAlreadyResolvedError);
  });
});

describe('a duplicate question that goes stale (Review Focus 5)', () => {
  it('deleting the confirmed side clears the pending match and confirms the other', async () => {
    await record.execute(spend(me, 1));
    await record.execute(spend(spouse, 2));
    await remove.execute({ actor: me, id: uuid(1) });
    expect(await inbox.execute({ actor: me })).toEqual([]);
    expect(ledger.rows.get(uuid(2))!.status).toBe('confirmed');
    expect(await groceries()).toBe(94_500);
  });

  it("editing the pending side's amount to ₹950 clears the match and confirms it", async () => {
    await record.execute(spend(me, 1));
    await record.execute(spend(spouse, 2));
    await edit.execute({ actor: spouse, id: uuid(2), changes: { amountMinor: 95_000 } });
    expect(await inbox.execute({ actor: me })).toEqual([]);
    expect(ledger.rows.get(uuid(2))!.status).toBe('confirmed');
    expect(await groceries()).toBe(189_500);
  });

  it('deleting the pending side and then restoring it: it counts again and shows in the ledger, with no question left', async () => {
    await record.execute(spend(me, 1));
    await record.execute(spend(spouse, 2));
    await remove.execute({ actor: spouse, id: uuid(2) });
    await new RestoreExpenseUseCase(uow, ledger, clock).execute({ actor: spouse, id: uuid(2) });
    expect(await inbox.execute({ actor: me })).toEqual([]);
    expect(ledger.rows.get(uuid(2))!.status).toBe('confirmed');
    expect(await groceries()).toBe(189_000);
  });

  it('editing only the note keeps the question', async () => {
    await record.execute(spend(me, 1));
    await record.execute(spend(spouse, 2));
    await edit.execute({ actor: spouse, id: uuid(2), changes: { note: 'milk too' } });
    expect(await inbox.execute({ actor: me })).toHaveLength(1);
  });
});
