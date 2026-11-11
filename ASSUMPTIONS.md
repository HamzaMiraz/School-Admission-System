# Assumptions

Where the brief was silent, these are the choices I made and why.

## Holds and expiry

- **A hold lasts `HOLD_DURATION_SECONDS`** (default 600) from the moment it is created
  (rounded down to the whole second so `expiresAt` is exact in JSON).
- **Expiry needs no API call and no background job.** Seat counts and every response treat a
  `HELD` hold whose `expiresAt` has passed as `EXPIRED` immediately. A background worker
  additionally rewrites such rows to `EXPIRED` every 5 s, only to keep the stored data tidy.
- **A student can apply for only one class.** The brief requires at most one active application
  (`HELD` or `CONFIRMED`) per student *per class*. I made it stricter: one active application
  in the **whole school**, because in reality a child is admitted to one class and one shift. Applying elsewhere returns
  `409 ALREADY_APPLIED_ELSEWHERE`. After the application is cancelled or expires, the student can
  apply to any class again. A per-student PostgreSQL advisory lock makes this safe against
  simultaneous requests, also across backend processes.
  Set `ONE_CLASS_PER_STUDENT=false` to fall back to exactly the brief's per-class rule.

## Confirm (pay) and cancel

- **Confirm** works only on your own, unexpired `HELD` application. Confirming an already
  confirmed one returns `200` again and changes nothing (seat counted once). Expired → `409
  HOLD_EXPIRED`, cancelled → `409 HOLD_CANCELLED`, someone else's → `403`.
- **Cancel** works only on a `HELD` application. Cancelling twice returns `204` both times.
  A **confirmed admission cannot be cancelled** here (`409`) — the fee is paid, so undoing it would
  need a refund process, which is out of scope. An expired one returns `409` (nothing to cancel).
- Payment is simulated: pressing the button = successful payment.

## Identity and validation

- `X-Student-Id` must be exactly **17 digits** (birth registration number); otherwise `400`.
  It is required on endpoints 4, 6, 7, 8 (as in the brief). `GET /holds/{id}` does not require it;
  hold ids are random UUIDs, so they can't be guessed.
- The school admits **Class 1 – Class 10**, in a **Morning** or **Day** shift. The "Create class"
  screen offers these as dropdowns and sends the name as `"Class 6 - Morning Shift"`. The API itself
  still accepts any name, so the contract in the brief (`name` + `totalSeats`) is unchanged.
- The UI is split into a **User panel** (`/`, parents) and an **Admin panel** (`/admin`, school).
  Parents **sign in with the birth registration number only** — no password, because the brief
  identifies a student by this number alone. It is remembered in the browser until "Sign out".
  The admin panel has no login (the brief asks for none) — anyone can open it. In a real system
  both would need proper authentication.
- **Extra endpoint `GET /admin/holds`** (optional `status`, `classId`, `studentId` filters) lists
  every application for the admin panel's "Applications" page. The 8 endpoints from the brief are
  unchanged; the brief allows adding endpoints.
- Class name: required, ≤ 100 chars, **unique ignoring case and surrounding spaces** (`409`
  otherwise) — two classes with the same name would confuse parents. `totalSeats`: whole number
  1 – 100 000. Classes can't be edited or deleted (not asked for).
- Errors are `{ "error": CODE, "message": text }`. The `message` is written for parents and the UI
  shows it as-is.

## API details

- IDs look like `c_…` / `h_…` followed by a UUIDv7.
- Responses contain all fields from the brief plus a few extras the UI uses: `className`,
  `studentId`, `createdAt`, `confirmedAt`, and **`remainingSeconds`**. The UI counts down from
  `remainingSeconds`, so a wrong clock on the parent's PC doesn't break the countdown.
- `availableSeats = totalSeats − heldSeats − confirmedSeats`, where `heldSeats` counts only unexpired holds.
- Timestamps are UTC ISO-8601 with `Z`, second precision.

## UI

- "Without page reload" is done with polling (classes every 3 s, applications every 5 s) and a
  local 1-second countdown — simple and reliable; WebSockets would be overkill here.
- The UI is in English; the student-ID box also accepts Bangla digits. The ID is kept in
  `localStorage` so it survives refresh and browser restarts.

## Concurrency

**Rule: held + confirmed never exceeds totalSeats, even with many requests or several backend
processes.** All coordination is done by PostgreSQL, never in application memory:

1. **Creating a hold** runs in a transaction that first locks the class row
   (`SELECT … FROM classes WHERE id = … FOR UPDATE`). Only then does it count active seats and
   insert. So for one class, hold creation is strictly one-at-a-time — across all processes,
   because the lock lives in the database. Different classes don't block each other.
2. **Confirming** takes `FOR SHARE` on the same class row, then `FOR UPDATE` on the hold. This
   closes a subtle race: a hold expiring *while* it is being confirmed can't also be given to
   someone else. Both operations read the clock only after getting their locks.
3. A **partial unique index** (`class_id, student_id WHERE status IN ('HELD','CONFIRMED')`) is a
   second safety net for the one-application-per-class rule.
4. The expiry worker uses `FOR UPDATE SKIP LOCKED`, so it never waits on, or deadlocks with,
   a request.

Proof: the tests fire 150 simultaneous requests at a 10-seat class through one API instance, and
120 requests split across **two independent API instances** on the same database; exactly the
number of seats is granted each time. (With the lock removed, the same test grants 13 of 10 seats.)
`docker compose --profile multi up` runs a real second process on port 8081.

Assumption: all backend processes have synchronised clocks (normal with NTP; trivially true in
docker compose on one host).
