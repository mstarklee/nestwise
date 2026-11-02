import { getRequestConfig } from 'next-intl/server';
import messages from '../../messages/en.json';

// English only for now (CLAUDE.md); every string lives in messages/en.json so other languages can be added later.
export default getRequestConfig(async () => ({ locale: 'en', messages, timeZone: 'Asia/Kolkata' }));
