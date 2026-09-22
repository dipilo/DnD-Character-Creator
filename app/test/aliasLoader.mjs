// Resolves the app's `@/` alias for Node's own type stripping, so a pure `lib/` module can be
// imported by a test without Vite. Registered with `node --import ./app/test/aliasLoader.mjs`.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./aliasHooks.mjs', import.meta.url), pathToFileURL('./'));
