# DigitalBalance @home

> **Challenge #6** — TUM Venture Labs Healthcare Innovation Program, SoSe 2026  
> In partnership with **Stiftung Kindergesundheit** (Foundation for Children's Health)

## The Problem

Digital media is shaping family life constantly and often unconsciously — leading to reduced emotional presence, weaker parent-child connections, and mental health risks for children. Approaches based on negative reinforcement (screen-time blockers, usage statistics, guilt) have proven ineffective at changing parental behaviour.

**Digital resilience doesn't start with children. It starts with parents.**

## The Solution

A mobile app that redirects parental attention toward their children through a gamified, activity-based system grounded in **positive reinforcement** — without framing itself as a screen-addiction tool.

Parents join a **group** (e.g., their child's school class or KITA) and participate in **challenges**: a curated set of offline activities to complete with their children over a defined period. Each completed activity is documented with a photo, progressively filling a personal **collage** — a growing memory album that doubles as a progress indicator.

Core design principles:

- **Positive reinforcement only** — the app never surfaces screen-time guilt or deficit metrics
- **No competitive comparison** — group progress is visible as an aggregate; families are never ranked against each other
- **Socioeconomic accessibility** — all suggested activities are free or very low cost
- **GDPR by design** — minimal data collection, granular consent at onboarding, full right to erasure

## Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the API + database)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Expo Go](https://expo.dev/go) on your iOS or Android device, or Xcode for the iOS simulator

### 1 — Start the server

```bash
cd server
docker compose up
```

This starts the FastAPI server on `http://localhost:8000` and PostgreSQL on port 5432. The API docs are available at `http://localhost:8000/docs`.

To stop: `docker compose down`. To rebuild after dependency changes: `docker compose up --build`.

### 2 — Start the client

```bash
cd client
npm install       # first time only
npx expo start
```

Press `i` to open the iOS simulator or scan the QR code with Expo Go on a physical device.

**Physical device:** the default API URL (`localhost`) only works in the iOS simulator. For a real device on the same network, set your machine's LAN IP in `client/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

### Verifying the connection

The Home screen shows **✓ Server connected** (green) when the client can reach the server, or **✗ Server unreachable** (red) when Docker Compose is not running.

---

## Stack

| Layer | Technology |
|---|---|
| Client | React Native (Expo), TypeScript, Expo Router |
| Server | Python 3.12, FastAPI, SQLAlchemy 2.x async |
| Database | PostgreSQL 16, Alembic migrations |
| Auth | Google OAuth 2.0 / OIDC |
| Photo storage | Hetzner Object Storage (S3-compatible, EU-hosted) |
| Deployment | Docker Compose, single EU server, Caddy (TLS) |

## Documentation

| Document | Description |
|---|---|
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | Milestone-by-milestone build plan (M0–M12) |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI 3.1 spec — the authoritative API contract |
| [`docs/planning/ux-brief.md`](docs/planning/ux-brief.md) | User journeys, onboarding, engagement strategy |
| [`docs/planning/data-model-brief.md`](docs/planning/data-model-brief.md) | Entities, relationships, lifecycle states |
| [`docs/planning/compliance-brief.md`](docs/planning/compliance-brief.md) | GDPR obligations and required decisions |
| [`docs/requirements.md`](docs/requirements.md) | Full SRS with FR-XXX / NFR-XXX requirements |
| [`docs/architecture.md`](docs/architecture.md) | C4 diagrams, key flows, technology decisions |

## Clinical Context

This project addresses **Challenge #6 "DigitalBalance @home — Digital resilience starts with parents"**, presented by:

- **Helen-Sarah Klaas** (Head of Digital Programmes) and **Angelika Lange** (Head of Innovation Hub Child and Adolescent Health) — Stiftung Kindergesundheit
- Clinical chair: **Prof. Dr. Berthold Koletzko** — Dr. von Hauner Children's Hospital Munich
- Clinical chair: **Dr. Katharina Bühren** — Medical Director, kbo-Heckscher Clinic for Child and Adolescent Psychiatry

The team follows the [Stanford Biodesign](https://biodesign.stanford.edu/) process (Identify → Invent → Implement).

## License

MIT — see [LICENSE](LICENSE).
