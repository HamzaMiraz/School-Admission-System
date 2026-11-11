# AI usage

## Tool

**Claude Code** (Anthropic, model Claude Opus 5.5) in VS Code, working directly in this repository.

## What I used it for

- Turning the brief and my feature requests into a design: API contract, data model and the
  PostgreSQL locking strategy.
- Writing most of the code: backend, frontend, EF Core migration, Dockerfiles and
  `docker-compose.yml`.
- Writing and running the backend integration tests (including concurrency) and the frontend tests.
- Drafting the README and ASSUMPTIONS.

## Where it went wrong, and how it was caught

1. **Wrong page after switching students.** After signing out and signing in as another student,
   the app reopened the previous student's page instead of the class list. I noticed it while
   testing the UI by hand; fixed so every sign-in starts on Classes, with a test added.
2. **Race at the expiry boundary (caught in design review, before coding).** The first plan locked
   the class row only when creating a hold. A hold expiring *while* being confirmed could then
   also be given to another student — one seat too many. Fixed by also locking the class row
   (`FOR SHARE`) during confirm and reading the clock only after locking.
3. **Possible deadlock (caught in design review).** The first plan for the expiry sweeper was a
   plain `UPDATE` over many rows, which could deadlock with requests. Changed to
   `FOR UPDATE SKIP LOCKED`.
4. **Making sure the concurrency tests are real.** The protecting lock was removed temporarily to
   check the tests would notice: they failed (13 holds for 10 seats; 18 for 15 across two API
   instances; and for the one-class rule, one student got several classes at once). Lock restored.
5. **NuGet version conflict.** EF Core Design 10.0.14 was added while Npgsql needs EF Core 10.0.4,
   which gave `MSB3277` build warnings. Caught at the first build; versions aligned.
6. **All frontend tests failed at first.** Node 25 has its own experimental `localStorage` that
   hides the test environment's one. Caught by running the tests; a small fallback was added to the
   test setup.
7. **Expired application flickered back to HELD.** When fresh data arrived, the ticking clock could
   be slightly older than the response. The "expires without reload" test caught it; fixed.
8. **Broken file encoding.** A PowerShell command rewrote a source file with a different encoding.
   Spotted in `git diff` and restored from git.
