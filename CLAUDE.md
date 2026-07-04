# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing all three components of the DigitalBalance @home project:

```
DigitalBalanceAtHome/
├── client/          React Native (Expo) mobile app
├── server/          FastAPI + PostgreSQL backend  ← created in Milestone 0
├── docs/
│   ├── planning/    UX brief, data model, compliance brief
│   ├── implementation-plan.md
│   ├── requirements.md
│   └── architecture.md
└── CLAUDE.md
```

## Project

**DigitalBalance @home** — a family activity challenge app that encourages parents to spend intentional offline time with their children. Parents join groups, participate in activity challenges, and document completions with photos that fill a shared collage. Built for [Stiftung Kindergesundheit](https://www.kindergesundheit.de/) as part of the TUM Healthcare Innovation Program (Challenge #6, SoSe 2026).

## Stack

| Component | Technology |
|---|---|
| Client | React Native, Expo 54, TypeScript, Expo Router |
| Server | Python 3.12, FastAPI, SQLAlchemy 2.x async, asyncpg |
| Database | PostgreSQL 16, Alembic migrations |
| Auth | Google OAuth 2.0 / OIDC |
| Photo storage | Hetzner Object Storage (S3-compatible, EU-hosted) |
| Deployment | Docker Compose, single EU server, Caddy (TLS) |
| Server linter | ruff |

## Client (`client/`)

### Commands
```bash
cd client
npm install          # Install dependencies
npx expo start       # Start dev server (press i for iOS, a for Android)
npx expo run:ios     # Development build for iOS (required for camera features from M7)
npm test             # Run tests
```

### Architecture
- **Expo Router** file-based routing; tabs in `app/(tabs)/`
- **`StandardProvider`** wraps the app; access via `useStandard()` — never import backends directly
- **`lib/api/client.ts`** — axios instance with auth header injection and 401 refresh logic
- **`constants/theme.ts`** — colour tokens, spacing, typography; all UI uses these, no hardcoded values
- Every async effect needs `let cancelled = false` to prevent state updates after unmount
- Use `<Redirect href="..." />` for auth guards, never `router.replace()`

## Server (`server/`)

### Commands
```bash
cd server
docker compose up            # Start API + PostgreSQL
docker compose up --build    # Rebuild after dependency changes
alembic upgrade head         # Apply migrations
alembic revision --autogenerate -m "description"  # New migration
ruff check .                 # Lint
ruff format .                # Format
pytest                       # Run tests
pytest tests/path/to/test.py::test_name  # Single test
```

### Spec-driven workflow

`docs/openapi.yaml` is the **authoritative API contract**. This is a hard rule:

- **Never add, remove, or change an API endpoint, request field, or response field without first updating `docs/openapi.yaml`.**
- `server/app/schemas/generated.py` is generated from the spec — **never edit it by hand**.
- The spec and the implementation must stay in sync at all times. If they diverge, the spec wins.

**Mandatory sequence for any backend change** (new endpoint, modified response, deleted route, new field):
1. Edit `docs/openapi.yaml` — add/modify/remove paths, parameters, and schemas
2. Run codegen (from repo root) to regenerate `server/app/schemas/generated.py`
3. Implement or update the route handler importing types from `generated.py`
4. Run `pytest` to confirm nothing broke

**Codegen command** (run from repo root):
```bash
datamodel-codegen \
  --input docs/openapi.yaml \
  --input-file-type openapi \
  --output server/app/schemas/generated.py \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated \
  --field-constraints \
  --target-python-version 3.12
```

**Contract testing** (run from `server/` with Docker Compose running):
```bash
pip install -r requirements-dev.txt
schemathesis run ../docs/openapi.yaml --base-url http://localhost:8000
```

### Architecture
Four strict layers — dependencies flow downward only:

```
routes (app/api/) → services (app/services/) → repositories (app/repositories/) → database
```

- **Routes**: HTTP concerns only — validate input (Pydantic), call one service method, return response
- **Services**: all business logic; raise domain exceptions (e.g., `GroupNotFound`), never `HTTPException`
- **Repositories**: data access only, no business rules; one class per aggregate root
- **Models** (`app/models/`) and **schemas** (`app/schemas/`) are strictly separate — ORM models never leave the service layer

Key invariants:
- All PKs: UUID (`gen_random_uuid()`), never sequential integers
- All timestamps: `TIMESTAMPTZ`, stored in UTC
- No soft deletes — hard deletes only (GDPR compliance)
- JWT access tokens: 15 min; refresh tokens: 7 days, rotated on use
- Photos never served directly through the API — clients receive pre-signed S3 URLs (15-min TTL). URLs are embedded inline in challenge and completion responses when `status="ready"`; `GET /photos/{completion_id}/url` also exists for explicit re-fetching
- Paid activities filtered at the service layer, not by a DB constraint

## Key Domain Concepts

- **User (Parent)**: the only authenticated account type. Holds admin roles at two independent levels: family admin and group admin.
- **Family**: the primary unit of participation (≥1 parents). Children, group memberships, and challenge completions all belong to a Family. A second parent joins via a FamilyInvite link.
- **ChildProfile**: belongs to a Family, not to an individual parent. Any admin parent in the family can manage child profiles.
- **Activity**: a curated offline task with age range, cost indicator, season/weather metadata.
- **Group**: invite-only set of **families** (not individual parents). When a parent joins a group, their whole family joins. Group admins are individual parents (tracked separately from family membership).
- **Challenge**: a set of activities with a start/end date. `group_id` is nullable — null means a personal/family challenge accessible to all parents in the creating parent's family.
- **Collage**: a family's collage is derived at query time from their Completions for a Challenge. Each family fills one shared collage — either parent can complete slots.
- **Completion**: one per `(family_id, challenge_activity_id)`; `completed_by_user_id` tracks which parent did it. Group aggregate view shows "X of Y **families** completed."

## Project Wiki Schema

The project wiki lives at `wiki/` and follows a three-layer architecture:

```
wiki/
  raw/                    # Immutable source documents — never modify
    interviews/           # Parent and stakeholder interviews
    papers/               # Research papers and clinical literature
    observations/         # Field notes and usability observations
    competitors/          # Competitor analysis and screenshots
    regulatory/           # Legal and compliance documents
    media/                # Press, social media, other media
  pages/                  # AI-maintained wiki pages — only write here
    index.md              # Catalog of all pages (updated on every ingest)
    log.md                # Append-only chronological activity log
    overview.md           # Project summary, mission, current stage
    stakeholders/         # One page per stakeholder group
    evidence/             # Clinical, behavioral, and design evidence
    landscape/            # Competitive and market analysis
    design/               # User journeys, data model, architecture, roadmap
    regulatory/           # Compliance landscape and open decisions
    questions/            # Living list of open questions
```

### Domain and Key Terminology

- **Parent**: only authenticated user type; German-speaking adult with ≥1 child
- **Family**: primary unit of participation; children and completions belong to Family, not User
- **ChildProfile**: non-account child representation; belongs to Family; never in group-visible responses
- **Group**: invite-only set of families; group admins are individual parents
- **Challenge**: set of activities with start/end date; `group_id` nullable (null = personal/family)
- **Collage**: derived at query time from Completions for (family_id, challenge_id); not stored
- **Completion**: one per (family_id, challenge_activity_id); states: processing, ready, self_reported
- **ConsentRecord**: append-only GDPR consent log; 3 types: data_storage, photo_processing, location

### Page Naming Conventions

- Filenames: lowercase kebab-case (e.g., `kita-staff.md`, `open-questions.md`)
- Stakeholder pages: one per distinct stakeholder group
- Evidence pages: one per topic area (problem framing, design principle, clinical finding)
- Design pages: one per design concern (user journeys, data model, architecture, roadmap)
- Cross-references use standard Markdown links: `[label](relative/path.md)`

### Ingest Workflow

When the user adds a source (interview, paper, observation, competitor, regulatory doc):
1. Save to the correct `wiki/raw/` subfolder with a dated descriptive filename (`YYYY-MM-DD-description.md`)
2. Read the source completely
3. Discuss key takeaways with the user
4. Write or update a summary page in `wiki/pages/`
5. Update every relevant page across the wiki (a single source may touch 5–15 pages)
6. Flag contradictions with existing wiki content explicitly
7. Update `wiki/pages/index.md`
8. Append an entry to `wiki/pages/log.md`

### Query Workflow

When answering a question about the project:
1. Read `wiki/pages/index.md` to find relevant pages
2. Read those pages and synthesise an answer with citations
3. Offer to file useful synthesis as a new wiki page

### Stage and Priorities

Current stage: **active development prototype** (M9 of 13 complete). Wiki depth priorities:
- **High priority:** compliance open decisions (D2–D5, D7), M10–M12 implementation context, UX risk validation
- **Medium priority:** stakeholder evidence from user testing once it begins
- **Low priority:** landscape analysis (no competitor research conducted yet)

---

## Design Constraints

- **No competitive comparison** — no leaderboards, no per-family rankings; group progress is aggregate only
- **Positive reinforcement only** — no negative framing, no "you're behind" language
- **Paid activities** are never surfaced as primary suggestions
- **Social sharing is opt-in per completion** — default is private
- **GDPR by design** — right to erasure within 30 days; data export; consent stored with timestamp + policy version; no precise GPS; no third-party analytics SDKs in the client
- **Socioeconomic accessibility** — activities must be free or low-cost

## Admin Commands

### Wipe object storage (Hetzner S3)
Deletes every object in the bucket permanently. Run this before re-seeding to avoid stale/orphaned photos from previous runs.

```bash
# Inside Docker Compose (recommended — picks up env vars automatically):
docker compose -f server/docker-compose.yml exec api \
  sh -c "PYTHONPATH=/app python /app/scripts/clear_object_storage.py"

# Local (reads env vars from server/.env):
set -a && source server/.env && set +a
PYTHONPATH=server python server/scripts/clear_object_storage.py
```

### Refresh seed photos
Downloads 12 high-quality Unsplash photos (1200×900) to `server/scripts/seed_photos/`. Re-run any time you want fresh images.

```bash
bash server/scripts/download_seed_photos.sh
```

### Re-seed demo data
After wiping S3 and refreshing photos, re-seed:

```bash
docker compose -f server/docker-compose.yml exec api \
  sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"
# or trigger via the app: POST /dev/seed
```

### Reset demo database (production server — run yourself over SSH)

**Option A — script** (requires the image to have been built after `reset_demo_data.py` was added):
```bash
# SSH into the server, then:
docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/reset_demo_data.py"
```

**Option B — direct SQL** (works on any deployed version, no rebuild needed):
```bash
# SSH into the server, then:
docker compose exec db psql -U postgres digitalbalance
```
Paste this inside psql — deletes all demo data, keeps real user accounts:
```sql
BEGIN;
DELETE FROM completions;
DELETE FROM challenge_activities;
DELETE FROM challenges;
DELETE FROM group_admins;
DELETE FROM group_memberships;
DELETE FROM groups;
DELETE FROM child_profiles;
DELETE FROM family_memberships;
DELETE FROM families;
DELETE FROM users WHERE google_sub LIKE 'mock_%';
DELETE FROM consent_records;
COMMIT;
```

**Full nuke** (wipes everything including your own account — you'll onboard fresh next login):
```sql
TRUNCATE completions, challenge_activities, challenges,
         group_admins, group_memberships, groups,
         child_profiles, family_memberships, families,
         consent_records, users
CASCADE;
```

### ⚠️ Restore activities after a full nuke

The full nuke (and `docker compose down -v`) empties the `activities` table because Alembic records the migration as already run and won't re-insert the data. Run this after any full nuke to restore the 30 seed activities:

```bash
docker compose exec db psql -U postgres digitalbalance
```

```sql
INSERT INTO activities (title, description, estimated_duration_minutes, age_min, age_max, cost_indicator, season_relevance, weather_suitability, is_partner_content, language)
VALUES
  ('Gemeinsam Plätzchen backen','Teig anrühren, ausstechen und verzieren — Kinder können bei jedem Schritt helfen und das Ergebnis genießen.',60,3,12,'free',NULL,NULL,false,'de'),
  ('In den Park gehen','Zum nächsten Spielplatz oder ins Grüne gehen — rennen, entdecken und gemeinsam frische Luft schnappen.',60,3,12,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny','cloudy'],false,'de'),
  ('Eine Kissenburg bauen','Kissen, Decken und Stühle zur besten Burg im Haus aufbauen und dann darin lesen oder spielen.',45,3,8,'free',NULL,NULL,false,'de'),
  ('Gemeinsam zeichnen und malen','Ein Thema aussuchen — Tiere, Superhelden, das eigene Zuhause — und Seite an Seite Kunstwerke schaffen.',45,3,12,'free',NULL,NULL,false,'de'),
  ('Etwas in einen Topf pflanzen','Schnell wachsende Samen wählen (Kresse, Sonnenblumen, Kräuter) und in den nächsten Wochen beim Wachsen zuschauen.',30,5,12,'low_cost',ARRAY['spring','summer'],ARRAY['sunny','cloudy'],false,'de'),
  ('Papierflieger basteln','Verschiedene Modelle falten, draußen ausprobieren und schauen, wessen Flieger am weitesten kommt.',30,5,12,'free',NULL,NULL,false,'de'),
  ('Gemeinsam eine Geschichte erfinden','Abwechselnd einen Satz hinzufügen und gemeinsam die verrückteste Geschichte aller Zeiten aufbauen.',30,3,10,'free',NULL,NULL,false,'de'),
  ('Naturspaziergang – 10 Dinge entdecken','Ein Thema festlegen (gelbe Dinge, runde Dinge, Dinge die gut riechen) und gemeinsam auf die Suche gehen.',60,3,12,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny','cloudy'],false,'de'),
  ('Gemeinsam ein Gericht kochen','Das Kind bei einem echten Rezept mitmachen lassen — abmessen, rühren und probieren inklusive.',60,6,12,'free',NULL,NULL,false,'de'),
  ('Ein Brettspiel spielen','Ein Familienfavorit hervorkramen oder ein neues Spiel kennenlernen — richtig ernst nehmen oder absichtlich schlecht spielen.',60,5,12,'free',NULL,NULL,false,'de'),
  ('Ein Puzzle lösen','Gemeinsam an einem Puzzle arbeiten, das etwas zu schwierig ist — die Freude am Ende ist es wert.',45,4,12,'free',NULL,NULL,false,'de'),
  ('Eine Papier-Collage basteln','Alte Zeitschriften, Geschenkpapier oder Buntpapier zerreißen und zu einem Bild zusammenkleben.',30,3,12,'free',NULL,NULL,false,'de'),
  ('Die Bücherei besuchen','Gemeinsam Bücher aussuchen, die Bibliothekarin um eine Empfehlung bitten und gemütlich schmökern.',90,3,12,'free',NULL,NULL,false,'de'),
  ('Zu Lieblingsliedern tanzen','Abwechselnd einen Song aussuchen und tanzen, als würde niemand zuschauen — denn niemand tut es.',30,3,12,'free',NULL,NULL,false,'de'),
  ('Selbstgemachte Knete herstellen','Mehl, Salz, Wasser und Lebensmittelfarbe mischen und stundenlangen Bastelspaß zaubern.',30,3,8,'free',NULL,NULL,false,'de'),
  ('Wolken beobachten und Formen entdecken','Im Gras liegen und laut rufen, was man sieht — Drachen, Gesichter, ein Hund der einen Hut frisst.',30,3,12,'free',ARRAY['spring','summer','autumn'],ARRAY['cloudy','sunny'],false,'de'),
  ('Blätter sammeln und pressen','Die schönsten Herbstblätter sammeln, in einem schweren Buch pressen und dann aufhängen.',45,3,12,'free',ARRAY['autumn'],NULL,false,'de'),
  ('Einen Schneemann bauen','Klassisches Winterabenteuer — Schneekugeln rollen, einen Schal und eine Karotte, dann ein Foto vor dem Tauen.',45,3,12,'free',ARRAY['winter'],NULL,false,'de'),
  ('Heiße Schokolade selbst machen','Echte Schokolade schmelzen, Milch langsam erwärmen und etwas Zimt hinzufügen — schlägt Instantpulver jedes Mal.',20,3,12,'free',ARRAY['winter','autumn'],NULL,false,'de'),
  ('Sterne beobachten im Garten','Nach Einbruch der Dunkelheit eine Decke nach draußen tragen, Sternbilder suchen und neue erfinden.',45,5,12,'free',ARRAY['summer'],ARRAY['sunny'],false,'de'),
  ('Ein Vogelhäuschen bauen','Einen Tannenzapfen oder eine leere Flasche mit Samen füllen und dort aufhängen, wo man Vögeln beim Fressen zusehen kann.',45,5,12,'low_cost',ARRAY['autumn','winter'],NULL,false,'de'),
  ('Schnitzeljagd im Park','Eine Liste mit Dingen zum Finden oder Fotografieren schreiben — eine Feder, etwas Blaues, einen lustig geformten Stein.',60,4,12,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny','cloudy'],false,'de'),
  ('Schattentheater','Mit einer Taschenlampe und den Händen ein Schattenspiel an der Wand oder auf einem Laken aufführen.',30,3,10,'free',NULL,NULL,false,'de'),
  ('Ein Buch gemeinsam vorlesen','Abwechselnd je ein Kapitel aus einem Buch vorlesen, das etwas über dem Niveau des Kindes liegt.',30,4,12,'free',NULL,NULL,false,'de'),
  ('Pfannkuchen zum Frühstück backen','Einfacher Teig, eine heiße Pfanne und Toppings nach Wahl des Kindes — ein garantiertes Wochenend-Highlight.',30,3,12,'free',NULL,NULL,false,'de'),
  ('Einen Brief an die Großeltern schreiben','Ein echter Brief, im Umschlag mit Briefmarke — Großeltern heben sie für immer auf.',45,6,12,'free',NULL,NULL,false,'de'),
  ('Ein Picknick vorbereiten und draußen essen','Gemeinsam Essen einpacken, einen Platz in der Nähe aussuchen und dort essen — draußen schmeckt alles besser.',90,3,12,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny'],false,'de'),
  ('Fangen oder Frisbee spielen','Kein Zubehör außer einem Ball oder einem Frisbee — ein einfaches Spiel, das trotzdem alle zum Lachen bringt.',30,4,12,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny','cloudy'],false,'de'),
  ('Eine Seite für das Familienalbum gestalten','Fotos aus einer schönen Erinnerung ausdrucken oder zeichnen und eine Seite für das Familienalbum dekorieren.',45,4,12,'low_cost',NULL,NULL,false,'de'),
  ('Dem Kind Fahrradfahren beibringen','Geduldig, beständig, ein aufgeschürftes Knie — dann der Moment, in dem es alleine klappt. Jede Minute wert.',60,4,10,'free',ARRAY['spring','summer','autumn'],ARRAY['sunny','cloudy'],false,'de');
```

### ⚠️ Re-link collage presets after restoring activities

The restore above inserts activities with **new** `gen_random_uuid()` ids, but
`collage_presets.activity_ids` still points at the old ids. Until you re-link
them, preset/random collages load with empty slots and can't be created. Run:

```bash
docker compose exec api \
  sh -c "PYTHONPATH=/app python /app/scripts/relink_collage_presets.py"
```

The script is idempotent — it resolves each preset's nine activities by title
against whatever activities currently exist, so it's safe to run any time.

## Implementation Plan

`docs/implementation-plan.md` — 13 milestones (M0–M12). Each milestone ships both backend routes and frontend screens together. Start with **Milestone 0: Server Skeleton**.

## Planning Documents

| Document | What it covers |
|---|---|
| `docs/implementation-plan.md` | Milestone-by-milestone build plan |
| `docs/planning/ux-brief.md` | User journeys, onboarding, engagement strategy |
| `docs/planning/data-model-brief.md` | All 10 entities, relationships, lifecycle states |
| `docs/planning/compliance-brief.md` | GDPR obligations, required decisions, controls |
| `docs/requirements.md` | Full SRS with FR-XXX / NFR-XXX requirements |
| `docs/architecture.md` | C4 diagrams, key flows, technology decisions |

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/003-rewards-system/plan.md`.
<!-- SPECKIT END -->
