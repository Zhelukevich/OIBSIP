---
name: pizza-tailwind-ui
description: Refactor and standardize Slice Pizza UI styling with Tailwind CSS v4, shared components, semantic tokens, and consistent interaction states.
---

# Maintain the Pizza Tailwind UI

Use `client/src/styles/index.css` as the source for the implemented palette and theme. Read `client/DESIGN.md` for visual intent and check the affected screen before changing shared styles.

- Reuse `Button`, `ButtonLink`, `FormField`, and `PageContainer` from `client/src/components/`. Use a button for actions and a link for navigation. Add a variant when the same visual role recurs across callers.
- Use semantic theme utilities such as `bg-action`, `bg-surface`, `text-muted`, `text-danger`, and `border-line`. Give a new token a name that describes its role and add it to `@theme` when several callers share that role. For conditional variants, keep complete class names in source so Tailwind can discover them.
- Keep the 4 px spacing step in `--spacing`. A class such as `gap-4` means four steps. A numeric token such as `--spacing-4: 4px` would override that utility and change existing layouts.
- Use utilities for shared layout and control styles. Retain feature CSS where it clearly describes a layout or visual treatment, such as the storefront hero. Use the same theme variables in that CSS to keep surfaces, borders, and radii consistent.
- Check the relevant hover, focus-visible, disabled, pending, and invalid states when changing a shared control. Retain labels, descriptions, and keyboard behavior. Check narrow and wide layouts on the affected routes, including a second caller when changing a shared primitive.

Run `npm --prefix client run build` and verify that changed utilities appear in the generated CSS. If browser checks are unavailable, report this separately from build verification.

For Tailwind v4 patterns beyond the local theme, see [Tailwind Design System](https://www.skills.sh/wshobson/agents/tailwind-design-system).
