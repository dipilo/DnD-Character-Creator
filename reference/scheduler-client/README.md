# scheduler-client — reference only

A read-only copy of `client/` from `https://github.com/dipilo/DnD.git` (branch `master`,
commit `e0d2ec7`), imported during Phase 0 of `MERGE_PLAN.md`.

**This directory is not part of the build.** It is not an npm workspace, it is not linted,
and nothing in `app/` may import from it. It exists so the scheduler's behaviour can be read
beside the rewrite in Phase 4.

The plain-JSX client is being rewritten into TypeScript + shadcn under `app/src/pages/campaign/`
and `app/src/components/schedule/`, not ported. **Delete this directory in Phase 6.**

`public/zoople-clicker.html` was dropped on import; it is unrelated to the scheduler.
