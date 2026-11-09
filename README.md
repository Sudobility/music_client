# @sudobility/music_client

Typed network client and React Query hooks for the Moosiac `music_api`: AI score
generation, project persistence, snapshots, score presets, live-generation
WebSocket streaming, and user-profile endpoints.

This is a **library** (ESM, no bundled runtime of its own). It does no `fetch`
directly — all HTTP goes through an injected `NetworkClient` from
`@sudobility/types`, so it runs unchanged on web and React Native. Request and
response shapes come from `@sudobility/music_types`.

## Installation

`@sudobility/*` packages are published to **GitHub Packages**, not the public npm
registry. Consumers need a `.npmrc` that routes the scope and authenticates:

```
@sudobility:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_READ_TOKEN}
```

Then:

```bash
bun add @sudobility/music_client @sudobility/music_types
```

Peer dependencies (provided by the consumer): `@sudobility/di`,
`@sudobility/types`, `@tanstack/react-query` (≥5), and `react` (≥18).

## Usage

### Direct client

```ts
import { MusicClient } from '@sudobility/music_client';

const client = new MusicClient(networkClient, 'https://api.moosiac.app');
const result = await client.generateScore(request, idToken /*, signal? */);
```

`MusicClient(networkClient, baseUrl)` is stateless about auth — every method
takes the bearer token per call; nothing is stored.

### React Query hooks

Every hook takes a `MusicHookContext` as its first argument:

```ts
import { useProjects } from '@sudobility/music_client';

const projects = useProjects({
  networkClient,
  baseUrl,
  getToken: () => auth.getIdToken(), // resolved per request
  userId,                            // null = signed out (keeps queries idle)
});
```

Prefer `getToken` (awaited at send time) over the deprecated `token` field — a
captured token goes stale within an hour and is null until the session is
restored. Hooks include `useProject`/`useCreateProject`/`useUpdateProject`/
`useDeleteProject`/`useDuplicateProject`, `useGenerateScore`/`useRegenerateRegion`,
`useProjectGeneration` (+ live socket), `useProjectSnapshots`, `useScorePresets`,
`useSiteAdmin`, `useProfile`, and `useTranscriptionCapability`. See `src/index.ts`
for the full export surface.

### Typed errors

Failures reject with typed errors: `QuotaExceededError`,
`InsufficientCreditsError`, `AiOutputInvalidError`, `AiGenerationError`,
`ProjectNotFoundError`, and the base `ApiError`. Use `isInsufficientCredits(err)`
(it checks the error name as well as the class, so it survives duplicate copies of
this package in one bundle).

## Development

```bash
bun install
bun run verify     # typecheck -> lint -> test:unit -> build (the CI / publish gate)
```

Individual scripts:

| Script | Does |
| --- | --- |
| `bun run typecheck` | `tsc --noEmit` (type-check only) |
| `bun run lint` | ESLint over `src` |
| `bun run test:unit` | `vitest run` (jsdom) |
| `bun run test:watch` | `vitest` in watch mode |
| `bun run build` | `tsc` + `vite build` → bundled `dist/index.js` + `.d.ts`, then `fix-esm-imports.mjs` |
| `bun run clean` | remove `dist/` |

There is no `test` script. Tests run under vitest + jsdom (with
`@testing-library/react` `renderHook`); `src/test/fake-server.tsx` is a routed
fake of `music_api` used by the hook tests.

Publishing is automated: CI (`.github/workflows/ci-cd.yml`) publishes to GitHub
Packages on push to `main`/`develop`; `prepublishOnly` runs `clean` + `verify`.

## License

BUSL-1.1
