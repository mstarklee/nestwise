/**
 * The speech comparison behind the Stage 2 gate (design §3): runs the family's own recordings through both speech
 * services and both parse models, and prints what each one heard and whether the amount and item came out right.
 *
 *   pnpm voice-eval --audio "D:/Mouni/voice-samples"
 *
 * The recordings are personal, so the folder must live OUTSIDE this repository — the script refuses a path inside
 * it. Nothing is written to the repo either: the JSON result goes next to the audio.
 *
 * Needs OPENAI_API_KEY (repo-root .env.local) and SARVAM_API_KEY (apps/web/.env.local); the pnpm script loads both.
 * A service whose key is missing is skipped with a note rather than failing the run.
 *
 * See scripts/voice-eval.README.md for the folder layout and how to write expected.json.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { ParseContext, SpeechToText } from '@nestwise/domain/capture';
import { todayIn } from '@nestwise/domain/shared';
import { makePostJson, OpenAiExpenseParser } from '../apps/web/src/adapters/capture/openai-expense-parser';
import { OpenAiSpeechToText } from '../apps/web/src/adapters/capture/openai-speech-to-text';
import { makePostForm } from '../apps/web/src/adapters/capture/post-form';
import { SarvamSpeechToText } from '../apps/web/src/adapters/capture/sarvam-speech-to-text';
import type { SttProvider } from '../apps/web/src/capture/clip-limits';
import { samplePlanImport } from '../fixtures/sample-plan-import';
import { type ClipRun, type ClipScore, type ExpectedClip, formatReport, scoreClip } from './voice-eval-score';

const PARSE_MODELS = ['gpt-6.1-terra', 'gpt-6-luna'] as const;
const AUDIO_EXTENSIONS = new Set(['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.mpeg', '.mpga']);
const LANGUAGES = ['ta', 'en'];
const TIME_ZONE = 'Asia/Kolkata';

/**
 * The family's lists, taken from the sample plan fixture rather than the database, so the owner can run this before
 * the app is even set up on a machine. Item ids are the fixture's keys — expected.json uses the same keys.
 */
function parseContext(): ParseContext {
  const monthly = samplePlanImport.groups.filter((g) => g.kind === 'monthly');
  const yearly = samplePlanImport.groups.filter((g) => g.kind === 'yearly');
  return {
    items: [
      ...monthly.flatMap((g) => g.items.map((i) => ({ id: i.key, name: i.name, group: g.name }))),
      { id: 'miscellaneous', name: 'Miscellaneous', group: 'Miscellaneous' },
    ],
    yearLines: yearly.flatMap((g) =>
      g.items.map((i) => ({ id: i.key, name: i.name, plannedMinor: i.amountMinor, paidMinor: 0, dueMonth: i.dueMonth ?? null })),
    ),
    today: todayIn(TIME_ZONE, new Date()),
    currencyCode: 'INR',
    minorUnits: 2,
  };
}

function speechServices(env: Readonly<Record<string, string | undefined>>): { provider: SttProvider; stt: SpeechToText }[] {
  const services: { provider: SttProvider; stt: SpeechToText }[] = [];
  if (env.OPENAI_API_KEY) {
    services.push({ provider: 'openai', stt: new OpenAiSpeechToText(makePostForm({ Authorization: `Bearer ${env.OPENAI_API_KEY}` })) });
  } else {
    console.warn('! OPENAI_API_KEY is not set — skipping OpenAI');
  }
  if (env.SARVAM_API_KEY) {
    services.push({
      provider: 'sarvam',
      stt: new SarvamSpeechToText(makePostForm({ 'api-subscription-key': env.SARVAM_API_KEY }), env.SARVAM_STT_MODEL ?? 'saaras:v4'),
    });
  } else {
    console.warn('! SARVAM_API_KEY is not set — skipping Sarvam');
  }
  return services;
}

async function readExpected(audioDir: string): Promise<Record<string, ExpectedClip>> {
  try {
    return JSON.parse(await readFile(join(audioDir, 'expected.json'), 'utf8')) as Record<string, ExpectedClip>;
  } catch {
    console.warn('! No expected.json in the audio folder — every clip will be reported as unscored');
    return {};
  }
}

const mimeFor = (file: string) =>
  ({ '.mp3': 'audio/mpeg', '.mpeg': 'audio/mpeg', '.mpga': 'audio/mpeg', '.mp4': 'audio/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webm': 'audio/webm' })[
    extname(file).toLowerCase()
  ] ?? 'audio/mp4';

async function main() {
  const index = process.argv.indexOf('--audio');
  const given = index > 0 ? process.argv[index + 1] : undefined;
  if (!given) throw new Error('Usage: pnpm voice-eval --audio <folder outside this repo>');

  const audioDir = resolve(given);
  const repoRoot = resolve(import.meta.dirname, '..');
  if (audioDir === repoRoot || audioDir.startsWith(repoRoot + sep)) {
    throw new Error(`The recordings are personal and must live outside the repository. ${audioDir} is inside ${repoRoot}.`);
  }

  const services = speechServices(process.env);
  if (services.length === 0) throw new Error('Neither OPENAI_API_KEY nor SARVAM_API_KEY is set; nothing to compare');

  const expected = await readExpected(audioDir);
  const clips = (await readdir(audioDir)).filter((file) => AUDIO_EXTENSIONS.has(extname(file).toLowerCase())).sort();
  if (clips.length === 0) throw new Error(`No audio files in ${audioDir}`);

  const context = parseContext();
  const scores: ClipScore[] = [];

  for (const clip of clips) {
    const audio = new Uint8Array(await readFile(join(audioDir, clip)));
    for (const { provider, stt } of services) {
      let heard: { text: string; seconds: number };
      try {
        const result = await stt.transcribe(audio, mimeFor(clip), { languages: LANGUAGES });
        heard = { text: result.text, seconds: result.seconds };
      } catch (error) {
        console.error(`  ${clip} / ${provider}: speech failed — ${(error as Error).message}`);
        continue;
      }

      // One transcript, both parse models, so the models are compared on identical input.
      for (const parseModel of PARSE_MODELS) {
        const parser = new OpenAiExpenseParser(makePostJson({ Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }), parseModel);
        let run: ClipRun;
        try {
          run = { clip, provider, parseModel, transcript: heard.text, entries: await parser.parse(heard.text, context), sttSeconds: heard.seconds };
        } catch (error) {
          console.error(`  ${clip} / ${provider} / ${parseModel}: parse failed — ${(error as Error).message}`);
          continue;
        }
        scores.push(scoreClip(run, expected[clip]));
      }
    }
  }

  const report = formatReport(scores);
  console.log(`\n${report}\n`);
  await writeFile(join(audioDir, 'voice-eval-result.json'), JSON.stringify({ ranAt: new Date().toISOString(), scores }, null, 2), 'utf8');
  await writeFile(join(audioDir, 'voice-eval-report.txt'), report, 'utf8');
  console.log(`Written next to your recordings: voice-eval-report.txt and voice-eval-result.json`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
