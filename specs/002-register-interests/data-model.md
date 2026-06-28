# Data Model: Register Interests

## Entities

### ChildProfile (existing — no schema change)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (UUID) | Existing PK |
| `nickname` | `string` | Existing |
| `date_of_birth` | `string` (ISO date) | Existing |
| `interests` | `string[]` | **Existing field.** Flat list of interest strings. May contain predefined category keys (`"outdoor"`) or arbitrary free-text custom tags (`"Lego"`). No migration needed. |

### InterestCategory (client-side constant, not persisted)

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | Stable lowercase English key used in `interests[]` (e.g. `"outdoor"`) |
| `labelKey` | `string` | i18n translation key (e.g. `"interests.outdoor"`) |
| `icon` | `string` | `MaterialIcons` icon name (e.g. `"nature"`) |

**Source of truth**: `client/constants/interest-categories.ts`

```ts
export const INTEREST_CATEGORIES: InterestCategory[] = [
  { key: 'outdoor',  labelKey: 'interests.outdoor',  icon: 'nature' },
  { key: 'crafts',   labelKey: 'interests.crafts',   icon: 'brush' },
  { key: 'cooking',  labelKey: 'interests.cooking',  icon: 'restaurant' },
  { key: 'sports',   labelKey: 'interests.sports',   icon: 'directions-run' },
  { key: 'music',    labelKey: 'interests.music',    icon: 'music-note' },
  { key: 'reading',  labelKey: 'interests.reading',  icon: 'menu-book' },
  { key: 'building', labelKey: 'interests.building', icon: 'construction' },
  { key: 'animals',  labelKey: 'interests.animals',  icon: 'pets' },
];

export const CATEGORY_KEY_SET = new Set(INTEREST_CATEGORIES.map(c => c.key));
```

## Validation Rules (enforced in InterestPicker)

| Rule | Constraint |
|------|-----------|
| Custom tag max length | 60 characters; longer input rejected with inline error |
| Total interests cap | 20 (categories + custom tags combined); adding beyond this blocked with inline message |
| Duplicate detection | Case-insensitive; silently ignored when attempting to add |

## Component Props

### `InterestPicker`

```ts
interface InterestPickerProps {
  value: string[];                     // current interests list (category keys + custom tags)
  onChange: (interests: string[]) => void;  // called on any change
}
```

**Internal state** (not propagated to parent until change):
- No internal state for the categories selection — derived from `value` by checking `CATEGORY_KEY_SET`
- `customInput: string` — the current text in the custom tag input field
- `validationError: string | null` — inline error for rejected custom tag attempts

## Form Shape Changes

Both `child.tsx` (onboarding) and `edit-child/[id].tsx` change their Formik `interests` field:

| | Before | After |
|---|---|---|
| Formik initial value | `interests: ''` (string) | `interests: []` (string[]) |
| Yup schema | `Yup.string()` | `Yup.array().of(Yup.string()).optional()` |
| Submit transform | `.split(',').map(trim).filter(Boolean)` | Identity — already `string[]` |
| Edit screen init | `interests: interests ?? ''` (joined param) | `interests: interests ? interests.split(',').filter(Boolean) : []` |
