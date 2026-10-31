# Pay dashboard (React + Vite + Tailwind + lucide-react)

    npm install
    npm run dev        # http://localhost:5173
    npm run dev:https  # same app over a self-signed HTTPS cert (needed on a phone)
    npm run build      # production build in dist/
    npm test           # payment-intent parser tests

Structure: src/App.jsx (state), src/components/* (one file per dashboard section), src/data.js (demo data), src/index.css (design tokens, light/dark themes).

## Scanning

`Scan QR` opens the camera and decodes with jsQR. `Tap to pay with NFC` uses Web NFC.
Both APIs need a **secure context**: `localhost` is fine, but a phone opening
`http://192.168.x.x:5173` gets neither. For a phone demo run `npm run dev:https`, open
`https://<lan-ip>:5173`, and accept the self-signed certificate once.

Web NFC is Chrome-on-Android only, and it reads NDEF tags — it cannot read another
phone's HCE session. Two-phone taps therefore use the QR code; the NFC path is
phone ↔ tag.

`/api/*` is proxied to the PayFlux server (`PAYFLUX_API`, default `http://localhost:3000`),
so scanned payment links resolve against the demo server and payments show up on both devices.

Data is demo data. UPI QRs only open the `upi://` deep link — TapPay cannot move fiat.
