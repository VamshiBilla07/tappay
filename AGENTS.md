# AGENTS.md — TapPay / BasePOS

Two-phone USDC point of sale on Base Sepolia. The merchant signs an EIP-712 payment request (NFC/QR); the customer verifies it (including live ENS on Ethereum Sepolia) and pays USDC or ETH via a Uniswap exact-output swap. `web/` is a simulator only — not the real app.

## Branches (read before touching anything)
- `main` — core monorepo: `contracts/`, `packages/shared/`, `apps/mobile/`, `test-e2e/`, `web/`. Currently checked out.
- `customer-dashboard` — standalone Vite + React customer dashboard (`pay-dashboard/`), frontend only, no backend, mock data in `src/data.js`.
- `merchant-dashboard` — core monorepo + `payflux-merchant-dashboard/` (Express server + Vite admin app, file-based JSON store under `data/`) + `payflux-customer-dashboard/`.
- Plan: merge all three branches. Do **not** merge `.aistudio/` AI Studio media artifacts (binary, under `payflux-merchant-dashboard/` on `merchant-dashboard`) — regenerated, not source.

## Layout (no root package.json / workspace / CI / lint config)
Every directory below is its own npm project; run `npm i` inside each one.
- `contracts/` — Foundry (solc 0.8.24, Cancun). `src/PaymentSettlement.sol`, `test/PaymentSettlement.t.sol`. Vendored `lib/forge-std` + `lib/openzeppelin-contracts`.
- `packages/shared/` — `@pos/shared`, raw TypeScript (`main: src/index.ts`), no build step. Imported by mobile and merchant dashboard. Typecheck: `npx tsc -p .`
- `apps/mobile/` — Expo 52 / React Native 0.76 Android app. No committed `android/`.
- `test-e2e/` — Hardhat local chain (chainId 84532) + mock USDC/WETH/router.
- `payflux-merchant-dashboard/` — Express + Vite admin app; backend in `server/`.
- `payflux-customer-dashboard/` — Vite customer dashboard.

## Vercel deployment (both dashboards)

Each dashboard is a separate Vercel project. Import the directory as a project root, then set env vars in the Vercel dashboard.

### Customer dashboard (`payflux-customer-dashboard/`)
- Static Vite site → deploys to Vercel's Edge Network.
- `vercel.json` already configured (build: `npm run build`, output: `dist`).
- Env vars to set in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYFLUX_API` (merchant dashboard URL).
- Mobile-responsive: viewport-fit=cover, touch-friendly 48px tap targets, safe-area insets, overflow-x:hidden.

### Merchant dashboard (`payflux-merchant-dashboard/`)
- Express API converted to Vercel serverless function (`api/server.ts`) + static Vite frontend (`dist/`).
- `vercel.json` already configured (build: `npm run vercel-build`, routes `/api/*` to `api/server.ts`).
- `@pos/shared` is copied into `packages/shared/` inside this directory for Vercel resolution.
- Env vars to set in Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INR_PER_USDC`, `ADMIN_TOKEN`.
- Mobile-responsive: viewport-fit=cover, touch-friendly 48px tap targets, safe-area insets, overflow-x:hidden.

### Supabase setup (required before deploying)
1. Create a Supabase project.
2. Run `payflux-merchant-dashboard/supabase/schema.sql` in the Supabase SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel (merchant) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel (customer).

## Commands
Contracts: `cd contracts && forge test` (blocked as committed — see Known drift). One test: `forge test --match-test <name> -vvv`.
E2E (13 checks): `cd test-e2e && npm i && node build.js`; Terminal A `npx hardhat node`; Terminal B `npx tsx e2e.ts`. On Windows `npm test` runs POSIX through `cmd.exe` and fails — use the three commands above.
Shared: `cd packages/shared && npm i && npx tsc -p .`
Web: `cd web && npm ci && npm run dev` (port 5173) or `npm run build`
Mobile: `cd apps/mobile && npm i && npx expo prebuild && npx expo run:android`; `npx expo start --dev-client`
Merchant dashboard: `cd payflux-merchant-dashboard && npm i && npm run dev` (`tsx watch server/index.ts`, port 3000, Vite middleware). `npm run dev:vite` (Vite only). `npm run lint` (`tsc --noEmit`). `npm test` (`tsx --test src/utils/fintech.test.ts`). `npm run build` / `NODE_ENV=production tsx server/index.ts`.
Customer dashboard: `cd payflux-customer-dashboard && npm i && npm run dev` / `npm run build`

## Environment
- `.env` is gitignored (root and `payflux-merchant-dashboard/`; `.env.example` is **not** ignored). Copy `.env.example` to `.env` and fill in values (Supabase credentials, PORT, INR_PER_USDC, APP_URL, DATA_DIR, SETTLEMENT_ADDRESS, ADMIN_TOKEN).
- `payflux-merchant-dashboard/.env` and `payflux-customer-dashboard/.env` are created with Supabase URL + keys; drop in your actual SUPABASE_ANON_KEY / SERVICE_ROLE_KEY values.
- `payflux-merchant-dashboard/server/config.ts` loads dotenv via `import "dotenv/config"` and reads `SETTLEMENT_ADDRESS`, `SETTLEMENT_DEPLOYER`, `ADMIN_TOKEN`, `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Customer dashboard branch has no backend and no `.env` — static Vite frontend only; Supabase keys go in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `packages/shared/src/config.ts`: `SETTLEMENT` is the zero address until set after deploy. `0x0` still passes the contract check — do not mistake it for a successful deployment. CHAIN = baseSepolia, ENS_CHAIN = sepolia.

## Backend store (Supabase migration — DONE)
`payflux-merchant-dashboard/server/store.ts` now reads/writes Supabase (`links` + `settlement` tables) instead of `data/links.json` / `data/settlement.json`.
- Schema: `payflux-merchant-dashboard/supabase/schema.sql` — apply this to your Supabase project before running the server.
- `server/config.ts` exposes `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; `server/index.ts` exposes the REST API (`/api/links`, `/api/config`, `/api/admin/settlement`, …); `server/chain.ts` verifies `PaymentSettled` on Base Sepolia via viem.
- `server/store.ts` functions are now `async` — all call sites in `server/index.ts` use `await`.

## Invariants (change all copies together)
- EIP-712 domain `BasePOS` / `1`, chainId 84532, verifying contract = SETTLEMENT. The request field list is duplicated in `PaymentSettlement.sol` (`REQUEST_TYPEHASH`), `packages/shared/src/request.ts` + `abi.ts`, contract tests, and the web simulator.
- Mobile QR/NFC payload is version-1 JSON `{v,c,s,r,g}`; web `basepos:` format is incompatible.
- `PaymentSettled` event shape drives the merchant UI — update `packages/shared/src/abi.ts` / `watchSettlement` if it changes.
- Amounts are USDC base units (6 decimals). ETH path quotes via QuoterV2, sends quote +2% as `msg.value`, unused ETH refunded on-chain. Needs liquid WETH/USDC 0.3% pool on Base Sepolia; USDC path does not.
- `verifyRequest` is the security boundary (7 checks incl. live ENS forward + reverse on Ethereum Sepolia). The Solidity contract does not verify ENS.

## Known drift / gotchas
- `forge test` cannot compile as committed: `contracts/lib/openzeppelin-contracts` is incomplete (missing `utils/cryptography/`, `utils/introspection/`). Restore complete OpenZeppelin 5.x (vendored = 5.1.0) under `contracts/lib` before relying on Forge. E2E is unaffected (own npm OpenZeppelin).
- `.gitmodules` points at `contracts/lib/openzeppelin-contracts` while the index gitlink is at `lib/openzeppelin-contracts`; `git submodule update --init` fails ("no submodule mapping") — don't use it to repair dependencies.
- README references `contracts/script/Deploy.s.sol`, which does not exist. Constructor is `PaymentSettlement(usdc, weth, swapRouter02, poolFee)`; supply SwapRouter02 when deploying.
- Verified so far: `forge test` 5/5 (once libs fixed), `test-e2e` 13/13, `packages/shared` + `web` type-check. Base Sepolia deploy, Android app, NFC, real ENS not yet run.
