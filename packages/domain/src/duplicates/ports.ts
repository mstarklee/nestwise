import type { DuplicateMatch, Evidence } from './models';

/** Every method is scoped to one family. */
export interface DuplicateMatchGateway {
  /** False if the pair already has a question (either order). */
  create(match: DuplicateMatch): Promise<boolean>;
  find(familyId: string, id: string): Promise<DuplicateMatch | undefined>;
  /** Unanswered questions, oldest first. */
  listPending(familyId: string): Promise<readonly DuplicateMatch[]>;
  /** pairKey()s of the pairs with this transaction that were answered Different. */
  differentPairsFor(familyId: string, txnId: string): Promise<ReadonlySet<string>>;
  save(match: DuplicateMatch): Promise<void>;
  /** Removes the unanswered questions this transaction is part of, and returns them. */
  clearPendingFor(familyId: string, txnId: string): Promise<readonly DuplicateMatch[]>;
}

export interface EvidenceGateway {
  add(evidence: Evidence): Promise<void>;
  /** Re-points every proof of one transaction to another (when it is merged away). */
  moveTo(familyId: string, fromTxnId: string, toTxnId: string): Promise<void>;
  /** Live proofs per transaction id (only ids that have any). */
  countByTransaction(familyId: string, txnIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
