import { expect, test } from 'vitest';
import manifest from '../../app/manifest';

test('the installed app uses peacock and mist', () => {
  expect(manifest()).toMatchObject({ theme_color: '#00566E', background_color: '#ECF3F4' });
});
