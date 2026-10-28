/**
 * tests/setup/globalTeardown.js
 *
 * Vitest global teardown hook.
 */

import { teardown } from './globalSetup.js';

export default async function globalTeardown() {
  await teardown();
}
