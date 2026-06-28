# Feature Specification: Register Interests

**Feature Branch**: `001-register-interests`

**Created**: 2026-06-28

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Select predefined interest categories during onboarding (Priority: P1)

A parent completing the child profile step in onboarding sees a grid of visual cards, each representing an interest category (e.g. Nature & Outdoors, Crafts & Art, Cooking & Baking, Sports & Movement). Each card shows an icon and a label. The parent taps the cards that match their child's interests — cards toggle highlighted when selected. They then submit the form and continue into the app.

**Why this priority**: This is the primary entry point for interest data. It replaces the current broken free-text field, delivers immediate personalization value, and is shown to every new user.

**Independent Test**: Can be fully tested by going through the onboarding flow to the child profile step, selecting two or more interest cards, submitting, and verifying the selected interests appear on the child's profile in the app.

**Acceptance Scenarios**:

1. **Given** the parent is on the child profile step, **When** they view the interest section, **Then** they see a grid of at least 8 predefined category cards, each with a recognizable icon and a short German label.
2. **Given** a card is unselected, **When** the parent taps it, **Then** the card visually highlights to indicate selection; tapping again deselects it.
3. **Given** the parent selects 3 categories and submits, **When** the child profile is saved, **Then** the child's interests list contains the keys for those 3 categories.
4. **Given** the parent submits with no interests selected, **When** the child profile is saved, **Then** it is saved successfully with an empty interests list (interests are optional).

---

### User Story 2 — Add custom free-text interests alongside category cards (Priority: P1)

Below the category grid, a parent can type a custom interest (e.g. "Lego", "Dinosaurier") into a text field and add it as a tag. Multiple custom tags can be added. Each tag is shown as a removable chip. Custom tags are stored alongside selected category keys.

**Why this priority**: Children's interests are highly individual. Categories cover the most common themes but parents need an escape hatch for specifics. The LLM suggestion engine benefits from both structured keys and free-text signals.

**Independent Test**: Can be fully tested by typing a custom interest, pressing add, verifying it appears as a chip, submitting the form, and confirming the custom tag is in the child's interests list.

**Acceptance Scenarios**:

1. **Given** the parent types a custom interest and confirms (pressing a button or enter), **When** the tag is added, **Then** it appears as a removable chip below or near the input field.
2. **Given** a custom tag chip is visible, **When** the parent taps the remove button on it, **Then** the tag is removed from the selection.
3. **Given** the parent types more than 60 characters, **When** they attempt to add the tag, **Then** the input is rejected with a brief validation message and no tag is created.
4. **Given** the parent has already added 20 tags total (categories + custom), **When** they attempt to add another, **Then** further additions are blocked with a short explanation.

---

### User Story 3 — Edit interests from the child profile screen (Priority: P2)

A parent navigating to the child profile edit screen sees the same card-based interest picker pre-populated with their existing selections. Previously selected category cards appear highlighted. Custom tags appear as chips. The parent can add or remove interests and save.

**Why this priority**: Interests evolve as children grow. Without an edit path, the onboarding data becomes stale. This also validates that the component is reusable.

**Independent Test**: Can be fully tested by editing an existing child profile, changing the interest selection, saving, and verifying the updated interests appear correctly on the profile screen.

**Acceptance Scenarios**:

1. **Given** a child with saved interests ["outdoor", "Lego"], **When** the parent opens the edit screen, **Then** the "outdoor" category card is pre-highlighted and "Lego" appears as a custom chip.
2. **Given** the parent removes "outdoor" and adds "crafts", **When** they save, **Then** the child's interests list is updated to ["Lego", "crafts"] (or equivalent ordering).

---

### Edge Cases

- What happens when a parent submits the child form with only custom tags and no category cards selected? → Saved normally; custom tags are valid interests.
- What happens when a parent submits with only category cards and no custom tags? → Saved normally.
- What happens if the interests list is empty on the edit screen (child has no interests)? → All cards appear unselected, no custom chips shown; parent can optionally add interests before saving.
- What happens if a custom tag duplicates an existing tag (same text, case-insensitive)? → Duplicate is silently ignored; the tag is not added twice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The interest section MUST display a grid of predefined category cards, each showing an icon and a short localized label (German for German locale, English for English locale).
- **FR-002**: Category cards MUST support multi-select toggle; tapping a selected card deselects it.
- **FR-003**: A text input field MUST allow the parent to type a custom interest and add it as a tag (via a button or keyboard action).
- **FR-004**: Each custom tag MUST be removable individually via a visible control on the tag chip.
- **FR-005**: Custom interest text MUST be capped at 60 characters; longer input MUST be rejected with user feedback.
- **FR-006**: The total combined number of selected categories and custom tags MUST be capped at 20.
- **FR-007**: Duplicate tags (case-insensitive) MUST be silently ignored when attempting to add.
- **FR-008**: The interest picker MUST work in both the onboarding child profile step and the edit child profile screen, with identical interaction behaviour.
- **FR-009**: On the edit screen, the picker MUST be pre-populated from the child's existing interests list, correctly identifying which entries are predefined category keys vs. custom tags.
- **FR-010**: Interests MUST be stored as a flat list of strings (`string[]`) combining category keys and custom free text — no schema change is required.
- **FR-011**: Interests MUST remain optional; submitting with an empty selection MUST be valid.

### Key Entities

- **ChildProfile**: The existing entity. The `interests` field (`string[]`) stores a mix of predefined category keys (e.g. `"outdoor"`, `"crafts"`) and arbitrary free-text custom tags (e.g. `"Lego"`). No change to the data model is required.
- **InterestCategory**: A predefined entry with a stable key, an icon reference, and a localized display label. This is a client-side constant — not persisted separately.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parent can select their child's interests during onboarding without reading any instructions — the card UI is self-explanatory.
- **SC-002**: The complete interest selection flow (select categories + optionally add custom tag + submit) takes under 60 seconds for a typical parent.
- **SC-003**: 100% of existing child profiles with saved interests display correctly when the edit screen is opened (no data loss or corruption from the format change).
- **SC-004**: The interest picker component is used in both onboarding and edit screens with no duplicated logic — a single shared component covers both entry points.

## Assumptions

- The predefined interest categories are fixed for this release. A total of 8 categories covers the most common themes for 3–12 year olds in the German-speaking context.
- The `interests` field on `ChildProfile` already exists as `string[]` on both the backend (PostgreSQL ARRAY) and the API contract — no backend or OpenAPI changes are required.
- Category keys are English lowercase strings (e.g. `"outdoor"`) stored internally; display labels are fully localized. The LLM suggestion engine will receive the raw interest strings and is expected to handle both structured keys and free text.
- The existing interest data already in the database (from the free-text comma-split approach) is low-volume (development/test data only) and does not need a migration.
- Language is already determined at the child profile step (set earlier in onboarding); the interest picker respects the app's active locale.
- Expo's `@expo/vector-icons` (Ionicons) is the icon library used throughout the app; predefined category icons will be drawn from this set.
