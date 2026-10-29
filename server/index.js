import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}
loadDotEnv();
process.umask(0o077);

const PORT = Number(process.env.API_PORT || 3001);
const TZ = process.env.BUSINESS_TIME_ZONE || 'Asia/Bangkok';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/admin/google/callback`;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const SESSION_COOKIE = 'waytolive_admin';
const sessions = new Map();
const oauthStates = new Map();
const loginAttempts = new Map();
const prices = {
  'One-to-one counselling': 9000,
  'Guided meditation': 4500,
  'The first conversation': 0,
};
const weeklySlots = {
  0: [],
  1: ['09:00', '11:00', '14:00', '16:00'],
  2: ['10:00', '13:00', '15:30'],
  3: ['09:00', '12:00', '16:00'],
  4: ['10:30', '14:00', '17:00'],
  5: ['09:00', '11:00', '14:30'],
  6: ['09:00', '11:30', '13:00'],
};

const dataDir = path.join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });
const dbFile = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(dataDir, 'waytolive.sqlite');
mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('Online','In-person')),
    service TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
    price_cents INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid')),
    paid_at TEXT,
    calendar_event_id TEXT,
    calendar_sync_status TEXT NOT NULL DEFAULT 'not_connected',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking_slot
    ON bookings(date,time) WHERE status IN ('pending','confirmed');
  CREATE INDEX IF NOT EXISTS booking_date_idx ON bookings(date,time);
  CREATE INDEX IF NOT EXISTS booking_paid_idx ON bookings(payment_status,paid_at);
  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE(date,time)
  );
  CREATE INDEX IF NOT EXISTS availability_date_idx ON availability(date,enabled,time);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    scope TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

function todayLocalISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function seedAvailability() {
  if (db.prepare("SELECT value FROM settings WHERE key='availability_seeded'").get()) return;
  const count = db.prepare('SELECT COUNT(*) AS count FROM availability').get().count;
  if (count === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO availability(date,time,enabled) VALUES(?,?,1)');
  const start = new Date(`${todayLocalISO()}T12:00:00+07:00`);
  for (let offset = 0; offset < 120; offset += 1) {
    const day = new Date(start.getTime() + offset * 86400000);
    const date = day.toISOString().slice(0, 10);
    for (const time of weeklySlots[day.getUTCDay()] || []) insert.run(date, time);
  }
  }
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('availability_seeded','yes')").run();
}
seedAvailability();

function passHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPass(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

let adminPasswordHash = db.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").get()?.value;
if (process.env.ADMIN_PASSWORD) {
  adminPasswordHash = passHash(process.env.ADMIN_PASSWORD);
  db.prepare("INSERT INTO settings(key,value) VALUES('admin_password_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(adminPasswordHash);
} else if (!adminPasswordHash) {
  const firstPassword = randomBytes(18).toString('base64url');
  adminPasswordHash = passHash(firstPassword);
  db.prepare("INSERT INTO settings(key,value) VALUES('admin_password_hash',?)").run(adminPasswordHash);
  console.log(`\nWay to Live dashboard first-run password: ${firstPassword}\nSet ADMIN_PASSWORD in .env to choose a persistent password.\n`);
}

const timeSlots = Object.values(weeklySlots).flat().filter((value, index, all) => all.indexOf(value) === index).sort();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body === null ? '' : JSON.stringify(body));
}
function fail(res, status, message) { send(res, status, { error: message }); }
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const i = part.indexOf('='); return [decodeURIComponent(part.slice(0, i)), decodeURIComponent(part.slice(i + 1))];
  }));
}
function currentSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  return { token, ...session };
}
async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Request body is too large.');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('Invalid JSON request.'); }
}
function safeDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)); }
function labelTime(time) {
  const [hourText, minute] = time.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}
function addMinutes(date, time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const start = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`);
  return new Date(start.getTime() + minutes * 60000);
}
function durationFor(service) {
  if (service === 'Guided meditation') return 30;
  if (service === 'The first conversation') return 20;
  return 50;
}
function googleReady() { return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET); }
function googleTokenRow() { return db.prepare('SELECT * FROM google_tokens WHERE id=1').get(); }

async function getGoogleAccessToken() {
  let row = googleTokenRow();
  if (!row) return null;
  if (!googleReady()) throw new Error('Google Calendar OAuth credentials are not configured.');
  if (row.expires_at > Date.now() + 60_000) return row.access_token;
  const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: row.refresh_token, grant_type: 'refresh_token' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Could not refresh Google Calendar access.');
  db.prepare("UPDATE google_tokens SET access_token=?, expires_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=1").run(result.access_token, Date.now() + result.expires_in * 1000);
  return result.access_token;
}

async function calendarRequest(method, endpoint, accessToken, payload) {
  const response = await fetch(endpoint, { method, headers: { Authorization: `Bearer ${accessToken}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const result = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Google Calendar returned ${response.status}.`);
  return result;
}

async function busyIntervals(date) {
  const token = await getGoogleAccessToken();
  if (!token) return null;
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 86400000);
  const result = await calendarRequest('POST', 'https://www.googleapis.com/calendar/v3/freeBusy', token, {
    timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: TZ,
    items: [{ id: GOOGLE_CALENDAR_ID }],
  });
  return result.calendars?.[GOOGLE_CALENDAR_ID]?.busy || [];
}

function slotOverlapsBusy(date, time, service, busy) {
  const start = addMinutes(date, time, 0).getTime();
  const end = addMinutes(date, time, durationFor(service)).getTime();
  return busy.some((range) => new Date(range.start).getTime() < end && new Date(range.end).getTime() > start);
}

async function addCalendarHold(booking) {
  const token = await getGoogleAccessToken();
  if (!token) return null;
  const end = addMinutes(booking.date, booking.time, durationFor(booking.service));
  const payload = {
    summary: 'Way to Live · Session request',
    description: `Pending ${booking.format.toLowerCase()} session request. Review in the Way to Live dashboard.`,
    start: { dateTime: `${booking.date}T${booking.time}:00+07:00`, timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    transparency: 'opaque',
  };
  const result = await calendarRequest('POST', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`, token, payload);
  return result.id;
}

async function updateCalendarHold(booking) {
  if (!booking.calendar_event_id) return;
  const token = await getGoogleAccessToken();
  if (!token) return;
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${encodeURIComponent(booking.calendar_event_id)}`;
  if (booking.status === 'cancelled') {
    await calendarRequest('DELETE', endpoint, token);
    db.prepare("UPDATE bookings SET calendar_event_id=NULL, calendar_sync_status='cancelled' WHERE id=?").run(booking.id);
  } else {
    await calendarRequest('PATCH', endpoint, token, { summary: booking.status === 'confirmed' || booking.status === 'completed' ? 'Way to Live · Session' : 'Way to Live · Session request' });
    db.prepare("UPDATE bookings SET calendar_sync_status='synced' WHERE id=?").run(booking.id);
  }
}

function ensureAdmin(req, res) {
  if (currentSession(req)) return true;
  fail(res, 401, 'Please sign in to the dashboard.');
  return false;
}
function parseMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return null;
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: next.toISOString().slice(0, 10) };
}
function bookingDto(row) {
  return { ...row, price: row.price_cents / 100, amount: row.price_cents / 100 };
}
function eventDto(row) { return row; }

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true });

  if (req.method === 'GET' && pathname === '/api/availability') {
    const date = url.searchParams.get('date');
    if (!safeDate(date)) return fail(res, 400, 'Choose a valid date.');
    let busy;
    try { busy = await busyIntervals(date); } catch (error) { return fail(res, 503, error.message); }
    const rows = db.prepare(`SELECT a.time FROM availability a WHERE a.date=? AND a.enabled=1
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.date=a.date AND b.time=a.time AND b.status IN ('pending','confirmed'))
      ORDER BY a.time`).all(date);
    const slots = rows.filter((row) => !busy || !slotOverlapsBusy(date, row.time, 'One-to-one counselling', busy)).map((row) => ({ value: row.time, label: labelTime(row.time) }));
    return send(res, 200, { date, slots, googleConnected: Boolean(googleTokenRow()) });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const events = db.prepare('SELECT id,title,starts_at,ends_at,location,description FROM events WHERE is_published=1 AND starts_at>=? ORDER BY starts_at LIMIT 30').all(new Date().toISOString());
    return send(res, 200, events.map(eventDto));
  }

  if (req.method === 'POST' && pathname === '/api/bookings') {
    let data;
    try { data = await bodyJson(req); } catch (error) { return fail(res, 400, error.message); }
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    const date = data.date;
    const time = data.time;
    const format = data.format;
    const service = data.service;
    const note = String(data.note || '').trim();
    if (name.length < 2 || name.length > 100) return fail(res, 400, 'Enter a name between 2 and 100 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail(res, 400, 'Enter a valid email address.');
    if (!safeDate(date) || date < todayLocalISO()) return fail(res, 400, 'Choose a valid future date.');
    if (!/^\d{2}:\d{2}$/.test(time) || !['Online', 'In-person'].includes(format) || !Object.hasOwn(prices, service)) return fail(res, 400, 'Choose a valid session date, time, and format.');
    if (note.length > 3000) return fail(res, 400, 'Please keep your note under 3,000 characters.');
    const available = db.prepare('SELECT id FROM availability WHERE date=? AND time=? AND enabled=1').get(date, time);
    if (!available) return fail(res, 409, 'That time is not available on this date. Please choose another slot.');
    if (db.prepare("SELECT id FROM bookings WHERE date=? AND time=? AND status IN ('pending','confirmed')").get(date, time)) return fail(res, 409, 'That time was just booked. Please choose another slot.');
    let busy;
    try { busy = await busyIntervals(date); } catch (error) { return fail(res, 503, `Could not check May’s calendar: ${error.message}`); }
    if (busy && slotOverlapsBusy(date, time, service, busy)) return fail(res, 409, 'That time is busy on May’s calendar. Please choose another slot.');
    let result;
    try {
      result = db.prepare(`INSERT INTO bookings(name,email,date,time,format,service,note,price_cents,calendar_sync_status)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(name, email, date, time, format, service, note, prices[service], busy ? 'pending_sync' : 'not_connected');
    } catch (error) {
      if (String(error.message).includes('unique_active_booking_slot') || String(error.message).includes('UNIQUE constraint failed: bookings.date, bookings.time')) return fail(res, 409, 'That time was just booked. Please choose another slot.');
      throw error;
    }
    const id = Number(result.lastInsertRowid);
    if (busy) {
      try {
        const eventId = await addCalendarHold({ id, date, time, format, service });
        db.prepare("UPDATE bookings SET calendar_event_id=?,calendar_sync_status='synced' WHERE id=?").run(eventId, id);
      } catch (error) {
        db.prepare("UPDATE bookings SET calendar_sync_status='failed' WHERE id=?").run(id);
        console.error('Calendar hold sync failed for booking', id, error.message);
      }
    }
    return send(res, 201, { id, status: 'pending', message: 'Your request has been sent. May will be in touch to confirm.' });
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    const attempts = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 15 * 60_000 };
    if (attempts.resetAt < Date.now()) { attempts.count = 0; attempts.resetAt = Date.now() + 15 * 60_000; }
    if (attempts.count >= 8) return fail(res, 429, 'Too many attempts. Wait 15 minutes and try again.');
    let data;
    try { data = await bodyJson(req); } catch (error) { return fail(res, 400, error.message); }
    if (!verifyPass(String(data.password || ''), adminPasswordHash)) {
      attempts.count += 1; loginAttempts.set(ip, attempts);
      return fail(res, 401, 'The password did not match.');
    }
    loginAttempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + 12 * 60 * 60_000 });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}` });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (req.method === 'GET' && pathname === '/api/admin/google/callback') {
      const token = parseCookies(req)[SESSION_COOKIE];
      const stateRecord = oauthStates.get(url.searchParams.get('state'));
      if (!stateRecord || stateRecord.expiresAt < Date.now() || stateRecord.sessionToken !== token) {
        const errorDestination = process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL.replace(/\/$/, '')}/admin?google=error` : '/admin?google=error';
        res.writeHead(302, { Location: errorDestination }); res.end(); return;
      }
      oauthStates.delete(url.searchParams.get('state'));
      const dashboardUrl = new URL('/admin', stateRecord.returnTo);
      if (url.searchParams.get('error')) { dashboardUrl.searchParams.set('google', 'error'); res.writeHead(302, { Location: dashboardUrl.toString() }); res.end(); return; }
      const params = new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' });
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      const result = await response.json();
      if (!response.ok || !result.access_token || !result.refresh_token) { dashboardUrl.searchParams.set('google', 'error'); res.writeHead(302, { Location: dashboardUrl.toString() }); res.end(); return; }
      db.prepare(`INSERT INTO google_tokens(id,access_token,refresh_token,expires_at,scope,updated_at)
        VALUES(1,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET access_token=excluded.access_token,
        refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,scope=excluded.scope,updated_at=CURRENT_TIMESTAMP`)
        .run(result.access_token, result.refresh_token, Date.now() + result.expires_in * 1000, result.scope || '');
      dashboardUrl.searchParams.set('google', 'connected'); res.writeHead(302, { Location: dashboardUrl.toString() }); res.end(); return;
    }
    if (!ensureAdmin(req, res)) return;

    if (req.method === 'GET' && pathname === '/api/admin/session') return send(res, 200, { ok: true });
    if (req.method === 'POST' && pathname === '/api/admin/logout') {
      const token = parseCookies(req)[SESSION_COOKIE]; if (token) sessions.delete(token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
    }
    if (req.method === 'GET' && pathname === '/api/admin/summary') {
      const month = parseMonth(url.searchParams.get('month'));
      if (!month) return fail(res, 400, 'Choose a valid month.');
      const sales = db.prepare("SELECT COALESCE(SUM(price_cents),0) AS cents,COUNT(*) AS count FROM bookings WHERE payment_status='paid' AND paid_at>=? AND paid_at<?").get(`${month.start}T00:00:00.000Z`, `${month.end}T00:00:00.000Z`);
      const pending = db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE status='pending'").get().count;
      const upcoming = db.prepare('SELECT COUNT(*) AS count FROM events WHERE is_published=1 AND starts_at>=?').get(new Date().toISOString()).count;
      return send(res, 200, { salesCents: sales.cents, paidCount: sales.count, pendingCount: pending, upcomingEvents: upcoming, currency: 'USD' });
    }
    if (req.method === 'GET' && pathname === '/api/admin/bookings') {
      const month = url.searchParams.get('month');
      const range = month ? parseMonth(month) : null;
      if (month && !range) return fail(res, 400, 'Choose a valid month.');
      const rows = range
        ? db.prepare('SELECT * FROM bookings WHERE date>=? AND date<? ORDER BY date DESC,time DESC').all(range.start, range.end)
        : db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500').all();
      return send(res, 200, rows.map(bookingDto));
    }
    const bookingMatch = pathname.match(/^\/api\/admin\/bookings\/(\d+)$/);
    if (req.method === 'PATCH' && bookingMatch) {
      let data;
      try { data = await bodyJson(req); } catch (error) { return fail(res, 400, error.message); }
      const id = Number(bookingMatch[1]);
      const current = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      if (!current) return fail(res, 404, 'Booking not found.');
      const status = data.status ?? current.status;
      const paymentStatus = data.paymentStatus ?? current.payment_status;
      const amount = data.amount === undefined ? current.price_cents : Math.round(Number(data.amount) * 100);
      if (!['pending','confirmed','completed','cancelled'].includes(status) || !['paid','unpaid'].includes(paymentStatus) || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return fail(res, 400, 'The booking update is invalid.');
      const paidAt = paymentStatus === 'paid' ? (current.payment_status === 'paid' ? current.paid_at : new Date().toISOString()) : null;
      try { db.prepare('UPDATE bookings SET status=?,payment_status=?,price_cents=?,paid_at=? WHERE id=?').run(status, paymentStatus, amount, paidAt, id); }
      catch (error) { if (String(error.message).includes('unique_active_booking_slot') || String(error.message).includes('UNIQUE constraint failed: bookings.date, bookings.time')) return fail(res, 409, 'That time already has an active booking.'); throw error; }
      const updated = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      try { await updateCalendarHold(updated); } catch (error) { db.prepare("UPDATE bookings SET calendar_sync_status='failed' WHERE id=?").run(id); console.error('Calendar status sync failed', id, error.message); }
      return send(res, 200, bookingDto(db.prepare('SELECT * FROM bookings WHERE id=?').get(id)));
    }
    if (req.method === 'GET' && pathname === '/api/admin/availability') {
      const date = url.searchParams.get('date');
      if (!safeDate(date)) return fail(res, 400, 'Choose a valid date.');
      const slots = db.prepare('SELECT id,time,enabled FROM availability WHERE date=? ORDER BY time').all(date);
      const booked = db.prepare("SELECT time,status FROM bookings WHERE date=? AND status IN ('pending','confirmed') ORDER BY time").all(date);
      return send(res, 200, { date, slots, booked });
    }
    if (req.method === 'PUT' && pathname === '/api/admin/availability') {
      let data;
      try { data = await bodyJson(req); } catch (error) { return fail(res, 400, error.message); }
      const date = data.date;
      const slots = data.slots;
      if (!safeDate(date) || !Array.isArray(slots) || slots.some((time) => !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59) || new Set(slots).size !== slots.length) return fail(res, 400, 'Choose a valid date and time list.');
      if (date < todayLocalISO()) return fail(res, 400, 'Availability cannot be set in the past.');
      const active = db.prepare("SELECT time FROM bookings WHERE date=? AND status IN ('pending','confirmed')").all(date).map((row) => row.time);
      if (active.some((time) => !slots.includes(time))) return fail(res, 409, 'A requested or confirmed booking uses one of those times. Update the booking first.');
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM availability WHERE date=?').run(date);
        const insert = db.prepare('INSERT INTO availability(date,time,enabled) VALUES(?,?,1)');
        for (const time of slots) insert.run(date, time);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return send(res, 200, { date, slots });
    }
    if (req.method === 'GET' && pathname === '/api/admin/events') {
      return send(res, 200, db.prepare('SELECT * FROM events ORDER BY starts_at DESC LIMIT 300').all().map(eventDto));
    }
    if (req.method === 'POST' && pathname === '/api/admin/events') {
      let data;
      try { data = await bodyJson(req); } catch (error) { return fail(res, 400, error.message); }
      const title = String(data.title || '').trim(); const location = String(data.location || '').trim(); const description = String(data.description || '').trim();
      const startsAt = String(data.startsAt || ''); const endsAt = String(data.endsAt || '');
      if (title.length < 2 || title.length > 120 || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt)) return fail(res, 400, 'Enter a title and future start and end times.');
      if (location.length > 200 || description.length > 3000) return fail(res, 400, 'Event details are too long.');
      const result = db.prepare('INSERT INTO events(title,starts_at,ends_at,location,description) VALUES(?,?,?,?,?)').run(title, new Date(startsAt).toISOString(), new Date(endsAt).toISOString(), location, description);
      return send(res, 201, db.prepare('SELECT * FROM events WHERE id=?').get(Number(result.lastInsertRowid)));
    }
    const eventMatch = pathname.match(/^\/api\/admin\/events\/(\d+)$/);
    if (req.method === 'DELETE' && eventMatch) {
      db.prepare('DELETE FROM events WHERE id=?').run(Number(eventMatch[1]));
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/api/admin/google/status') {
      return send(res, 200, { configured: googleReady(), connected: Boolean(googleTokenRow()), redirectUri: GOOGLE_REDIRECT_URI, calendarId: GOOGLE_CALENDAR_ID });
    }
    if (req.method === 'GET' && pathname === '/api/admin/google/connect') {
      if (!googleReady()) return fail(res, 400, 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env before connecting Google Calendar.');
      const current = currentSession(req);
      const state = randomBytes(24).toString('base64url');
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const returnTo = process.env.APP_BASE_URL || `${protocol}://${req.headers.host || `127.0.0.1:${PORT}`}`;
      oauthStates.set(state, { sessionToken: current.token, returnTo, expiresAt: Date.now() + 10 * 60_000 });
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events', access_type: 'offline', prompt: 'consent', state }).toString();
      res.writeHead(302, { Location: auth.toString() }); res.end(); return;
    }
    if (req.method === 'POST' && pathname === '/api/admin/google/disconnect') {
      db.prepare('DELETE FROM google_tokens WHERE id=1').run();
      return send(res, 200, { ok: true });
    }
    return fail(res, 404, 'Dashboard endpoint not found.');
  }

  const dist = path.join(ROOT, 'dist');
  const requested = pathname === '/' || pathname === '/admin' || pathname.startsWith('/assets/') ? (pathname === '/admin' ? path.join(dist, 'index.html') : path.join(dist, pathname)) : path.join(dist, pathname);
  const safePath = path.resolve(requested);
  if (!safePath.startsWith(dist + path.sep) || !existsSync(safePath) || !statSync(safePath).isFile()) {
    if (existsSync(path.join(dist, 'index.html'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); createReadStream(path.join(dist, 'index.html')).pipe(res); return;
    }
    return fail(res, 404, 'The production site has not been built.');
  }
  const ext = path.extname(safePath);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
  createReadStream(safePath).pipe(res);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error('API error:', error);
    if (!res.headersSent) fail(res, 500, 'Something went wrong. Please try again.'); else res.destroy();
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Way to Live API listening on http://127.0.0.1:${PORT}`));
process.on('SIGTERM', () => { server.close(); db.close(); });
process.on('SIGINT', () => { server.close(); db.close(); });
