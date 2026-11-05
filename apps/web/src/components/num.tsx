import type { ReactNode } from 'react';

/**
 * The <m> tag in messages: a number or amount inside a sentence. Mukta Malar's figures sit low beside text, so numbers
 * are set in the money style (Baloo, tabular). Use it as `t.rich('key', { m: mTag, ...values })` with `<m>{amount}</m>`.
 */
export const mTag = (chunks: ReactNode) => <span className="money">{chunks}</span>;
