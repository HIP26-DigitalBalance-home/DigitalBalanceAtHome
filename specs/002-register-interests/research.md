# Research: Register Interests

## Decisions

### 1. Component architecture: controlled `InterestPicker` component

**Decision**: A single `InterestPicker` component that accepts `value: string[]` and `onChange: (v: string[]) => void`. It encapsulates the category grid, custom tag input, and chip list. Both onboarding and edit screens consume it identically, with the parent Formik form calling `setFieldValue('interests', v)` on change.

**Rationale**: Spec SC-004 mandates a single shared component. Controlled design keeps Formik as the source of truth and avoids local state sync bugs.

**Alternatives considered**: Uncontrolled with a forwarded ref — rejected because Formik's `setFieldValue` flow is standard in this codebase and requires a controlled pattern.

---

### 2. Category key classification: static constant lookup

**Decision**: Predefined category keys are exported from `client/constants/interest-categories.ts` as a `Set<string>` (or `Record`). Classification of an interest string as "category" vs "custom tag" is a simple `CATEGORY_KEYS.has(interest)` check — no heuristics.

**Rationale**: Keys are fixed for this release (8 categories). A static lookup is O(1), zero-dependency, and trivially testable.

**Alternatives considered**: Regex prefix — rejected as fragile and harder to update.

---

### 3. Icon library: `@expo/vector-icons/MaterialIcons`

**Decision**: Use `MaterialIcons` from `@expo/vector-icons`, which is already imported in `components/ui/icon-symbol.tsx`. Draw 8 category icons from this set.

**Rationale**: Already a project dependency. Ionicons is referenced in the spec assumptions but MaterialIcons is what the project actually uses — stick with what's installed.

**Alternatives considered**: Ionicons — not imported anywhere in the project; would require adding a new icon set import.

---

### 4. Category grid layout: `FlatList` with `numColumns={3}` (or `flexWrap`)

**Decision**: Use a `View` with `flexWrap: 'wrap'` and `flexDirection: 'row'` for the category grid. Each card is ~(screenWidth - 2×padding - gaps) / 3. This avoids `FlatList` nesting issues inside a `ScrollView`.

**Rationale**: The `InterestPicker` will be embedded inside an existing `ScrollView`; nested `FlatList` in a `ScrollView` requires `scrollEnabled={false}` and a fixed height, which is awkward. A wrapped `View` renders all 8 cards statically — at 8 items there's no virtualization benefit.

**Alternatives considered**: `FlatList` with `scrollEnabled={false}` — rejected because card count is static and the nesting complexity isn't worth it.

---

### 5. Edit screen: interests param encoding stays as comma-joined string

**Decision**: The profile screen continues to pass `interests: child.interests?.join(',') ?? ''` to `edit-child/[id]` via `useLocalSearchParams`. Inside `EditChildScreen`, split on comma before passing to `InterestPicker`. No router API changes needed.

**Rationale**: `useLocalSearchParams` only supports string values. The existing encoding is already in place in `profile.tsx:259`. Only the *consumer* (EditChildScreen) changes: parse the string to `string[]` before handing to `InterestPicker`.

**Alternatives considered**: JSON-encoding the array in the param — rejected as unnecessary complexity for a small string list.

---

### 6. Formik schema for interests: `Yup.array().of(Yup.string())`

**Decision**: Replace `Yup.string()` for `interests` with `Yup.array().of(Yup.string()).optional()` in both form schemas. The `InterestPicker` handles its own inline validation (char limit, cap, dedupe) so Yup only needs to validate the shape of the saved array.

**Rationale**: The field changes from `string` to `string[]`. Yup schema must match.

---

### 7. Interest categories (8, for 3–12 year olds, German-speaking context)

| Key | Label (DE) | Label (EN) | MaterialIcon |
|-----|-----------|-----------|-------------|
| `outdoor` | Natur & Draußen | Nature & Outdoors | `nature` |
| `crafts` | Basteln & Kunst | Crafts & Art | `brush` |
| `cooking` | Kochen & Backen | Cooking & Baking | `restaurant` |
| `sports` | Sport & Bewegung | Sports & Movement | `directions-run` |
| `music` | Musik | Music | `music-note` |
| `reading` | Lesen & Geschichten | Reading & Stories | `menu-book` |
| `building` | Bauen & Konstruieren | Building & Building | `construction` |
| `animals` | Tiere | Animals | `pets` |
