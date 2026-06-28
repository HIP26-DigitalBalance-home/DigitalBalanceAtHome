# Tasks: Register Interests

**Input**: Design documents from `specs/002-register-interests/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story. US1 (category cards) and US2 (custom tags) share the same screen and component so they are combined in Phase 3. US3 (edit screen) is Phase 4. No tests were requested.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: Maps to user story from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constants and i18n strings that every subsequent task depends on.

- [ ] T001 Create `client/constants/interest-categories.ts` — export `INTEREST_CATEGORIES` array (8 entries: key, icon name, i18n labelKey) and `CATEGORY_KEY_SET` as a `Set<string>`
- [ ] T002 [P] Add `interests.*` keys to `client/lib/i18n/en.ts` — `outdoor`, `crafts`, `cooking`, `sports`, `music`, `reading`, `building`, `animals`, `sectionLabel`, `customLabel`, `customPlaceholder`, `addButton`, `charLimitError`, `capError`
- [ ] T003 [P] Add `interests.*` keys to `client/lib/i18n/de.ts` — same keys, German strings

**Checkpoint**: Constants and i18n in place; both locale files compile without errors.

---

## Phase 2: Foundational (InterestPicker Component)

**Purpose**: The shared `InterestPicker` controlled component. All user story screens depend on this.

**⚠️ CRITICAL**: Must be complete before Phase 3 or Phase 4 can begin.

- [ ] T004 Create `client/components/interest-picker.tsx` — scaffold controlled component with props `value: string[]` and `onChange: (v: string[]) => void`; import `INTEREST_CATEGORIES` and `CATEGORY_KEY_SET` from constants
- [ ] T005 [P] Implement category grid inside `InterestPicker` — `View` with `flexWrap: 'wrap'`, one pressable card per category showing `MaterialIcons` icon + localized label; selected state derived from `CATEGORY_KEY_SET.has(v)` against `value`; tapping toggles the key in `value` and calls `onChange`
- [ ] T006 [P] Implement custom tag section inside `InterestPicker` — `TextInput` + Add button; on confirm: reject if >60 chars (show inline `charLimitError`), reject if total interests ≥ 20 (show `capError`), silently ignore case-insensitive duplicates, otherwise append to `value` and call `onChange`; display existing custom tags (items in `value` not in `CATEGORY_KEY_SET`) as chip row with × remove button
- [ ] T007 Wire `T005` and `T006` together inside the component; apply `useAppTheme()` colors and `Spacing` constants for cards, chips, and input styling; use `useTranslation()` for all user-visible strings

**Checkpoint**: `InterestPicker` renders in isolation (can import it and pass dummy props); category toggles and custom tag add/remove behave correctly.

---

## Phase 3: User Stories 1 & 2 — Onboarding Child Form (Priority: P1) 🎯 MVP

**Goal**: Replace the free-text interests `TextInput` in the onboarding child step with `InterestPicker`. Parents can select category cards and add custom tags before submitting their child's profile.

**Independent Test** (from quickstart.md Scenarios 1 & 2): Go through onboarding, tap category cards and add a custom tag, submit, then verify the child's interests array on the Profile tab.

- [ ] T008 [US1] In `client/app/(onboarding)/child.tsx` — change Formik `initialValues.interests` from `''` (string) to `[]` (string array); update Yup schema from `Yup.string()` to `Yup.array().of(Yup.string()).optional()`
- [ ] T009 [US1] In `client/app/(onboarding)/child.tsx` — remove the interests `TextInput` block; replace with `<InterestPicker value={values.interests} onChange={(v) => setFieldValue('interests', v)} />`
- [ ] T010 [US1] In `client/app/(onboarding)/child.tsx` — remove the comma-split transform in `handleSubmit`; pass `values.interests` (already `string[]`) directly to `onboardingApi.postChild`

**Checkpoint**: Onboarding child step shows category grid + custom tag input; selected interests are saved correctly (verified in Profile tab after completing onboarding).

---

## Phase 4: User Story 3 — Edit Child Profile (Priority: P2)

**Goal**: Replace the free-text interests `TextInput` in the edit-child screen with the same `InterestPicker`, pre-populated from the child's existing interests.

**Independent Test** (from quickstart.md Scenario 3): Edit a child who already has interests; confirm category cards are pre-highlighted and custom tags appear as chips; change selection and save; verify Profile tab reflects the update.

- [ ] T011 [US3] In `client/app/edit-child/[id].tsx` — change Formik `initialValues.interests` from `interests ?? ''` (string) to `interests ? interests.split(',').filter(Boolean) : []` (string array); update Yup schema to `Yup.array().of(Yup.string()).optional()`
- [ ] T012 [US3] In `client/app/edit-child/[id].tsx` — remove the interests `TextInput` block; replace with `<InterestPicker value={values.interests} onChange={(v) => setFieldValue('interests', v)} />`
- [ ] T013 [US3] In `client/app/edit-child/[id].tsx` — remove the comma-split transform in `handleSubmit`; pass `values.interests` directly to `onboardingApi.updateChild`

**Checkpoint**: Editing a child's interests pre-populates correctly; changes persist after save.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Remove now-unused i18n keys `childForm.interestsPlaceholder` and `childForm.interestsHint` from `client/lib/i18n/en.ts` and `client/lib/i18n/de.ts` if they are no longer referenced
- [ ] T015 [P] Update the `childForm.interests` label key in `en.ts` and `de.ts` to reflect the new UI (e.g. `'Interests (optional)'` without the comma hint)
- [ ] T016 Run through all 5 quickstart.md validation scenarios on iOS simulator; confirm edge cases (empty submit, duplicate tag, char limit, cap limit) all behave correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001–T003) — blocks all user story work
- **Phase 3 (US1+US2)**: Depends on Phase 2 completion
- **Phase 4 (US3)**: Depends on Phase 2 completion — can run in parallel with Phase 3
- **Phase 5 (Polish)**: Depends on Phases 3 and 4

### User Story Dependencies

- **US1 + US2 (Phase 3)**: Can start after Phase 2 — no dependency on US3
- **US3 (Phase 4)**: Can start after Phase 2 — no dependency on US1/US2, shares the same `InterestPicker` component

### Within Each Phase

- T005 and T006 are independent (different sections of the component) — can be written in parallel
- T008, T009, T010 must be sequential (each modifies the same file and depends on the previous)
- T011, T012, T013 must be sequential (same file)

---

## Parallel Opportunities

```
# Phase 1 — run in parallel:
T002: Add interests.* keys to en.ts
T003: Add interests.* keys to de.ts

# Phase 2 — after T004 scaffolds the component:
T005: Category grid implementation
T006: Custom tag section implementation

# Phases 3 & 4 — once Phase 2 is done:
Phase 3 (child.tsx) and Phase 4 (edit-child/[id].tsx) are independent files
```

---

## Implementation Strategy

### MVP (Phase 1 + 2 + 3 only)

1. Complete Phase 1: constants + i18n
2. Complete Phase 2: `InterestPicker` component
3. Complete Phase 3: onboarding child form
4. **Validate**: Run quickstart.md Scenarios 1, 2, 4, 5 on iOS simulator
5. **Ship US1+US2** — the highest-value entry point is done

### Incremental Delivery

1. MVP above → US1+US2 working in onboarding
2. Add Phase 4 → US3 edit screen working
3. Polish → cleanup and full scenario validation

---

## Notes

- `InterestPicker` is a dumb controlled component; it holds no persistent state — all state lives in Formik
- Category key classification is always `CATEGORY_KEY_SET.has(s)` — never guess based on string length or format
- The `interests` query param encoding (comma-joined string in `router.push`) in `profile.tsx` does NOT change — only `edit-child/[id].tsx` parses it differently
- `MaterialIcons` is already imported via `@expo/vector-icons` — no new package needed
