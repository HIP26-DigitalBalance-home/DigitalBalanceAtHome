---
name: design-architecture
description: System context, container architecture, key flows, security model, and technology decisions
type: design
last_updated: 2026-06-11
---

# Design: Architecture

Source: `docs/architecture.md`

---

## Architectural Goals

- **Simplicity first** — single Docker Compose server for prototype
- **GDPR by design** — consent, erasure, and data residency are first-class concerns
- **Stateless API** — all state in PostgreSQL; any replica can serve any request
- **Observable** — structured logs with request correlation IDs from day one
- **Scalability path clear** — avoid patterns that prevent future horizontal scaling

---

## System Boundary

External actors: Parent, Foundation Admin  
External services: Google Identity (OIDC), S3-compatible object storage (Hetzner, EU-hosted), Weather API (TBD), Email service (TBD)

---

## Container Architecture

| Container | Technology | Responsibility |
|---|---|---|
| Mobile Client | React Native (Expo 54), web target | UI, camera access, API calls over HTTPS |
| API Server | Python 3.12 / FastAPI, stateless | Auth, business logic, file orchestration, DB access |
| Primary Database | PostgreSQL 16 | All application state |
| Background Worker | FastAPI `BackgroundTasks` (prototype) / Celery (MVP) | Async image compression |

The client **never accesses the database or S3 directly** — all operations go through the API.

---

## API Layer Architecture (4 strict layers)

```
Routes (app/api/) → Services (app/services/) → Repositories (app/repositories/) → Database
```

- **Routes**: HTTP only — validate input (Pydantic), call one service method, return response. No business logic.
- **Services**: all business logic, domain rules, orchestration. Raise domain exceptions (e.g. `GroupNotFound`) — never `HTTPException`.
- **Repositories**: data access only. No business rules. One class per aggregate root.
- **Models/Schemas**: strictly separated — ORM models never leave the service layer; Pydantic schemas never enter a repository.

---

## Key Flows

### Authentication (Google OIDC)
Client opens Google consent → receives authorization code → sends to `POST /auth/google/callback` → server verifies ID token against Google public keys → upserts User → issues JWT access token (15 min) and refresh token (7 days, rotated on use) → client stores in `expo-secure-store`.

**Note:** On web (Expo Go, SDK 54), `expo-secure-store` is unavailable; falls back to `AsyncStorage` for development.

**Two OAuth flows in use (as-built):**
- Web: `ResponseType.IdToken` — client sends `id_token` directly to server (verified via Google tokeninfo API)
- Native: authorization code + PKCE — server exchanges with Google using client secret

### Photo Upload and Async Compression
Client POSTs image → API validates MIME + size (≤10 MB) → uploads raw to S3 `raw/{family_id}/{uuid}.jpg` → creates Completion `status="processing"` → returns `202 {completion_id}` → `BackgroundTasks` compresses (Pillow 1200px, JPEG 85%) → uploads to `photos/{family_id}/{uuid}.jpg` → deletes raw → updates Completion `status="ready"`.

Client polls `GET /completions/{id}` every 3 s; stops after 60 s. Pre-signed URLs (15-min TTL) embedded in challenge responses when `status="ready"`.

**Web FormData note:** On web, `expo-image-picker` returns a `blob:` URI. Must use `fetch(blobUri) → Blob → form.append(blob, filename)` — the React Native `{uri, type, name}` shorthand silently appends `"[object Object]"` on web.

### Group Invite
Admin generates invite → `POST /groups/{id}/invites` → returns `invite_url` → shared out-of-band → new parent taps link → `POST /groups/join {token}` → validates (single-use, not expired) → creates GroupMembership for the parent's family → marks token used.

---

## Security Model

| Concern | Control |
|---|---|
| Auth | Google OIDC; server-issued JWT (15 min access, 7 day refresh rotated) |
| Authorization | Enforced in service layer per request; `get_current_user` dependency on all protected routes |
| Transport | TLS 1.2+ everywhere (Caddy for external; asyncpg TLS for DB in production) |
| Photo access | Private S3 bucket; pre-signed URLs with 15-min TTL; group membership validated before URL issued |
| Rate limiting | Auth endpoints: 10 req/IP/min (sliding window, in-process for prototype) |
| Input validation | Pydantic v2 on all request bodies; SQLAlchemy parameterized queries (no raw SQL) |
| Secrets | Environment variables injected at runtime; never committed |

---

## Deployment (Prototype)

Single EU server (Hetzner or similar). Caddy for TLS termination and reverse proxy. Docker Compose for API + DB. GitHub Actions deploys on merge to `main`: build → push Docker image → SSH `docker compose pull && docker compose up -d`.

S3: Hetzner Object Storage (EU-hosted, confirmed). Endpoint URL must include `https://` scheme (boto3 requirement).

---

## Technology Decision Highlights

| Choice | Rationale |
|---|---|
| FastAPI | Native async, automatic OpenAPI, Pydantic v2, strong typing |
| SQLAlchemy 2.x async | Most mature async ORM; Alembic native support |
| PostgreSQL 16 | UUID functions, ACID, GDPR-friendly; hard-delete model fits erasure requirements |
| Google OIDC | Zero credential management for prototype |
| Hetzner Object Storage | EU-hosted; S3-compatible; consolidates with compute server; cheaper than AWS |
| Caddy | Automatic TLS renewal; simpler config than nginx |
| ruff | Single linter/formatter replacing black + flake8 + isort |
| FastAPI BackgroundTasks | Sufficient for prototype; Celery is the clear upgrade path |

See → [design/data-model.md](data-model.md)
