---
name: regulatory-open-decisions
description: 5 open pre-launch compliance decisions (D2–D5, D7) that must be resolved before real user data is collected
type: regulatory
last_updated: 2026-06-11
---

# Regulatory: Open Decisions

These decisions are **non-code blockers** for prototype launch. They do not block implementation but must be resolved before any real user data is collected.

| # | Decision | Owner | Status | Detail |
|---|---|---|---|---|
| D2 | DPA with Google for OIDC auth | Foundation / legal | **TODO** | Google OIDC confirmed as auth provider; DPA with Google not yet in place. Required before prototype launch. |
| D3 | Legal basis for processing photos of children | Foundation / legal | **TODO** | Intended basis: parental consent on behalf of the child. Needs review by a data protection professional before launch, particularly for children old enough to have their own rights under German national law. |
| D4 | Consent withdrawal mechanics for photos | Foundation / product | **TODO** | What happens to existing photos if a parent revokes photo processing consent mid-challenge? Must be defined and disclosed in the privacy notice. (Impacts M11 implementation.) |
| D5 | Controlled vocabulary or warning for child interests field | Product | **TODO** | Free-text field risks capturing sensitive health data (e.g., medical conditions). Needs either predefined tags or an explicit in-app warning. |
| D7 | Incident response procedure | Foundation / engineering | **TODO** | Written procedure for breach detection, internal escalation, and 72-hour DPA notification required before prototype launch. |

---

## Resolved Decisions (for reference)

| # | Decision | Resolution |
|---|---|---|
| D1 | EU-hosted vendors for storage | Hetzner Object Storage (photos) + AWS eu-central-1 (email/other). Both EU-hosted. DPAs still need to be signed. |
| D6 | Photo retention timeline | Parent-configurable per challenge; no automatic deletion in prototype. Photos kept until explicit deletion or erasure request. Must be disclosed in privacy notice. |
| D8 | TUM institutional data governance review | Deferred — not required for prototype. Revisit if TUM affiliation becomes a formal data-sharing or research relationship. |

See → [regulatory/compliance-landscape.md](compliance-landscape.md), [questions/open-questions.md](../questions/open-questions.md)
