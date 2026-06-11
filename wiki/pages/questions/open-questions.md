---
name: questions-open
description: Living list of unresolved product, technical, and research questions
type: questions
last_updated: 2026-06-11
---

# Open Questions

Questions are grouped by category. When a question is answered, move the resolution to the relevant wiki page and note it here as closed.

---

## Compliance (non-code blockers)

- **D2** — DPA with Google for OIDC auth: when will this be in place? → [regulatory/open-decisions.md](../regulatory/open-decisions.md)
- **D3** — Legal basis for processing photos of children: has a data protection professional been engaged? → [regulatory/open-decisions.md](../regulatory/open-decisions.md)
- **D4** — What happens to uploaded photos if a parent revokes photo processing consent? (Impacts M11 design.) → [regulatory/open-decisions.md](../regulatory/open-decisions.md)
- **D5** — Should the `interests` field use a predefined tag list or a free-text field with a health-data warning? → [regulatory/open-decisions.md](../regulatory/open-decisions.md)
- **D7** — Incident response procedure: drafted yet? → [regulatory/open-decisions.md](../regulatory/open-decisions.md)

---

## Product / UX

- **Social features and FOMO:** The SRS flags that light social features "might be dropped, as we want to avoid increasing stress, envy, and fear-of-missing-out." The current group feed (M9) is opt-in per completion — is that sufficient mitigation, or does the feed need to be removed entirely from the prototype?
- **Cold-download empty state:** A parent who downloads the app without a group invite sees an empty Home screen. Does the "Create your first collage" CTA + demo collage work in practice, or will they churn before experiencing the core loop?
- **Google-only sign-in barrier:** Will some target parents (low digital literacy, no Google account) be unable to onboard? Is a fallback auth method needed before prototype user testing?
- **KITA invite flow scalability:** Single-use invite links require a teacher to generate one per family. For a class of 20+, is this acceptable, or does the prototype need a multi-use class invite link?
- **Points balance without redemption:** Showing a points balance with no redemption UI may confuse parents. Should it be hidden until MVP, or is a "coming soon" label acceptable?

---

## Technical

- **Weather API provider:** `SuggestionService` currently uses a season-only fallback. Which weather API will be used? Must confirm EU compliance (city-level data only). See `docs/implementation-plan.md` Open Questions.
- **Deep links for MVP:** Prototype uses custom URL scheme (`digitalbalance://`). Universal links require a verified domain with a `.well-known` file. When does this need to happen?
- **Server deployment:** EU VM + Caddy TLS required before first real-user test. Who is responsible? What timeline?
- **Async deletion job:** `DELETE /users/me` sets `deletion_pending_at`. The 30-day async deletion job (S3 photo deletion, DB cascade) has not been implemented. Where does this run in the prototype (cron job? manual trigger)? → [design/implementation-roadmap.md](../design/implementation-roadmap.md) M11

---

## Research (hypothesis validation)

- **Does completing challenges actually change screen-time behaviour?** The core hypothesis is unvalidated. Is there a plan to measure this, even informally, during the prototype pilot?
- **What is the meaningful group size?** The data model supports groups of any size. Is there a minimum group size below which the social context stops being motivating?
