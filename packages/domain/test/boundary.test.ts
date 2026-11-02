import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const domainRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('domain boundary', () => {
  it('domain lint rejects framework and I/O imports', async () => {
    const results = await new ESLint({ cwd: domainRoot }).lintText(
      "import 'next/server';\nimport 'drizzle-orm';\nimport '@nestwise/db';\n",
      { filePath: join(domainRoot, 'src/__boundary__/bad.ts') },
    );
    const ids = results[0]!.messages.map((m) => m.ruleId);
    expect(ids.filter((id) => id === 'no-restricted-imports')).toHaveLength(3);
  });

  it('domain lint rejects vi.mock / vi.fn in domain tests', async () => {
    const results = await new ESLint({ cwd: domainRoot }).lintText("vi.mock('x');\nconst f = vi.fn();\n", {
      filePath: join(domainRoot, 'test/__boundary__/bad.test.ts'),
    });
    expect(results[0]!.messages.filter((m) => m.ruleId === 'no-restricted-properties')).toHaveLength(2);
  });
});
