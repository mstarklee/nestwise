import 'server-only';
import type { Db } from '@nestwise/db';
import { CaptureVoiceUseCase, ConfirmVoiceEntriesUseCase } from '@nestwise/domain/capture';
import { DrizzleCaptureGateway } from '../adapters/capture/drizzle-capture-gateway';
import { DrizzleUsageGateway } from '../adapters/capture/drizzle-usage-gateway';
import { makePostJson, OpenAiExpenseParser } from '../adapters/capture/openai-expense-parser';
import { OpenAiSpeechToText } from '../adapters/capture/openai-speech-to-text';
import { makePostForm } from '../adapters/capture/post-form';
import { SarvamSpeechToText } from '../adapters/capture/sarvam-speech-to-text';
import { DrizzleEvidenceGateway } from '../adapters/duplicates/drizzle-evidence-gateway';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { readProvider } from '../capture/clip-limits';
import { getDb } from './db';
import { makeRecordExpenseUseCase } from './expenses';
import { makeEnsureMiscellaneousItemUseCase } from './plan';

type Env = Readonly<Record<string, string | undefined>>;

/** The speech service named by `STT_PROVIDER`, with its key from `STT_API_KEY`. */
export function makeSpeechToText(env: Env = process.env) {
  const key = env.STT_API_KEY ?? '';
  return readProvider(env.STT_PROVIDER) === 'sarvam'
    ? new SarvamSpeechToText(makePostForm({ 'api-subscription-key': key }), env.SARVAM_STT_MODEL ?? 'saaras:v4')
    : new OpenAiSpeechToText(makePostForm({ Authorization: `Bearer ${env.OPENAI_API_KEY ?? key}` }));
}

export function makeExpenseParser(env: Env = process.env) {
  return new OpenAiExpenseParser(makePostJson({ Authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}` }), env.AI_MODEL ?? 'gpt-6.1-terra');
}

/** Recordings allowed per family per month; a family listed in `UNCAPPED_FAMILY_IDS` has no cap. */
export function voiceCapFor(familyId: string, env: Env = process.env): number {
  const uncapped = (env.UNCAPPED_FAMILY_IDS ?? '').split(',').map((id) => id.trim());
  if (uncapped.includes(familyId)) return Number.POSITIVE_INFINITY;
  const cap = Number(env.CAP_VOICE_PER_MONTH ?? 400);
  return Number.isFinite(cap) && cap > 0 ? cap : 400;
}

export const makeCaptureVoiceUseCase = (familyId: string, db: Db = getDb()) =>
  new CaptureVoiceUseCase(
    {
      captures: new DrizzleCaptureGateway(db),
      usage: new DrizzleUsageGateway(db),
      plan: new DrizzlePlanGateway(db),
      yearPlans: new DrizzleYearPlanGateway(db),
      yearPaid: new DrizzleYearPaidGateway(db),
      families: new DrizzleFamilyGateway(db),
    },
    makeSpeechToText(),
    makeExpenseParser(),
    makeEnsureMiscellaneousItemUseCase(db),
    systemClock,
    uuidIds,
    voiceCapFor(familyId),
  );

export const makeConfirmVoiceEntriesUseCase = (db: Db = getDb()) =>
  new ConfirmVoiceEntriesUseCase(
    {
      captures: new DrizzleCaptureGateway(db),
      yearPlans: new DrizzleYearPlanGateway(db),
      yearPaid: new DrizzleYearPaidGateway(db),
      evidence: new DrizzleEvidenceGateway(db),
      families: new DrizzleFamilyGateway(db),
    },
    makeRecordExpenseUseCase(db),
    systemClock,
    uuidIds,
  );
