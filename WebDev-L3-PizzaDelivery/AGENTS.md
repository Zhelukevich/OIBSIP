# Repository Guidelines

## Project Structure

The pizza delivery app lives in `WebDev-L3-PizzaDelivery/`. The React and Vite frontend lives in `client/src/`, with pages in `pages/`, shared API access in `services/api.ts`, and styles in `styles/`. Put imported assets in `client/src/assets/` and static files in `client/public/`. The Express and MongoDB backend starts at `server/src/server.ts`. API handlers, Mongoose models, authentication middleware, and scheduled jobs live in `routes/`, `models/`, `middleware/`, and `jobs/` under `server/src/`. See `CHECKLIST.md` for feature requirements and `client/DESIGN.md` for UI guidance.

## Build and Local Development

Run these commands from `WebDev-L3-PizzaDelivery/`.

- `npm ci --prefix client` and `npm ci --prefix server` install dependencies from the package lockfiles.
- Copy `.env.development.example` to `server/.env.development`, configure local values, and start MongoDB using `docs/DOCKER.md`. Keep credentials out of Git.
- `npm run dev:server` starts Express on port 5000. In a second terminal, `npm run dev:client` starts Vite on port 5173 and proxies `/api` to Express. `npm run dev` also starts Express alone.
- `npm run build` builds the Vite client and compiles the TypeScript server. `npm run typecheck` checks both packages.

## Coding Style and Naming

Use TypeScript, two-space indentation, double quotes, and semicolons. Use PascalCase for React components and Mongoose models, camelCase for functions, and `<feature>.routes.ts` for Express route modules. Include `.js` extensions on relative server imports for NodeNext resolution. Follow nearby formatting. The project has no lint script or formatter configuration.

## Frontend Skills

- Read [pizza-frontend-refactor](.github/skills/pizza-frontend-refactor/SKILL.md) for frontend reviews and refactors involving React components, state, API requests, or regression coverage.
- Read [pizza-tailwind-ui](.github/skills/pizza-tailwind-ui/SKILL.md) for Tailwind v4 tokens, shared controls, and responsive or interactive styling.

## Testing

Run `npm test` to compile the server and run Node's test runner. Use `npm --prefix client test -- --run` for a single Vitest run. There is no configured coverage threshold. Add server cases in `server/tests/unit/` or `server/tests/integration/` as `*.test.js` and client cases in `client/tests/` as `*.test.ts` or `*.test.tsx`.

## Commits and Pull Requests

Favor short, descriptive commit subjects. Recent commits use `feat:` for feature changes. In pull requests, summarize the change, list verification commands and results, link related issues when available, and include screenshots for visible UI changes.
