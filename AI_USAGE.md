# AI usage

## Tool

**Claude Code** (Anthropic, model Claude Opus 5.5) in VS Code, working directly in this repository.

## How I worked with it

I treated the AI as a fast pair programmer: I decided what the system should do, it wrote most of
the code and tests, and I ran, tried and checked the result, then asked for changes.

**What I did**

- Read the brief and set the direction and constraints: the required stack, Docker-only startup,
  and keeping the project self-contained in one folder.
- Set up and checked the environment: development against my local PostgreSQL, Docker's data
  disk moved off my system drive, and verifying `docker compose up`, the tests in Docker and data
  surviving `docker compose down` / `up`.
- Defined the product beyond the brief after using the first version myself:
  - choosing **Class 1–10** and the **shift** from dropdowns instead of typing a class name;
  - separate **User panel** and **Admin panel**;
  - **sign in / sign out** with the birth registration number, so each student sees their own pages;
  - an admin **Applications** page showing each student's class, shift, status and whether the fee
    is paid;
  - a **sorted** class list with **class/shift search** and clear Available / Full status;
  - the rule that **a student can apply for only one class**.
- Tested the UI by hand with several student numbers and reported problems I found (see below).
- Reviewed the documentation and decided what goes into the submission.

**What the AI did**

- Proposed the design (API contract, data model, PostgreSQL locking strategy) and wrote most of
  the code: backend, frontend, EF Core migration, Dockerfiles, `docker-compose.yml`.
- Wrote and ran the backend integration tests (including concurrency) and the frontend tests.
- Drafted the README and ASSUMPTIONS, which I then reviewed.

## Where things went wrong, and how they were caught

1. **Wrong page after switching students (found by me in manual testing).** After signing out and
   signing in as another student, the app reopened the previous student's page instead of the
   class list. Fixed so every sign-in starts on Classes, and a test was added for it.
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
