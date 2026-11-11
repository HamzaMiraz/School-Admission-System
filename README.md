# School Admission System

First-come-first-served online admission for a school. A parent applies for a class (seat is
**held** for a limited time), then pays the admission fee to **confirm** it. If the fee isn't paid
in time the seat is released automatically.

- **Backend:** ASP.NET Core (.NET 10) minimal API, EF Core, PostgreSQL — [backend/](backend/)
- **Frontend:** React 19 + TypeScript + Vite — [frontend/](frontend/)
- **Everything runs with Docker** — only Docker is needed on the machine.

## Run it

```bash
docker compose up
```

The first run builds the images (a few minutes). Then open:

| What | URL |
| --- | --- |
| **Web app (UI)** | **http://localhost:3000** |
| Backend API | http://localhost:8080 (e.g. http://localhost:8080/classes) |

Stop with `Ctrl+C` or `docker compose down`. Data is kept in the `pgdata` volume, so
`docker compose down` followed by `docker compose up` loses nothing
(`docker compose down -v` wipes it).

### Using the app

1. Type the student's **17-digit birth registration number** in the box at the top (it is
   remembered in the browser). Bangla digits are accepted.
2. **Create class** (school admin): choose the class (1–10) and the shift (Morning / Day), enter the
   seats, e.g. Class 6 + Morning Shift + 120. Every shift is its own class.
3. **Classes**: see total / on hold / confirmed / available seats (refreshes every 3 s) and press
   **Apply**.
4. **Application** page: status, live countdown, **Pay admission fee** (payment is simulated and
   always succeeds) and **Cancel application**. When the countdown ends the page shows EXPIRED and
   paying is disabled — no reload needed.
5. **My applications**: every application of the current student and its status.

### Configuration (environment variables)

| Variable | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays held before it expires |
| `ConnectionStrings__Default` | backend | compose: the `postgres` service | PostgreSQL connection string (in compose set it via `DB_CONNECTION`) |
| `CORS_ALLOWED_ORIGINS` | backend | `*` | Comma-separated origins allowed to call the API |
| `API_URL` | frontend container | `http://localhost:8080` | Backend URL used by the browser; applied at container start, no rebuild |
| `VITE_API_URL` | frontend (dev / build) | `http://localhost:8080` | Same, for `npm run dev` |

Example: `HOLD_DURATION_SECONDS=60 docker compose up` (PowerShell: `$env:HOLD_DURATION_SECONDS=60; docker compose up`).

## Run the tests

With Docker only:

```bash
docker compose --profile test run --rm backend-tests    # 31 xUnit tests against a real PostgreSQL
docker compose --profile test run --rm frontend-tests   # 26 Vitest + Testing Library tests
```

Without Docker (needs .NET 10 SDK / Node 20.19+ and a PostgreSQL server):

```bash
cd backend && dotnet test        # uses TEST_DB_CONNECTION, default Host=localhost;Username=postgres;Password=postgres
cd frontend && npm ci && npm test
```

Every backend test creates its own temporary database and drops it afterwards.

What the backend tests cover ([backend/tests/](backend/tests/SchoolAdmission.Api.Tests/)):

- **Concurrency:** 150 simultaneous applications for 10 seats → exactly 10 holds, 140 × `409`;
  the same with **two API instances** sharing one database; one student firing 30 applications at
  once gets one hold; 25 simultaneous confirms of one hold count one seat.
- Expiry (with a fake clock), confirm/cancel rules, ownership (`403`), validation (`400`), `404`s,
  and that response field names match the brief.

## Second backend process (bonus)

```bash
docker compose --profile multi up
```

starts another API on **http://localhost:8081** against the same database. Seat limits still hold
because all coordination happens inside PostgreSQL — see [ASSUMPTIONS.md](ASSUMPTIONS.md#concurrency).

## API

Base URL `http://localhost:8080`. Student identity: header `X-Student-Id` (17 digits).

| # | Method & path | Purpose | Success |
| - | --- | --- | --- |
| 1 | `POST /classes` `{ "name", "totalSeats" }` | Create class | `201` |
| 2 | `GET /classes` | All classes with seat counts | `200` |
| 3 | `GET /classes/{classId}` | One class's seat counts | `200` |
| 4 | `POST /classes/{classId}/holds` + `X-Student-Id` | Apply (hold a seat) | `201` |
| 5 | `GET /holds/{holdId}` | Application status | `200` |
| 6 | `POST /holds/{holdId}/confirm` + `X-Student-Id` | Pay fee, confirm admission | `200` |
| 7 | `DELETE /holds/{holdId}` + `X-Student-Id` | Cancel application | `204` |
| 8 | `GET /me/holds` + `X-Student-Id` | This student's applications | `200` |

Errors are JSON: `{ "error": "NO_SEATS_AVAILABLE", "message": "Sorry, all seats …" }`.
Codes: `400` invalid input, `403` someone else's application, `404` unknown id,
`409` no seats / already applied / expired / cancelled / already confirmed.

## Project layout

```
backend/
  src/SchoolAdmission.Api/
    Api/          endpoints, request/response contracts, error handling
    Services/     AdmissionService (all rules + locking), HoldExpiryWorker
    Domain/       SchoolClass, Hold
    Data/         DbContext, migrations (applied automatically on startup)
  tests/SchoolAdmission.Api.Tests/
frontend/
  src/pages/      Classes, Create class, Application, My applications
  src/api.ts      typed API client with human-readable errors
docker-compose.yml
```

## Local development (optional)

```bash
# backend on :8080 (uses appsettings.Development.json -> local PostgreSQL)
cd backend && dotnet run --project src/SchoolAdmission.Api
# frontend on :5173
cd frontend && npm install && npm run dev
```
