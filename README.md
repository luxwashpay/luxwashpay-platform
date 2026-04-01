# LuxWash Top-Up Integration

This project now uses a real backend flow:

1. `boxServices/{box_num}` check before checkout.
2. Stripe Checkout payment.
3. `payRequest` after payment.
4. `payAck` to trigger machine start.
5. `payStatus/{pay_id}` polling.

## Local run

1. Start frontend:
   - Open this folder in VS Code.
   - Run Live Server on `luxwash_v11_booking_fee.html` (default `http://127.0.0.1:5500`).
2. Start backend:
   - `cd backend`
   - `cp .env.example .env`
   - Fill `.env` with your real Stripe key and Unipay secret/token details.
   - `npm install`
   - `npm start`
3. Open the page and run a test top-up.

## Dashboard

- Open `luxwash_dashboard.html` in the browser.
- The dashboard reads from `backend/data/transactions.json` (written on successful top-ups).
- Endpoints used:
  - `GET /api/dashboard/summary`
  - `GET /api/dashboard/transactions`
  - `GET /api/dashboard/transactions.csv`
  - `GET /api/dashboard/alerts`
- Default PIN: `1111` (change via `window.LUXWASH_DASH_PIN` before loading the page).
- Optional filters (query params): `?bay=260530&start=2026-03-01&end=2026-03-31`
- Role permissions:
  - Owner: full access (users, PIN reset, exports)
  - Staff: read-only (dashboard + reports)
- Printable daily report:
  - Click **Print Daily Report** (sets today’s date range and opens print dialog)
- Logo:
  - Set `window.LUXWASH_LOGO_URL = "https://..."` before page load

## Bay routing

- Test environment currently works with `box_num=19`.
- For multi-bay rollout, generate one QR per bay:
  - `.../luxwash_v11_booking_fee.html?box_num=260529`
  - `.../luxwash_v11_booking_fee.html?box_num=260530`
  - etc.

## Important

- Keep `UNIPAY_CLIENT_SECRET` and Stripe keys only in `backend/.env`.
- Use `UNIPAY_TOKEN_URL=https://app.unipay.com.ua/upclw_airp/v1/getAccessToken` for this Unipay API.
- The frontend calls backend at `http://localhost:3000` by default.
- `UNIPAY_AUTH_MODE=oauth2` matches Taras Swagger screenshots (`getAccessToken` -> Bearer token).
- To collect £0.50 automatically per QR top-up, set:
  - `STRIPE_CONNECT_ACCOUNT_ID=acct_...` (connected account for the car wash)
  - `PLATFORM_FEE_PENCE=50`
