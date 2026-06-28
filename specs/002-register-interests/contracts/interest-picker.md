# Contract: InterestPicker Component

## Location

`client/components/interest-picker.tsx`

## Props Interface

```ts
interface InterestPickerProps {
  value: string[];
  onChange: (interests: string[]) => void;
}
```

### `value`
The current flat list of interest strings for the child. May contain:
- Predefined category keys (e.g. `"outdoor"`, `"crafts"`) — displayed as highlighted cards in the grid
- Custom free-text tags (e.g. `"Lego"`, `"Dinosaurier"`) — displayed as removable chips

### `onChange`
Called whenever the user toggles a category card, adds a custom tag, or removes any interest. Receives the full updated `string[]`.

## Behaviour Contract

| Action | Precondition | Result |
|--------|-------------|--------|
| Tap unselected category card | — | Card highlights; key appended to `value`; `onChange` called |
| Tap selected category card | Card is highlighted | Card un-highlights; key removed from `value`; `onChange` called |
| Type custom tag + confirm | Input non-empty, ≤60 chars, total < 20, not a duplicate | Tag appended (as-typed); `onChange` called; input cleared |
| Type custom tag + confirm | Input > 60 chars | Tag rejected; inline validation error shown; `onChange` NOT called |
| Type custom tag + confirm | Total interests already 20 | Tag rejected; cap message shown; `onChange` NOT called |
| Type custom tag + confirm | Tag already in `value` (case-insensitive) | Silently ignored; `onChange` NOT called; input cleared |
| Tap remove on custom chip | Chip visible | Tag removed from `value`; `onChange` called |

## Display Contract

- Category grid: all 8 predefined categories always shown; selected ones visually highlighted
- Custom chips: displayed for each `v ∈ value` where `!CATEGORY_KEY_SET.has(v)`
- Inline validation error: appears below custom input, clears on next successful add or input change
- No submit button — component is a controlled sub-form; submit is handled by parent

## i18n Keys Required

```
interests.outdoor, interests.crafts, interests.cooking, interests.sports,
interests.music, interests.reading, interests.building, interests.animals,
interests.customPlaceholder, interests.addButton,
interests.charLimitError, interests.capError, interests.sectionLabel, interests.customLabel
```
