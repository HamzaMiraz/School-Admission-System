# AI usage

## Tool

**Claude Code** (Anthropic, model Claude Opus 5.5) inside VS Code, working directly in this repository.

## What it was used for

- Reading the brief and turning it into a design: API contract, data model, locking strategy.
- Writing most of the code: backend (endpoints, `AdmissionService`, EF Core migration, expiry
  worker), frontend (pages, API client, hooks), Dockerfiles, `docker-compose.yml`, and the docs.
- Writing the backend integration tests (incl. concurrency) and the frontend tests, and running them.

I decided the environment questions (local PostgreSQL for development, keeping all caches inside
the project folder, Docker data location) and reviewed the result.

## Where the AI got things wrong, and how it was caught

1. **Race at the expiry boundary (caught at design stage, before coding).** The first plan locked
   the class row only when creating a hold. Walking through the timeline showed a gap: a hold that
   expires *while* it's being confirmed could also be handed to another student → one seat too
   many. Fixed by also locking the class row (`FOR SHARE`) during confirm and reading the clock only
   after locking.
2. **Possible deadlock (caught at design stage).** The first plan for the expiry sweeper was a plain
   `UPDATE` over many rows, which could deadlock with requests updating the same rows. Changed to
   `FOR UPDATE SKIP LOCKED`.
3. **Is the concurrency test real?** To be sure it doesn't pass by luck, the row lock was
   removed temporarily: the test then failed (13 holds for 10 seats; 18 for 15 across two
   instances). Lock restored.
4. **NuGet version conflict.** It added `EF Core Design 10.0.14` while Npgsql needs EF Core
   10.0.4 → build warnings (`MSB3277`). Caught at the first build; versions aligned.
5. **Every frontend test failed at first.** Node 25 has its own experimental `localStorage` that
   hides jsdom's. Caught by running the tests; a small in-memory fallback is now in the test setup.
6. **UI bug found by a test.** When a fresh server response arrived, the ticking clock could be a
   little older than the response, so an expired application flickered back to `HELD` (and the
   countdown showed one second too many). The "expires without reload" test caught it; fixed by never
   evaluating a hold at a time earlier than when it was received.
7. **Broken file encoding.** A PowerShell command used during the step-3 check rewrote a source
   file with a different encoding (mangled `—` characters, added a BOM). Spotted in `git diff` and
   restored from git.
