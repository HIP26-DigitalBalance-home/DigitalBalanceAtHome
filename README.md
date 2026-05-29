# DigitalBalanceAtHome
=======
# DigitalBalance @home

> **Challenge #6** — TUM Venture Labs Healthcare Innovation Program, SoSe 2026  
> In partnership with **Stiftung Kindergesundheit** (Foundation for Children's Health)

## The Problem

Digital media is shaping family life constantly and often unconsciously — leading to reduced emotional presence, weaker parent-child connections, and mental health risks for children. Approaches based on negative reinforcement (screen-time blockers, usage statistics, guilt) have proven ineffective at changing parental behaviour.

**Digital resilience doesn't start with children. It starts with parents.**

## The Solution

A mobile app that redirects parental attention toward their children through a gamified, activity-based system grounded in **positive reinforcement** — without framing itself as a screen-addiction tool.

Parents join a **group** (e.g., their child's school class or KITA) and participate in **challenges**: a curated set of offline activities to complete with their children over a defined period. Each completed activity is documented with a photo, progressively filling a shared **collage** — a growing memory album that doubles as a progress indicator.

Core design principles:

- **Positive reinforcement only** — the app never surfaces screen-time guilt or deficit metrics
- **No competitive comparison** — group progress is visible as an aggregate; families are never ranked against each other
- **Socioeconomic accessibility** — all suggested activities are free or very low cost; the app must not expose resource disparities between families
- **GDPR by design** — minimal data collection, granular consent at onboarding, full right to erasure

## Clinical Context

This project addresses **Challenge #6 "DigitalBalance @home — Digital resilience starts with parents"**, presented by:

- **Helen-Sarah Klaas** (Head of Digital Programmes) and **Angelika Lange** (Head of Innovation Hub Child and Adolescent Health) — Stiftung Kindergesundheit
- Clinical chair: **Prof. Dr. Berthold Koletzko** — Dr. von Hauner Children's Hospital Munich
- Clinical chair: **Dr. Katharina Bühren** — Medical Director, kbo-Heckscher Clinic for Child and Adolescent Psychiatry

The team follows the [Stanford Biodesign](https://biodesign.stanford.edu/) process (Identify → Invent → Implement).

## Status

Planning and documentation phase — no application code yet.

## Documentation

| Document | Description |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Software Requirements Specification — all `FR-XXX` / `NFR-XXX` requirements with P1/P2/P3 priority tiers |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, C4 diagrams, module map, key flows (auth, photo upload, group invite, GDPR erasure), technology decisions |

## Planned Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x async, asyncpg |
| Database | PostgreSQL 16, Alembic migrations |
| Auth | Google OAuth 2.0 / OIDC |
| Storage | S3-compatible object storage, EU-hosted (AWS S3 eu-central-1 or Hetzner — TBD) |
| Client | Mobile-first webapp or native iOS app (framework TBD) |
| Deployment | Docker Compose, single EU server, Caddy (TLS + reverse proxy) |

## License

MIT — see [LICENSE](LICENSE).
