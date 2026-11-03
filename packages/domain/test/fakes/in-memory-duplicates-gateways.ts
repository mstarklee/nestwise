import { type DuplicateMatch, type DuplicateMatchGateway, type Evidence, type EvidenceGateway, pairKey } from '../../src/duplicates';

export class InMemoryDuplicateMatchGateway implements DuplicateMatchGateway {
  rows = new Map<string, DuplicateMatch>();

  async create(match: DuplicateMatch) {
    const key = pairKey(match.txnA, match.txnB);
    if ([...this.rows.values()].some((m) => m.familyId === match.familyId && pairKey(m.txnA, m.txnB) === key)) return false;
    this.rows.set(match.id, match);
    return true;
  }
  async find(familyId: string, id: string) {
    const row = this.rows.get(id);
    return row?.familyId === familyId ? row : undefined;
  }
  async listPending(familyId: string) {
    return [...this.rows.values()]
      .filter((m) => m.familyId === familyId && m.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async differentPairsFor(familyId: string, txnId: string) {
    return new Set(
      [...this.rows.values()]
        .filter((m) => m.familyId === familyId && m.status === 'different' && (m.txnA === txnId || m.txnB === txnId))
        .map((m) => pairKey(m.txnA, m.txnB)),
    );
  }
  async answer(match: DuplicateMatch) {
    const row = this.rows.get(match.id);
    if (row?.familyId !== match.familyId || row.status !== 'pending') return false;
    this.rows.set(match.id, match);
    return true;
  }
  async clearPendingFor(familyId: string, txnId: string) {
    const cleared = [...this.rows.values()].filter(
      (m) => m.familyId === familyId && m.status === 'pending' && (m.txnA === txnId || m.txnB === txnId),
    );
    for (const m of cleared) this.rows.delete(m.id);
    return cleared;
  }
}

export class InMemoryEvidenceGateway implements EvidenceGateway {
  rows: Evidence[] = [];

  async add(evidence: Evidence) {
    this.rows.push(evidence);
  }
  async moveTo(familyId: string, fromTxnId: string, toTxnId: string) {
    this.rows = this.rows.map((e) => (e.familyId === familyId && e.transactionId === fromTxnId ? { ...e, transactionId: toTxnId } : e));
  }
  async countByTransaction(familyId: string, txnIds: readonly string[]) {
    const counts = new Map<string, number>();
    for (const e of this.rows) {
      if (e.familyId === familyId && e.transactionId && txnIds.includes(e.transactionId)) counts.set(e.transactionId, (counts.get(e.transactionId) ?? 0) + 1);
    }
    return counts;
  }
  forTransaction(txnId: string): readonly Evidence[] {
    return this.rows.filter((e) => e.transactionId === txnId);
  }
}
