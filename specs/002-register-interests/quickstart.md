# Quickstart & Validation Guide: Register Interests

## Prerequisites

```bash
cd client
npm install
npx expo start   # press i for iOS simulator
```

App must have at least one onboarded user, or be run with a fresh account to hit the onboarding flow.

---

## Scenario 1 — Category selection during onboarding (US1)

1. Sign out (or use a fresh Google account) and complete sign-in.
2. Complete the "family" step.
3. On the **child profile** step, scroll to the interests section.
4. **Assert**: a grid of 8 cards appears, each with an icon and a German label.
5. Tap **"Natur & Draußen"** and **"Basteln & Kunst"** — both cards should highlight.
6. Tap **"Natur & Draußen"** again — it should deselect (un-highlight).
7. Submit the form.
8. Navigate to **Profile tab → child entry**.
9. **Assert**: child's interests show `crafts` (and not `outdoor`).

---

## Scenario 2 — Custom tag (US2)

1. In the onboarding child step (or the edit screen), type `"Lego"` into the custom interests input.
2. Tap the **Add** button (or press Enter/Done).
3. **Assert**: a chip labelled "Lego" appears with an × button.
4. Type a string of 61 characters and attempt to add.
5. **Assert**: an inline validation error appears; no chip is created.
6. Tap the × on the "Lego" chip.
7. **Assert**: chip disappears.
8. Submit and navigate to Profile.
9. **Assert**: child interests are empty (both were removed).

---

## Scenario 3 — Edit screen pre-population (US3)

1. On the Profile tab, ensure a child has interests `["crafts", "Lego"]` (complete Scenario 1 + 2 first, or seed directly via the API).
2. Tap **Edit** next to the child.
3. **Assert**: `"Basteln & Kunst"` card is highlighted; a "Lego" chip is present; other 7 cards are unselected.
4. Deselect `crafts`, add `"Dinosaurier"`.
5. Tap **Save**.
6. **Assert**: Profile shows interests `["Lego", "Dinosaurier"]`.

---

## Scenario 4 — Empty submission (edge case)

1. In the child form (onboarding or edit), select no categories and add no custom tags.
2. Submit.
3. **Assert**: form saves successfully (no validation error for empty interests).

---

## Scenario 5 — Duplicate tag (edge case)

1. Add custom tag `"Lego"`.
2. Type `"lego"` (lowercase) and tap Add.
3. **Assert**: no second chip appears; input is cleared silently.

---

## Verification via API

After submitting, confirm interests via the API:

```bash
# Get auth token from device logs or Expo dev tools, then:
curl -H "Authorization: Bearer <token>" http://localhost:8000/family/me
# Check children[].interests in the response
```
