# Way to Live

React landing page with a Cloudflare Pages Functions + D1 production backend and a Node.js + SQLite local backend. The local server requires Node.js 22.5 or newer for the built-in `node:sqlite` module.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

The frontend opens at Vite's local URL (usually `http://127.0.0.1:5173`). The API runs on `http://127.0.0.1:3001`. On first boot, the API prints a one-time admin password in its terminal. Add a private `ADMIN_PASSWORD` in `.env` and restart to use a persistent password. The dashboard is at `/admin`.

The database is stored in `data/waytolive.sqlite` and is ignored by git. Back it up securely; it contains client names, email addresses, and booking notes.

## Cloudflare Pages Functions + D1 backend

Production `/api/*` requests are handled by `functions/api/[[path]].js` and stored in Cloudflare D1. The local `server/` still uses SQLite. The existing local SQLite database is not copied to D1 automatically.

1. In Cloudflare, create a D1 database named `waytolive` and run `migrations/0001_initial.sql` in its Console.
2. In the Cloudflare Pages project, add a D1 binding named `DB` and select the `waytolive` database. Redeploy Pages after adding the binding.
3. Add these encrypted Pages secrets: `ADMIN_PASSWORD`, `RESEND_API_KEY`, and `BOOKING_FROM_EMAIL`. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable Google Calendar. Set `BOOKING_NOTIFICATION_EMAIL`, `GOOGLE_REDIRECT_URI`, `GOOGLE_CALENDAR_ID`, `BUSINESS_TIME_ZONE` (`Asia/Bangkok`), and `APP_BASE_URL` (the Pages production origin) as plain-text variables.
4. Remove any old `VITE_API_BASE_URL` override so the frontend calls `/api/*` on its own Pages origin. Deploy with `npm run build && npx wrangler pages deploy dist --project-name waytolive`, or connect the GitHub repository in Pages for automatic deployments.

If enabling Google Calendar, register `https://<your-pages-domain>/api/admin/google/callback` as the OAuth redirect URI with Google. Booking requests, availability, admin sessions, events, and Google OAuth tokens are stored in D1.

Cloudflare Pages Functions support D1 bindings and encrypted runtime secrets. See [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/) and [D1 setup](https://developers.cloudflare.com/d1/get-started/).

## Booking email notifications

New booking requests are emailed to `may.wytu@gmail.com` through Resend. Verify a sending domain, then set `RESEND_API_KEY` and `BOOKING_FROM_EMAIL` in `.env` for local development and as encrypted Cloudflare Pages secrets for production (for example, `Way to Live <bookings@your-verified-domain.com>`). `BOOKING_NOTIFICATION_EMAIL` defaults to May's address and can be changed if needed. Keep the API key private.

Notification email includes the client's name, email, session, date, time, format, and booking ID. Client notes stay in the private dashboard. If delivery fails, the booking remains saved and the failure is recorded in Cloudflare logs.

## Google Calendar connection

1. In Google Cloud Console, enable the Google Calendar API and create an OAuth client of type **Web application**.
2. Add the redirect URI `https://<your-pages-domain>/api/admin/google/callback` to the OAuth client's Authorized redirect URIs.
3. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` as encrypted Cloudflare Pages secrets, and set `APP_BASE_URL` to the Pages production origin. Redeploy Pages.
4. Sign into `/admin`, open **Google Calendar**, and connect May's Google account.

The app checks calendar busy times before accepting a booking request and creates a generic pending hold. Calendar holds do not include a client's name, email, or note. The OAuth token is stored in D1 in production and SQLite locally. Use HTTPS in production and keep `.env` private.

## Dashboard features

- Review client booking requests and notes, change booking status, record payment, and see monthly paid sales.
- Manage date-specific time slots. The first run seeds a 120-day sample schedule; edit those slots in **Availability**.
- Create and remove upcoming events. Published future events appear on the landing page.
- Connect or disconnect Google Calendar from the dashboard.

Session rates are shown in THB, with online counselling for clients in Myanmar priced in MMK. The API calculates and stores the rate and currency for each booking. Payments are recorded manually in the dashboard; this project does not process card payments.

The production site and API run on Cloudflare Pages; back up the D1 data and keep all API secrets private. The local SQLite database remains in `data/waytolive.sqlite` for local development.
