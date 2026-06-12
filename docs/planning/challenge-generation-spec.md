# Challenge Generation Engine — Specification

## Overview

Introduce a two-phase engine that enriches activity suggestions and automates challenge creation.

**Phase 1 — Weather:** implement the already-wired `city` parameter on `GET /activities/suggestions` using Open-Meteo (free, EU-hosted, no API key).

**Phase 2 — LLM Generation:** add `POST /challenges/generate` that orchestrates weather + Mistral to produce a curated challenge draft the user can review, accept, or discard.

The project uses a spec-first workflow: `docs/openapi.yaml` is updated first, `server/app/schemas/generated.py` is regenerated, then routes are implemented.

---

## Decisions

| Item | Decision |
|------|----------|
| LLM provider | Mistral EU-hosted (`api.mistral.ai`, model `mistral-small-latest`) via OpenAI-compatible client |
| Button visibility | "Generate with AI" always visible on client; surfaces German error if server LLM is disabled |
| Challenge title language | Always German — hardcoded in system prompt |
| Weather provider | Open-Meteo (free, Frankfurt-hosted, no API key, no GDPR concern) |

---

## Existing Code Touchpoints

| File | Current state | Change in this feature |
|------|--------------|----------------------|
| `server/app/services/activity.py` | `get_suggestion()` accepts `city` but ignores it | Wire weather lookup |
| `server/app/api/activities.py` | `city` param present, not forwarded | Forward `city` to service |
| `server/app/core/config.py` | Pydantic settings from `.env` | Add `WEATHER_ENABLED`, `LLM_*` fields |
| `docs/openapi.yaml` | No generation endpoint | Add `POST /challenges/generate` + new schemas |
| `server/app/schemas/generated.py` | Codegen'd — never hand-edit | Regenerate after spec update |
| `server/app/api/challenges.py` | Existing CRUD routes | Add `POST /generate` route |
| `server/app/services/exceptions.py` | Domain error subclasses | Add `GenerationNotConfigured`, `GenerationFailed` |
| `client/lib/api/challenges.ts` | `create()`, `getActive()`, etc. | Add `generate()` method + types |
| `client/app/create-challenge.tsx` | 4-step manual creation | Add "Generate with AI ✨" button on Step 1 |

---

## Phase 1 — Weather

### New file: `server/app/services/weather.py`

```python
async def get_weather_condition(city: str) -> str | None:
    """Returns "sunny" | "cloudy" | "rainy", or None on any failure."""
```

**Data flow:**
1. Geocode city name → lat/lon via `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1`
2. Fetch current WMO weather code via `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=weather_code`
3. Map WMO code to existing `weather_suitability` enum:
   - Codes 0–2 → `"sunny"`
   - Codes 3, 45, 48 → `"cloudy"`
   - Codes 51–99 → `"rainy"`
4. Return `None` on any network/parse error — callers degrade gracefully

Use `httpx.AsyncClient` (already in the dependency tree via FastAPI).

### Change: `server/app/services/activity.py`

Update `get_suggestion()` signature to accept `city: str | None`. When `city` is provided and `WEATHER_ENABLED=True`, call `get_weather_condition(city)` and pass the result as the `weather` filter to `activity_repo.get_all()`. Existing fallback chain is unchanged:

```
weather + age + season → interest-boosted pick
  → (no match) age + season only
  → (no match) age only
```

### Config additions (`server/app/core/config.py`)

```python
WEATHER_ENABLED: bool = True
```

### No OpenAPI change needed for Phase 1

The `GET /activities/suggestions` response schema is already `Activity`. No new fields on the response are required.

---

## Phase 2 — LLM Challenge Generation

### OpenAPI additions (`docs/openapi.yaml`)

Add to `paths`:

```yaml
/challenges/generate:
  post:
    operationId: generateChallenge
    summary: Generate a challenge draft using weather and AI
    tags: [Challenges]
    requestBody:
      required: true
      content:
        application/json:
          schema: {$ref: '#/components/schemas/GenerateChallengeRequest'}
    responses:
      '200':
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ChallengeDraft'}
      '400': {$ref: '#/components/responses/BadRequest'}
      '503': {$ref: '#/components/responses/ServiceUnavailable'}
```

Add to `components/schemas`:

**`GenerateChallengeRequest`:**
```yaml
type: object
required: [start_date, end_date]
properties:
  child_id:   {type: string, format: uuid, nullable: true}
  city:       {type: string, nullable: true}
  group_id:   {type: string, format: uuid, nullable: true}
  start_date: {type: string, format: date}
  end_date:   {type: string, format: date}
```

**`ChallengeDraft`:**
```yaml
type: object
required: [suggested_title, activities]
properties:
  suggested_title:  {type: string}
  activities:       {type: array, items: {$ref: '#/components/schemas/Activity'}}
  weather_used:     {type: string, nullable: true}
  generation_note:  {type: string, nullable: true}
```

After editing the spec, run the codegen command from `CLAUDE.md` to regenerate `server/app/schemas/generated.py`.

### Config additions (`server/app/core/config.py`)

```python
LLM_ENABLED: bool = False
LLM_PROVIDER: str = "openai_compatible"   # "openai_compatible" | "anthropic"
LLM_MODEL: str = "mistral-small-latest"
LLM_API_KEY: str = ""
LLM_BASE_URL: str = "https://api.mistral.ai/v1"
LLM_ACTIVITY_POOL_SIZE: int = 40          # max activities sent to LLM in prompt
```

### New file: `server/app/services/llm.py`

Provider abstraction:

```python
@dataclass
class ChallengeContext:
    child_age: int | None
    child_interests: list[str]
    current_weather: str | None    # "sunny" | "cloudy" | "rainy" | None
    current_season: str            # "spring" | "summer" | "autumn" | "winter"
    available_activities: list[dict]  # {id, title, age_min, age_max, weather_suitability}

@dataclass
class ChallengeDraftResult:
    suggested_title: str
    activity_ids: list[str]

class LLMClient(Protocol):
    async def generate_challenge(self, ctx: ChallengeContext) -> ChallengeDraftResult: ...

class OpenAICompatibleLLMClient:
    """Covers Mistral and any OpenAI-compatible endpoint."""
    ...

class AnthropicLLMClient:
    """Fallback for future use."""
    ...
```

**System prompt** (stored as a module constant):

```
You are an activity planner for a family wellness app called DigitalBalance.
Select 4–6 offline activities for a parent to do with their child.

Rules:
- Only select activities from the provided list — use their exact IDs
- Never select paid activities
- All activities must fit the child's age range
- Prefer activities suited to the current weather
- Prefer activities that match the child's interests
- Suggest a short, warm challenge title (max 6 words, in German)
- Respond with valid JSON only — no prose, no markdown fences

Output format:
{"challenge_title": "<German title>", "activity_ids": ["<uuid>", ...]}
```

**User message:** JSON-serialised `ChallengeContext`.

**Model parameters:** `temperature=0.7`, `max_tokens=512`.

### New file: `server/app/services/challenge_generator.py`

Orchestrates the full pipeline:

```
1. Resolve child profile (age, interests) if child_id provided
2. Call weather.get_weather_condition(city) — catch all errors, weather=None on failure
3. Fetch eligible activities: activity_repo.get_all(age=child_age, exclude_paid=True)
   — sample up to LLM_ACTIVITY_POOL_SIZE to cap prompt size
4. Build ChallengeContext
5. If not LLM_ENABLED or no API key → raise GenerationNotConfigured
6. Call llm_client.generate_challenge(context)
   — retry once after 1 s on transient failure
7. Validate returned activity_ids exist in DB
   — filter to valid ones; if < 2 remain → raise GenerationFailed
8. Fetch full Activity ORM objects for validated IDs
9. Return ChallengeDraft(
       suggested_title=...,
       activities=[...],
       weather_used=weather_condition,
       generation_note="Weather unavailable — used season context" if weather is None else None
   )
```

### New exceptions (`server/app/services/exceptions.py`)

```python
class GenerationNotConfigured(DomainError):
    status_code = 503
    code = "generation_not_configured"

class GenerationFailed(DomainError):
    status_code = 503
    code = "generation_unavailable"
```

### Route addition (`server/app/api/challenges.py`)

```python
@router.post("/generate", response_model=ChallengeDraft, status_code=200)
async def generate_challenge(
    payload: GenerateChallengeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await challenge_generator.generate_challenge_draft(session, current_user.id, payload)
```

The draft is **not persisted**. The user reviews it, then calls the existing `POST /challenges` to confirm.

---

## Client Changes

### `client/lib/api/challenges.ts`

Add types and `generate()` method:

```typescript
export interface GenerateChallengePayload {
  child_id?: string | null;
  city?: string | null;
  group_id?: string | null;
  start_date: string;
  end_date: string;
}

export interface ChallengeDraft {
  suggested_title: string;
  activities: ActivityItem[];
  weather_used: string | null;
  generation_note: string | null;
}

// Add to challengesApi:
generate: (payload: GenerateChallengePayload) =>
  apiClient.post<ChallengeDraft>('/challenges/generate', payload),
```

### `client/app/create-challenge.tsx`

On Step 1, below the title input, add a "Generate with AI ✨" `Pressable` button:

- **On press:**
  1. Show loading overlay (`ActivityIndicator` + "Herausforderung wird generiert…")
  2. Read `childId` (first child from stored profile), `city` (from `AsyncStorage CITY_KEY`), `start_date`/`end_date` defaults
  3. Call `challengesApi.generate({...})`
  4. On success: set `title = draft.suggested_title`, set `selectedIds = draft.activities.map(a => a.id)`, jump to Step 3
  5. If `draft.generation_note` is set: show a small info pill below the title ("⚠ Keine Wetterdaten – Saisonbasiert")
- **On error:** call `getGermanErrorMessage(e)` and show via `<ErrorState>` inline — user continues manually
- **Offline:** `disabled={!isOnline}`, opacity 0.4

Add `generation_note` pill style: small grey badge, max-width full, rounded, `fontSize: 12`.

German error messages to add to `client/lib/utils/api-error.ts`:

| Code | German string |
|------|--------------|
| `generation_unavailable` | `"Generierung fehlgeschlagen. Bitte manuell erstellen."` |
| `generation_not_configured` | `"KI-Generierung ist aktuell nicht verfügbar."` |

---

## Error Handling

| Scenario | Server | Client |
|----------|--------|--------|
| Open-Meteo unreachable | `weather_used=null`, `generation_note` set | Info pill shown |
| LLM API unreachable | 503 `generation_unavailable` | German error, manual flow |
| LLM returns unusable output | 503 `generation_unavailable` | German error, manual flow |
| `LLM_ENABLED=false` | 503 `generation_not_configured` | German error, manual flow |
| Invalid date range | 400 `invalid_date_range` | Standard error state |

---

## Implementation Sequence

### Phase 1 — Weather (no secrets needed)

1. Add `WEATHER_ENABLED` to `server/app/core/config.py`
2. Create `server/app/services/weather.py`
3. Update `server/app/services/activity.py` — wire `city` parameter
4. Update `server/app/api/activities.py` — forward `city` to service
5. Run `pytest` to verify existing tests still pass; add `tests/services/test_weather.py` with mocked httpx

### Phase 2 — LLM Generation (requires Mistral API key)

1. Add `LLM_*` settings to `server/app/core/config.py`
2. Update `docs/openapi.yaml` — add `GenerateChallengeRequest`, `ChallengeDraft`, `POST /challenges/generate`
3. Run codegen to regenerate `server/app/schemas/generated.py`
4. Create `server/app/services/llm.py`
5. Add `GenerationNotConfigured`, `GenerationFailed` to `server/app/services/exceptions.py`
6. Create `server/app/services/challenge_generator.py`
7. Add `POST /generate` route to `server/app/api/challenges.py`
8. Install dependency: `pip install openai` (OpenAI-compatible client, covers Mistral)
9. Update `requirements.txt`
10. Add `generate()` + types to `client/lib/api/challenges.ts`
11. Add generation codes to `client/lib/utils/api-error.ts`
12. Update `client/app/create-challenge.tsx` — "Generate with AI ✨" button on Step 1

---

## Verification

**Phase 1:**
```bash
# Server running, WEATHER_ENABLED=true
curl -s "http://localhost:8000/activities/suggestions?city=Munich" \
  -H "Authorization: Bearer $TOKEN"
# Expect: Activity whose weather_suitability matches current Munich conditions
```

**Phase 2:**
```bash
# LLM_ENABLED=true, LLM_API_KEY=<mistral key>
curl -s -X POST http://localhost:8000/challenges/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2026-07-01","end_date":"2026-07-14","city":"Munich"}'
# Expect: {"suggested_title":"...","activities":[...],"weather_used":"sunny"}

# LLM disabled:
# LLM_ENABLED=false → 503 {"detail":"...","code":"generation_not_configured"}
```

**Client:**
- Step 1 of create-challenge has "Generate with AI ✨" button
- Tapping it pre-fills title and activities, advances to Step 3
- Offline: button is dimmed and non-interactive
- LLM not configured: German error shown inline, user continues manually
