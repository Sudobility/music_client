# @sudobility/music_client

> **Git policy — never auto-commit or auto-push.** Leave your work in the working
> tree. Run `git commit`, `git push` or `gh pr create`
> **only when the user explicitly asks in that turn** — and **do not use feature
> branches; always stay on the current branch**. Approval for an earlier change
> does not carry forward, and finishing a task is not permission to commit it.

The network, and only the network: the typed `MusicClient` for the Moosiac
music_api, its React Query hooks, and the generation-job and snapshot hooks
built on them (SudojoClient pattern). The shapes it sends and receives are
music_types'.

## Tech stack

- TypeScript strict, ESM. Source imports are **extensionless** (`entity_pages`'
  convention, not the `.js`-suffixed one most of the family uses). `tsc`
  (`noEmit`) type-checks; `vite build` emits the single bundled `dist/index.js`.
- `NetworkClient` DI from `@sudobility/types` — zero direct fetch anywhere.
- Types/schemas from `@sudobility/music_types`; React Query ≥5 peer.
- vitest + jsdom (+ `@testing-library/react` `renderHook`). Published to npm as
  `@sudobility/music_client` (restricted) via CI on push to main.
- **Runs on React Native** (`src/platform-free.test.ts`): no web-only global, no
  `import.meta`, `CompressionStream` gated behind `typeof`. `tsconfig` sets
  `lib: [..., "DOM"]` and eslint spreads `globals.browser` — needed because
  `fetch`/`Blob`/`FormData`/`AbortSignal` etc. live in `lib.dom.d.ts` but exist
  on RN too; the guard is the only thing that objects to `document.querySelector`.
  It greps raw source with comments stripped — reword a doc comment, not a rule.

## Commands

`bun install` · `bun run verify` (typecheck → lint → `test:unit` → build, same gate
as CI/`prepublishOnly`) · `bun run test:unit` (vitest once) · `bun run test:watch`
(vitest watch) · `bun run build` (tsc typecheck + `vite build` → `dist/index.js` +
`fix-esm-imports.mjs`). There is **no** `test` script — `bun run test` falls through to
bun's own runner, not vitest. Installs resolve `@sudobility/*` from GitHub Packages
(see `.npmrc`), so a `GH_PACKAGES_READ_TOKEN`-backed `~/.npmrc` auth line is needed.

## Architecture

- `src/network/music-client.ts` — `MusicClient(networkClient, baseUrl)`: one
  private `request<T>()` funnel; bearer token per call (never stored); envelope
  `{success,data,error,code}` unwrapping; typed-error mapping (429/QUOTA_EXCEEDED
  → `QuotaExceededError`, 502 AI codes → `AiOutputInvalidError`/`AiGenerationError`,
  404 → `ProjectNotFoundError`, else `ApiError`).
- `src/hooks/` — `useProjects` (optional `pollWhileGenerating`)/`useProject`/the
  CRUD + `useDuplicateProject`/`useCancelProjectGeneration`,
  `useGenerateScore`/`useRegenerateRegion`, `useSiteAdmin`,
  `useTranscriptionCapability`, `useProjectSnapshots`, `useScorePresets`; every
  hook takes a `MusicHookContext` (`hook-context.ts`).
- `src/projects/create-generated-project.ts` — `createGeneratedProject`: create,
  start the job, delete the project if the job is refused. One copy of what both
  dashboards did.
- `src/hooks/query-keys.ts` — `musicQueryKeys` factory; mutations invalidate
  through it. Stale times: projects list 2 min; project detail 0 (editor owns
  freshness). `src/test/fake-server.tsx` — routed fake of music_api (not built).

## Gotchas

- **Submission/vocabulary types are music_types'.** `NewProjectSubmission`,
  `GenerationErrorKind`, `PublishNames` moved below both this package and
  music_lib (it may not depend on music_lib); `src/__moved-to-types.test.ts` fails
  if any is declared or re-exported here again. `GenerationStore` stays structural
  (a shape music_lib satisfies, not vocabulary). A structural copy agrees with the
  original only until one of them is edited.
- **The hook context resolves its token per request.** `MusicHookContext.getToken`
  is awaited at send time (`requireHookToken`) — a captured token goes stale an
  hour in and is null at start-up until Firebase restores the session. `userId`
  (`null` = signed out) gates queries synchronously and keys per-account caches
  (`useSiteAdmin` keyed by it). The deprecated `token` field still works when
  `getToken` is absent.
- **Reads return the score; writes return metadata about it.**
  `createProject`/`updateProject` → `ProjectSaveResult`, snapshot writes →
  `SnapshotSummary`, none carrying a `score` — the caller still holds it.
  `useUpdateProject` *patches* the cached detail (keeping the request's score)
  rather than writing the score-less response into it.
- **`request()` gzips bodies over 1 KB** (sets `Content-Encoding`) — browsers never
  gzip sent bodies, so an autosave's uploaded score was paying full price. Gated on
  `CompressionStream` (absent on RN), falling back to the plain string on any
  failure. Uses `new Response(json).body`, **not** `Blob.stream()` (jsdom has none,
  which is exactly where the tests run).
- **`useScorePresets` is not gated on a token** — the route is public; gating it
  would empty the menu until Firebase restored the session. `null` context = no
  server (the native app opens local documents) and the query just does not run.
  `staleTime` Infinity. `getScorePresets` validates rather than trusts: an
  unrecognisable body answers an empty list, which is what the menu hides on.
- **`useProjectSnapshots` never re-downloads the project.** Create flushes, creates,
  re-reads list+status, hands `status.updatedAt` to `noteServerVersion`; open takes
  the score from `openSnapshot`'s own response. Blank names refused before anything
  is sent (including publish-on-create). `rename` reads the cache, not the render.
- **`isInsufficientCredits` checks the error's name as well as its class** — two
  copies of this package in one bundle make `instanceof` false across them, and the
  paywall silently becomes a toast.
- `duplicateProject` exists so a copy never crosses the wire; `getProjectStatus`
  carries `parentSnapshotId` so nothing fetches a whole project to read one id.
  music_lib's slices call `MusicClient` directly (their own abort/token
  discipline); the hooks exist for app-level views. `Optional<T>` permits null —
  normalize `response.data ?? undefined`.

## Related

`music_types` · `music_api` · `music_lib` · `music_app`
