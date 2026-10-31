# PayFlux merchant dashboard

The PayFlux front-end, wired to the BasePOS settlement stack. It is a **testnet-only USDC
point-of-sale portal** on Base Sepolia (chain 84532): the merchant wallet signs an EIP-712
payment request, the customer pays it from a second wallet, and every dashboard number is
derived from the resulting `PaymentSettled` events.

One process serves the API and the app (Vite in middleware mode), so there is no separate
front-end port.

```bash
cd payflux-merchant-dashboard
npm install
cp .env.example .env      # optional; defaults work for localhost
npm run dev               # http://localhost:3000
```

## First run

The app opens in **sample-data mode**, which needs no wallet and no deployed contract. That
is the showcase path:

1. Open <http://localhost:3000>.
2. Tap **Create Link**. A method chooser opens — UPI, cards, net banking, wallets, NFC, crypto.
3. Tap a method. The chooser closes and the payment popup opens with the **QR code**, the
   amount, a live countdown, and the shareable link.
4. Either **Simulate customer payment** in that panel, or open the link / scan the QR to
   complete the demo checkout. Either way the payment lands on the dashboard, in
   Transactions, Settlements and Customers.

Demo links live in `localStorage`, so they survive a reload but not a different browser or
device. Nothing is signed, no chain call is made, and the panels say so.

`?demo=0` switches to live reads (or use the header toggle). The live path:

1. Connect MetaMask and switch it to **Base Sepolia**.
2. The header shows *"Testnet, not deployed"* until a settlement contract exists.
3. Go to **Settings → Settlement contract → Deploy from this wallet**. This sends a
   contract-creation transaction (needs a little Base Sepolia ETH for gas), then registers
   the address with the server. The server re-reads the deployed contract's `usdc()`,
   `weth()` and `poolFee()` getters before trusting it, and records the deployer signature.
4. Create a link the same way — the chosen method is preselected on the checkout.

In live mode the API refuses to create links until step 3 — there is no sandbox contract to
fall back to.

## What each payment method actually does

UPI / card / net-banking acquiring requires a licensed PSP and bank settlement rails, which
this stack does not have. Nothing here pretends otherwise. Each method in the checkout
picks a **real on-chain rail**:

| Method in the UI | Rail | Contract call |
| --- | --- | --- |
| UPI, Wallet, Digital Wallets, NFC / Contactless, Cryptocurrency | Direct USDC | `pay(request, signature)` |
| Credit Card, Debit Card, Net Banking | ETH → exact USDC | `payWithEth(request, signature)` |

The ETH path quotes the Uniswap v3 0.3% WETH/USDC pool, sends `quote + 2%`, and the contract
refunds the unspent ETH in the same transaction. The checkout labels the rail on the button
and in the receipt; the dashboard groups volume by rail.

## Encryption / verification

`@pos/shared` (raw TypeScript, `file:` dependency) owns the protocol. A hosted link stores
the shared wire payload `{v,c,s,r,g}`; the checkout re-decodes it and runs the seven checks
before the pay button unlocks:

1. chain id is 84532
2. settlement address matches the server's deployed contract
3. token is Base Sepolia USDC and amount > 0
4. expiry is in the future (with a 15 s safety margin)
5. the EIP-712 signature recovers to the merchant
6. ENS forward resolution matches the merchant (skipped when the link has no ENS name)
7. ENS reverse resolution matches the claimed name (same skip rule)

ENS lives on **Ethereum Sepolia**, not Base, so the ENS field is optional here. Blank ENS
skips only checks 6–7; the other five always apply.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | chain, settlement address, tokens, INR rate, limits |
| GET | `/api/health` | same payload plus `ok` |
| POST | `/api/links` | store a merchant-signed request (verifies chain, contract, token, expiry, signature, nonce, INR↔USDC rate) |
| GET | `/api/links?merchant=0x…` | list a merchant's links |
| GET | `/api/links/:id` | read one link (expires it if late, reconciles paid state) |
| GET | `/api/links/:id/nfc` | the exact NDEF text record for the two-phone flow |
| POST | `/api/links/:id/settle` | verify a tx hash really contains the matching `PaymentSettled` log |
| PATCH | `/api/links/:id` | cancel, requires a merchant-signed message |
| GET | `/api/merchant/:address/balance` | live USDC balance |
| POST | `/api/admin/settlement` | adopt a deployed contract after signature + getter checks |

Links and the adopted address persist as JSON under `DATA_DIR` (default `./data`, gitignored).

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | one port for API + app |
| `INR_PER_USDC` | `85` | display-only conversion; the chain moves USDC |
| `APP_URL` | request host | set when sharing links from a tunnel or domain |
| `DATA_DIR` | `./data` | JSON persistence directory |
| `SETTLEMENT_ADDRESS` | from `data/settlement.json` | overrides the adopted contract |
| `ADMIN_TOKEN` | empty | when set, `/api/admin/settlement` requires `x-admin-token` |

## Scripts

```bash
npm run dev      # API + Vite on :3000 (tsx watch)
npm run build    # production bundle into dist/
npm start        # serve dist/ + API (NODE_ENV=production)
npm run lint     # tsc --noEmit
npm test         # node:test suite for the money math
npx tsx scripts/api-smoke.ts   # HTTP lifecycle test against a stubbed contract
```

Sample-data mode is the default (`?demo=0` forces live). It never touches the API or the
chain, and every banner says so.

## Limits

- Testnet only. Keys stay in MetaMask; the server never sees a private key.
- No refund flow, no fiat capture, no webhooks, no KYC — this is a settlement demo.
- The INR figure is a display conversion at a fixed rate, not a market quote.
