# Way to Live

React landing page with a small Node.js and SQLite backend. Requires Node.js 22.5 or newer because the API uses the built-in `node:sqlite` module.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

The frontend opens at Vite's local URL (usually `http://127.0.0.1:5173`). The API runs on `http://127.0.0.1:3001`. On first boot, the API prints a one-time admin password in its terminal. Add a private `ADMIN_PASSWORD` in `.env` and restart to use a persistent password. The dashboard is at `/admin`.

The database is stored in `data/waytolive.sqlite` and is ignored by git. Back it up securely; it contains client names, email addresses, and booking notes.

## Google Calendar connection

1. In Google Cloud Console, create a project, enable the Google Calendar API, and create an OAuth client of type **Web application**.
2. Add the redirect URI `http://127.0.0.1:3001/api/admin/google/callback` to the OAuth client's Authorized redirect URIs. For a deployed site, set `GOOGLE_REDIRECT_URI` to the HTTPS callback URL on that deployment and register that exact value with Google. Set `APP_BASE_URL` to the public site origin if the app is behind a reverse proxy.
3. Copy the OAuth client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart the server.
4. Sign into `/admin`, open **Google Calendar**, and connect May's Google account.

The app checks calendar busy times before accepting a booking request and creates a generic pending hold. Calendar holds do not include a client's name, email, or note. The OAuth token is stored in the local SQLite database. Use HTTPS in production and keep the database and `.env` private.

## Dashboard features

- Review client booking requests and notes, change booking status, record payment, and see monthly paid sales.
- Manage date-specific time slots. The first run seeds a 120-day sample schedule; edit those slots in **Availability**.
- Create and remove upcoming events. Published future events appear on the landing page.
- Connect or disconnect Google Calendar from the dashboard.

Prices and currency are currently the landing page's sample USD prices; edit `prices` in `server/index.js` and the service cards in `src/main.jsx` together before taking live payments. Payments are recorded manually in the dashboard; this project does not process card payments or send email notifications.

For a production deployment, put the app behind an HTTPS reverse proxy, set a strong `ADMIN_PASSWORD`, configure the Google callback URL, and arrange backups for the SQLite database.
