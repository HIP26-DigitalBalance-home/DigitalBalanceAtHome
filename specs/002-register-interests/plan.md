# Implementation Plan: Register Interests

**Branch**: `002-register-interests` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-register-interests/spec.md`

## Summary

Replace the free-text comma-separated interests input in the child profile forms (onboarding + edit) with a visual `InterestPicker` component: a grid of 8 predefined category cards (toggle-select) plus a custom tag input with removable chips. No backend or API changes are required — `ChildProfile.interests: string[]` already exists.

## Technical Context

**Language/Version**: TypeScript 5.x, React Native 0.79, Expo SDK 54

**Primary Dependencies**: Expo Router, Formik, Yup, `@expo/vector-icons/MaterialIcons` (already installed), `react-i18next`

**Storage**: N/A for this feature — interests persist via existing `POST /onboarding/child` and `PATCH /family/children/{child_id}` endpoints, no schema changes.

**Testing**: Manual validation via Expo iOS simulator per `quickstart.md`

**Target Platform**: iOS 15+ (primary), Android

**Project Type**: Mobile app (React Native / Expo)

**Performance Goals**: Category grid renders in <16ms (8 static items, no virtualization)

**Constraints**: No backend changes; no OpenAPI changes; single reusable component for both entry points; `interests` remains `string[]` on the wire

**Scale/Scope**: 2 screens modified, 1 new component, 1 new constants file, i18n additions

## Constitution Check

Constitution template is not yet filled in for this project — no specific gates to enforce. General project rules from `CLAUDE.md` apply:
- No OpenAPI changes (spec says none needed) ✅
- No backend changes ✅
- Reusable component (SC-004) ✅

## Project Structure

### Documentation (this feature)

```text
specs/002-register-interests/
├── plan.md              # This file
├── research.md          # Research decisions
├── data-model.md        # Component props and form shape changes
├── quickstart.md        # Validation scenarios
├── contracts/
│   └── interest-picker.md  # InterestPicker component contract
└── tasks.md             # Phase 2 output (not yet generated)
```

### Source Code

```text
client/
├── constants/
│   └── interest-categories.ts     # NEW: category definitions (key, icon, i18n key)
├── components/
│   └── interest-picker.tsx        # NEW: InterestPicker controlled component
├── app/
│   ├── (onboarding)/
│   │   └── child.tsx              # MODIFY: replace free-text interests with InterestPicker
│   └── edit-child/
│       └── [id].tsx               # MODIFY: replace free-text interests with InterestPicker
└── lib/
    └── i18n/
        ├── en.ts                  # ADD: interests.* keys
        └── de.ts                  # ADD: interests.* keys (German labels)
```

**Structure Decision**: Option 3 (Mobile + API), client-only changes. All new files go under `client/`. No server or docs/openapi changes.
