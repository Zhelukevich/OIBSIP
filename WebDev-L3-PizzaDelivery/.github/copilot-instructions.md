# Pizza Delivery Workspace Instructions

## Commands

Run package commands from `d:\OIBSIP\WebDev-L3-PizzaDelivery`.

```powershell
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run typecheck
npm run test
```

- `npm run dev` starts the Express server only.
- Start the client separately with `npm run dev:client`.
- `npm run dev:server` starts `tsx watch src/server.ts` in `server/`.
- `npm run build` builds the Vite client, then the TypeScript server.
- `npm run typecheck` typechecks both workspaces.
- The root test command builds the server before running `node --test` in `server/`.
- Client test runner: `npm --prefix client test -- --run`.
- Run one client Vitest file: `npm --prefix client test -- --run src/path/file.test.tsx`.
- Run one server Node test file: `npm --prefix server test -- tests/unit/file.test.js`.
- No lint script is currently configured.

Local ports are `5173` for Vite and `5000` for Express. Vite proxies `/api` to port `5000`.

Local MongoDB runs as a replica set in the `pizza-mongo-rs` Docker container on port `27017`. Use `server/.env.development` for local configuration. The repository includes `.env.development.example` and `.env.production.example`. See [Docker setup](../docs/DOCKER.md).

## Architecture

- `client/` is a React 18, TypeScript, Vite application using React Router, Tailwind CSS, React Hook Form, Zod, Axios, and `socket.io-client`.
- `server/` is an Express, TypeScript, Node application using Mongoose, JWT, Razorpay, Nodemailer, `node-cron`, Zod, and Socket.IO.
- `server/src/server.ts` manages startup and shutdown. `server/src/app.ts` composes middleware, routes, and error handling. Services hold account, order, and payment operations.
- `client/src/App.tsx` owns top-level routing and the main user-facing shell. `TrackingPage.tsx` and `AdminPage.tsx` provide order tracking/payment and admin operations.
- `client/src/services/api.ts` creates the shared Axios instance and adds the JWT Bearer token from `localStorage`.
- `server/src/routes/` exposes auth, catalog, order, admin, and payment endpoints. Protected routes use `requireAuth`; admin routes also use `requireAdmin`.
- `server/src/models/` contains Mongoose documents for users, inventory, and orders.
- Status updates are emitted through `publishOrderStatus` after a persisted state change.
- The client joins `order:<id>` rooms and also polls every 15 seconds as the tracking fallback.

## Repository conventions

- Use TypeScript and `.js` import suffixes in server TypeScript modules because `server/tsconfig.json` uses NodeNext module resolution.
- Keep request schema validation with Zod in route modules or dedicated validation modules.
- Store JWT Bearer tokens in `pizza_token` and the cached user object in `pizza_user` in browser `localStorage`.
- Seed only catalog defaults and the separate admin account in server startup. Do not expose admin creation through user registration.
- Enforce inventory availability and order ownership on the server; React route guards are not authorization.
- Reserve or decrement inventory with an atomic Mongoose conditional update. Do not use a read followed by a separate write for stock changes.
- Razorpay amount calculation and signature verification happen server-side. Browser success is not sufficient to mark an order paid.
- Valid order transitions are enforced before status persistence and a `statusHistory` entry is appended with the change.
- Socket.IO events are named `order.statusChanged`; Socket.IO rooms use `order:<orderId>`.
- Update the relevant environment template or [Docker setup](../docs/DOCKER.md) when that configuration changes.
- Feature scope and visual references are in `CHECKLIST.md` and `client/DESIGN.md`; implementation intent is summarized in `docs/IMPLEMENTATION_PLAN.md`.
- Use the [backend skill links in AGENTS.md](../AGENTS.md#backend-skills) for implementation, review, payments, and real-time work.
