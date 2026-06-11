---
name: evidence-design-principles
description: Core design principles that constrain every feature — positive reinforcement, no competition, accessibility
type: evidence
last_updated: 2026-06-11
---

# Evidence: Design Principles

These are load-bearing constraints, not stylistic preferences. Violating them undermines the product's purpose.

## 1. Positive Reinforcement Only

- No negative framing: no "you're behind", "you've only done X this week", "your family completed fewer activities"
- Empty collage slots are "available to fill", not "missed"
- If a challenge ends with unfilled slots, celebrate what was completed — do not show a gap counter
- End-of-challenge screen is a first-class celebration moment (confetti, collage export), not a toast banner

## 2. No Competitive Comparison

- No leaderboards or rankings
- Group view shows aggregate only: "8 of 12 activities completed by the group" — not which families did how many
- No per-family breakdown in any shared view
- Points balance is visible on the parent's own profile but has no redemption UI in the prototype — visible but not actionable to avoid building engagement around an unreal mechanic

## 3. Socioeconomic Accessibility

- All suggested activities must be free or low-cost (service-layer rule: paid activities are filtered out by default)
- No UI element exposes relative family activity counts
- `cost_indicator = paid` activities exist in the DB for future use but are never surfaced as primary suggestions

## 4. Opt-In Social Features

- "Share to group feed" is default-off per completion
- The default must be genuinely private — no dark pattern that nudges toward sharing
- Feed shows completions shared by choice only

## 5. Minimal Overhead

- App should reduce planning load — one pre-filtered suggestion per day, not a full activity browser as the primary surface
- Onboarding kept to 4 steps (sign in → consent → child profile → group)
- No location access request during onboarding — deferred to when the parent first requests weather-based suggestions
- No notification permissions during onboarding (deferred to MVP)

## 6. GDPR by Design

- Consent is granular (3 types: data storage, photo processing, location/weather — separately, not bundled)
- Consent is captured before any data is collected
- Children's date of birth is never in any group-visible response
- Photos of minors are stored in a private bucket and served only via pre-signed, time-limited URLs to verified group members

See → [evidence/problem-context.md](problem-context.md), [regulatory/compliance-landscape.md](../regulatory/compliance-landscape.md), [overview.md](../overview.md)
