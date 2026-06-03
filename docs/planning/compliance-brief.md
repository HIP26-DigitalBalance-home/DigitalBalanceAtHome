# Compliance Planning Brief — DigitalBalance @home
**Version:** 0.1 | **Status:** Draft | **Date:** 2026-05-28

> **Disclaimer:** This brief is planning guidance, not legal advice. Before launching with real users, the team should have the consent model, privacy notice, and vendor agreements reviewed by a qualified legal or data protection professional familiar with German and EU law.

---

## 1. Scope Summary

| Item | Detail |
|---|---|
| Product purpose | Wellness app for parents — offline activity challenges with children, documented via photos, in a positive reinforcement framework |
| User accounts | Parents only; children have no accounts and cannot use the app |
| Indirect data subjects | Children — their photos and date of birth are processed by the system on behalf of their parent |
| Jurisdictions | Germany (prototype); EU (broader rollout) |
| Institutions involved | Stiftung Kindergesundheit (non-profit, foundation); TUM (academic context); clinical advisors from LMU/kbo-Heckscher |
| Data categories | Account identifiers (email, Google sub, display name); child profiles (nickname, date of birth, optional interests); activity photos (images of families/children); captions; activity completion events; city-level location (optional); consent records |
| No research study | Confirmed — not a human subjects research protocol |
| No EHR integration | Confirmed — no clinical data exchange |

---

## 2. Likely Compliance Domains

| Domain | Assessment                          | Rationale |
|---|-------------------------------------|---|
| **GDPR** | **Definitely - primary obligation** | EU users, personal data of parents and children processed; photos of minors require particular care |
| **HIPAA** | No                                  | No US operations, no covered entities, no protected health information in the US legal sense |
| **IRB / human subjects** | No                                  | Confirmed not a research study; prototype cohort is a product pilot, not a clinical trial |
| **FDA / SaMD** | No                                  | No diagnostic claims, no treatment recommendations, no clinical action triggered by the app |
| **Institutional security review** | Possible                            | TUM affiliation and foundation partnership may require a light institutional data governance review before prototype launch; check with TUM's data protection office |

---

## 3. Key Risks

### R1 — Photos of children are high-sensitivity personal data
Photos uploaded by parents may contain identifiable images of minors. Under GDPR, children are data subjects even without accounts. These images must never leave the parent's chosen group context, must be stored in a private bucket, and must be covered by a clear and honest privacy notice.

### R2 — Legal basis for processing children's images
The service is offered to parents, not directly to children, so GDPR Article 8 (age-appropriate design for services offered to children) likely does not apply in the strict sense. However, processing photos **of** children still requires a lawful basis. The intended basis is parental consent on behalf of the child. This framing needs legal review — particularly for children old enough to have their own rights under German national law.

### R3 — DPAs not yet in place
Four categories of subprocessors will handle personal data — the auth provider (Google), object storage (S3), email service, and weather API. No Data Processing Agreements exist yet. No real user data should be collected until DPAs are signed with all vendors that handle personal data.

### R4 — EU residency of remaining subprocessors
Photo storage (Hetzner) and compute (EU server) are confirmed EU-hosted. **Remaining to confirm:** email service provider (AWS SES eu-central-1 assumed — verify) and weather API provider. The weather API (city name only) is low risk; the email provider should be confirmed EU-hosted or covered by Standard Contractual Clauses before sending real user data.

### R5 — Consent withdrawal mechanics are underspecified
What happens if a parent withdraws photo processing consent after uploading photos? The current design has no defined answer. Without a clear withdrawal path, the consent is not freely given under GDPR.

### R6 — Free-text interests field may capture sensitive data
The `interests` field on child profiles is free-text. A parent might enter a medical condition, disability, or other special-category data (e.g., "can't swim due to epilepsy"). This field needs either a constrained vocabulary or a clear privacy notice that it should not contain sensitive health information.

### R7 — No incident response procedure documented
A data breach involving photos of children would require notification to the German data protection authority (BfDI or the relevant Landesbehörde) within 72 hours under GDPR Article 33. No breach detection or notification procedure currently exists.

---

## 4. Required Decisions

| # | Decision | Status | Detail |
|---|---|---|---|
| D1 | EU-hosted vendors for storage | **Resolved** | Hetzner Object Storage (photos) + AWS eu-central-1 (email/other). Both EU-hosted. DPAs still need to be signed before any real user data is collected. |
| D2 | DPA with Google for OIDC auth | **TODO** | Google OIDC confirmed as auth provider; Data Processing Agreement with Google not yet in place. Required before prototype launch. |
| D3 | Legal basis for processing photos of children | **TODO** | Needs review by a data protection professional before launch. Intended basis: parental consent on behalf of the child. |
| D4 | Consent withdrawal mechanics for photos | **TODO** | What happens to existing photos if a parent revokes photo processing consent mid-challenge? Must be defined and disclosed in the privacy notice. |
| D5 | Controlled vocabulary or warning for child interests field | **TODO** | Free-text field risks capturing sensitive health data. Needs either a predefined tag list or an explicit in-app warning before prototype launch. |
| D6 | Photo retention timeline | **Resolved** | Retention is parent-configurable per challenge. No automatic deletion in the prototype. Photos are kept until the parent explicitly deletes them or requests account erasure. Must be clearly disclosed in the privacy notice. |
| D7 | Incident response procedure | **TODO** | A written procedure for breach detection, internal escalation, and 72-hour DPA notification is required before prototype launch. |
| D8 | TUM institutional data governance review | **Deferred** | Not required for prototype. Revisit if TUM affiliation becomes a formal data-sharing or research relationship. |

---

## 5. Recommended Controls

These are expressed as capabilities, not implementation specifics.

### Consent
- Capture granular consent at registration: data storage, photo processing, and optional location/weather use — separately, not bundled
- Store each consent event with timestamp, policy version, and specific flags; never overwrite — append only
- Re-present consent and require re-confirmation if the privacy policy version changes
- Provide a clear, easy-to-reach path to withdraw consent for each consent type; document what withdrawal triggers (e.g., photo deletion, account deactivation)

### Access Control
- Enforce that a parent can only see data belonging to their own groups
- Child profile data (especially date of birth) is never included in any API response visible to other users
- Photos are served only via pre-signed, time-limited URLs; the service validates group membership before issuing any URL
- Admin API actions (activity pool management, etc.) require an elevated permission scope; all admin actions are logged with actor ID and timestamp

### Data Minimization
- Collect city-level location only and only when the user explicitly requests weather-based suggestions; never collect GPS coordinates
- The child interests field should carry an in-app hint or be constrained to avoid entry of health or medical information

### Encryption and Storage
- All data in transit uses TLS 1.2 or higher
- Object storage: **Hetzner Object Storage** (EU-hosted, S3-compatible). Bucket is fully private; no object is publicly accessible
- Photos are encrypted at rest (enforce at the bucket level)
- The PostgreSQL connection uses TLS in all non-local environments

### Right to Erasure (GDPR Article 17)
- Account deletion must remove: all photos from object storage, child profiles, group memberships, consent records, and the user record
- Completion records may be retained in anonymised form (user_id nulled, photo and caption cleared) to preserve aggregate challenge statistics — this residual retention must be disclosed in the privacy notice
- Deletion must complete within 30 days of the request; a deletion_pending_at timestamp tracks the SLA
- Provide a cancellation window (e.g., 7 days) before the irreversible deletion job runs

### Data Portability (GDPR Article 20)
- Provide a data export endpoint: parent can download all their personal data and photos in a machine-readable format (JSON + photo archive)
- Export must not include other users' data or photos

### Vendor and DPA Management
- Establish DPAs with all subprocessors before any real personal data is collected
- Maintain a written record of all subprocessors, the data they receive, and the legal basis for the transfer
- For any vendor not hosted in the EU, confirm adequacy decision or execute Standard Contractual Clauses

### Incident Response
- Document and test a basic breach response procedure before prototype launch: detection → internal escalation → DPA notification (72-hour deadline) → user notification if high risk to rights and freedoms
- Ensure the production server has access logs and the ability to detect unusual access patterns

### Rate Limiting and Auth
- Rate-limit authentication endpoints to prevent brute-force attacks (10 attempts per IP per minute)
- JWT access tokens expire in 15 minutes; refresh tokens rotate on use and expire in 7 days
- Refresh tokens are not stored in the database — they are signed JWTs; revocation on logout is handled by short expiry

---

## 6. Prototype vs. MVP Compliance Scope

| Control | Prototype (P1) | MVP |
|---|---|---|
| GDPR consent capture + versioning | Required | Required |
| DPAs with all subprocessors | Required | Required |
| Right to erasure (30-day SLA) | Required | Required |
| Private S3 bucket + pre-signed URLs | Required | Required |
| TLS everywhere | Required | Required |
| Data export endpoint | Recommended | Required |
| Incident response procedure (documented) | Recommended | Required |
| Controlled vocabulary for interests field | Recommended | Required |
| Retention policy documented in privacy notice | Required | Required |
| Formal legal review of consent model | Required before launch | Required |
