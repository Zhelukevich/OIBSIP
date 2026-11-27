---
name: pizza-frontend-refactor
description: Review or refactor the Slice Pizza React 18 and Vite frontend, including component boundaries, shared form behavior, state ownership, requests, and regression coverage.
---

# Refactor the Pizza Frontend

Start with the affected route in `client/src/App.tsx` and trace its page, shared components, data sources, and tests. For a review, report actionable findings with severity, file and line, user impact, and a proposed fix. For a refactor, preserve the route behavior and API contract unless the task calls for a change.

## Component and state boundaries

- Reuse controls from `client/src/components/` and `AuthLayout` for authentication screens. Keep feature-specific rendering with the feature. Extract shared components when callers need the same behavior or accessible markup. Prefer composition and named variants when a shared control would otherwise accumulate interacting boolean props.
- Keep state with its closest owner. Derive totals, availability, and display labels from existing data. Reuse `client/src/storefront.ts` for recipe identity, cart persistence, stock aggregation, and pricing. Preserve saved carts and legacy order currency handling.
- Keep React Hook Form registration, input refs, labels, and error associations working together. This project uses React 18 and shared fields forward refs to the actual input.
- Reuse `client/src/services/api.ts` for authenticated requests and API error messages. When changing requests or effects, verify the loading, error, empty, and success states that apply. Guard against stale requests when the route or input changes and clean up subscriptions or timers. Preserve the payment verification flow and tracking's polling fallback when touching those features.
- Read [pizza-tailwind-ui](../pizza-tailwind-ui/SKILL.md) when the refactor changes shared styling, responsive layout, or visual states.

## Verify

Run `npm --prefix client run typecheck` and `npm --prefix client test -- --run`. Run `npm --prefix client run build` when touching imports, styling, or Vite configuration. Add focused regression coverage when an affected behavior is missing from the existing tests in `client/tests/`. Exercise the affected route in a browser when the change depends on interaction, focus, or layout, and report any unavailable checks.

Use the React 18 and client-rendering guidance from [Vercel React Composition Patterns](https://www.skills.sh/vercel-labs/agent-skills/vercel-composition-patterns) and [Vercel React Best Practices](https://www.skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) when it addresses a concrete issue.
