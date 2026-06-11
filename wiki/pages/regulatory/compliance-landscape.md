---
name: regulatory-compliance-landscape
description: GDPR as primary obligation — risks, controls, prototype vs MVP scope
type: regulatory
last_updated: 2026-06-11
---

# Regulatory: Compliance Landscape

Source: `docs/planning/compliance-brief.md`

> This is planning guidance, not legal advice. A qualified data protection professional familiar with German and EU law must review the consent model, privacy notice, and vendor agreements before any real user data is collected.

---

## Applicable Domains

| Domain | Assessment | Rationale |
|---|---|---|
| **GDPR** | **Primary obligation** | EU users; personal data of parents and children; photos of minors require particular care |
| HIPAA | Not applicable | No US operations, no PHI |
| IRB / human subjects research | Not applicable | Confirmed not a research study; prototype cohort is a product pilot |
| FDA / SaMD | Not applicable | No diagnostic claims, no clinical action triggered |
| TUM institutional review | Possible | TUM affiliation may require light governance review; deferred (D8) |

---

## Key Risks

### R1 — Photos of children are high-sensitivity personal data
Photos may contain identifiable images of minors. Under GDPR, children are data subjects even without accounts. Images must never leave the parent's chosen group context; private bucket; covered by a clear privacy notice.

### R2 — Legal basis for processing children's images
Children have no accounts so GDPR Art. 8 (services offered to children) likely does not apply strictly. But processing photos **of** children still requires a lawful basis. Intended basis: parental consent on behalf of the child. **Needs legal review before launch.** (D3)

### R3 — DPAs not yet in place
Four subprocessor categories will handle personal data: Google (auth), Hetzner (storage), email service, weather API. No DPAs exist yet. **No real user data until DPAs are signed.** (D2)

### R4 — EU residency of remaining subprocessors
Photo storage (Hetzner) and compute (EU server) confirmed EU-hosted. Email service provider (AWS SES eu-central-1 assumed — needs verification). Weather API (city name only — low risk, but must confirm).

### R5 — Consent withdrawal mechanics underspecified
What happens if a parent revokes photo processing consent after uploading photos? No defined answer yet. Without a clear withdrawal path, consent may not be freely given under GDPR. (D4)

### R6 — Free-text interests field may capture sensitive data
A parent might enter a medical condition in the `interests` field (e.g., "can't swim due to epilepsy"). Needs constrained vocabulary or explicit warning. (D5)

### R7 — No incident response procedure
A breach involving photos of minors would require 72-hour DPA notification under GDPR Art. 33. No procedure exists yet. (D7)

---

## Required Controls (Prototype)

| Control | Status |
|---|---|
| Granular consent capture (3 types, versioned, append-only) | Implemented (M3) |
| Consent re-prompt on policy version change | Planned (M12) |
| Private S3 bucket + pre-signed URLs (15-min TTL) | Implemented (M7) |
| TLS everywhere | Implemented (Caddy in production) |
| JWT access tokens 15 min, refresh 7 days rotated | Implemented (M2) |
| Rate-limiting on auth endpoints | Implemented (M2) |
| `ChildProfile` visibility enforced in service layer | Implemented (M3) |
| Right to erasure (`deletion_pending_at`, 30-day SLA) | Backend done (M11 pending for frontend) |
| Data portability export | Backend done (M11 pending for frontend) |
| Interests field safety hint | Planned (M3 implementation — verify present) |
| DPAs with all subprocessors | **TODO — D2** |
| Legal basis for children's photos | **TODO — D3** |
| Consent withdrawal mechanics defined | **TODO — D4** |
| Interests field controlled vocabulary or warning | **TODO — D5** |
| Incident response procedure | **TODO — D7** |

See → [regulatory/open-decisions.md](open-decisions.md)

---

## Prototype vs. MVP Scope

| Control | Prototype | MVP |
|---|---|---|
| GDPR consent capture + versioning | Required | Required |
| DPAs with all subprocessors | Required before launch | Required |
| Right to erasure (30-day SLA) | Required | Required |
| Private S3 + pre-signed URLs | Required | Required |
| TLS everywhere | Required | Required |
| Data export endpoint | Recommended | Required |
| Incident response procedure (documented) | Recommended | Required |
| Controlled vocabulary for interests | Recommended | Required |
| Formal legal review of consent model | Required before launch | Required |
