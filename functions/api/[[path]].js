const SESSION_COOKIE = 'waytolive_admin';
const PRICES = {
  'One-to-one counselling': 9000,
  'Guided meditation': 4500,
  'The first conversation': 0,
};
const WEEKLY_SLOTS = {
  0: [],
  1: ['09:00', '11:00', '14:00', '16:00'],
  2: ['10:00', '13:00', '15:30'],
  3: ['09:00', '12:00', '16:00'],
  4: ['10:30', '14:00', '17:00'],
  5: ['09:00', '11:00', '14:30'],
  6: ['09:00', '11:30', '13:00'],
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
function fail(message, status = 400) { return json({ error: message }, status); }
function timezone(env) { return env.BUSINESS_TIME_ZONE || 'Asia/Bangkok'; }
function todayLocalISO(env) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone(env), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
function safeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function safeTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60;
}
function labelTime(time) {
  const [hourText, minute] = time.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}
function addMinutes(date, time, minutes, env) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone(env), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let instant = wallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    instant += wallClock - represented;
  }
  return new Date(instant + minutes * 60_000);
}
function durationFor(service) {
  if (service === 'Guided meditation') return 30;
  if (service === 'The first conversation') return 20;
  return 50;
}
function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    try { return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))]; }
    catch { return ['', '']; }
  }));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function readBody(request) {
  const raw = await request.text();
  if (raw.length > 100_000) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }); }
}
function durationColumns(date, time, service, env) {
  const start = addMinutes(date, time, 0, env).getTime();
  const end = addMinutes(date, time, durationFor(service), env).getTime();
  return { start, end };
}
async function ensureAdmin(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await db.prepare('SELECT expires_at FROM sessions WHERE token_hash=?').bind(tokenHash).first();
  if (!session || session.expires_at <= Date.now()) {
    if (session) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
    return null;
  }
  return { token, tokenHash };
}
function bookingDto(row) {
  return { ...row, price: row.price_cents / 100, amount: row.price_cents / 100 };
}
function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function randomToken(byteCount = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteCount)));
}
async function verifyPlainPassword(password, expected) {
  if (!expected || password.length > 1024) return false;
  const [candidate, target] = await Promise.all([sha256(password), sha256(expected)]);
  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) mismatch |= candidate.charCodeAt(index) ^ target.charCodeAt(index);
  return mismatch === 0;
}

async function seedAvailability(db, env) {
  const marker = await db.prepare("SELECT value FROM settings WHERE key='availability_seeded'").first();
  if (marker) return;
  const existing = await db.prepare('SELECT id FROM availability LIMIT 1').first();
  if (existing) {
    await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('availability_seeded','yes')").run();
    return;
  }
  const start = new Date(`${todayLocalISO(env)}T12:00:00Z`);
  const statements = [];
  for (let offset = 0; offset < 120; offset += 1) {
    const day = new Date(start.getTime() + offset * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    for (const time of WEEKLY_SLOTS[day.getUTCDay()] || []) {
      statements.push(db.prepare('INSERT OR IGNORE INTO availability(date,time,enabled) VALUES(?,?,1)').bind(date, time));
    }
  }
  statements.push(db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('availability_seeded','yes')"));
  await db.batch(statements);
}
async function googleAccessToken(db, env) {
  const row = await db.prepare("SELECT value FROM settings WHERE key='google_calendar_token'").first();
  if (!row) return null;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google Calendar OAuth credentials are not configured.');
  const token = JSON.parse(row.value);
  if (token.expires_at > Date.now() + 60_000) return token.access_token;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: token.refresh_token, grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Could not refresh Google Calendar access.');
  token.access_token = result.access_token;
  token.expires_at = Date.now() + result.expires_in * 1000;
  token.updated_at = new Date().toISOString();
  await db.prepare("UPDATE settings SET value=? WHERE key='google_calendar_token'").bind(JSON.stringify(token)).run();
  return token.access_token;
}
async function calendarRequest(method, endpoint, accessToken, payload) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Google Calendar returned ${response.status}.`);
  return result;
}
async function busyIntervals(db, env, date) {
  const token = await googleAccessToken(db, env);
  if (!token) return null;
  const start = addMinutes(date, '00:00', 0, env);
  const end = new Date(start.getTime() + 86_400_000);
  const calendarId = env.GOOGLE_CALENDAR_ID || 'primary';
  const result = await calendarRequest('POST', 'https://www.googleapis.com/calendar/v3/freeBusy', token, {
    timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: timezone(env), items: [{ id: calendarId }],
  });
  return result.calendars?.[calendarId]?.busy || [];
}
function overlapsBusy(date, time, service, busy, env) {
  const { start, end } = durationColumns(date, time, service, env);
  return busy.some((range) => Date.parse(range.start) < end && Date.parse(range.end) > start);
}
async function overlapsBooking(db, date, time, service, env, ignoreId = null) {
  const { start, end } = durationColumns(date, time, service, env);
  const row = await db.prepare(`SELECT id FROM bookings WHERE date=? AND status IN ('pending','confirmed')
    AND starts_at_ms < ? AND ends_at_ms > ? ${ignoreId === null ? '' : 'AND id<>?'} LIMIT 1`)
    .bind(...(ignoreId === null ? [date, end, start] : [date, end, start, ignoreId])).first();
  return Boolean(row);
}
async function addCalendarHold(db, env, booking) {
  const token = await googleAccessToken(db, env);
  if (!token) return null;
  const calendarId = env.GOOGLE_CALENDAR_ID || 'primary';
  const result = await calendarRequest('POST', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, token, {
    summary: 'Way to Live · Session request',
    description: 'Pending session request. Review in the Way to Live dashboard.',
    start: { dateTime: addMinutes(booking.date, booking.time, 0, env).toISOString(), timeZone: timezone(env) },
    end: { dateTime: addMinutes(booking.date, booking.time, durationFor(booking.service), env).toISOString(), timeZone: timezone(env) },
    transparency: 'opaque',
  });
  return result.id;
}
async function updateCalendarHold(db, env, booking) {
  if (!booking.calendar_event_id) return;
  const token = await googleAccessToken(db, env);
  if (!token) return;
  const calendarId = env.GOOGLE_CALENDAR_ID || 'primary';
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(booking.calendar_event_id)}`;
  if (booking.status === 'cancelled') {
    await calendarRequest('DELETE', endpoint, token);
    await db.prepare("UPDATE bookings SET calendar_event_id=NULL,calendar_sync_status='cancelled' WHERE id=?").bind(booking.id).run();
  } else {
    await calendarRequest('PATCH', endpoint, token, { summary: ['confirmed', 'completed'].includes(booking.status) ? 'Way to Live · Session' : 'Way to Live · Session request' });
    await db.prepare("UPDATE bookings SET calendar_sync_status='synced' WHERE id=?").bind(booking.id).run();
  }
}
async function sendBookingEmail(env, booking) {
  if (!env.RESEND_API_KEY || !env.BOOKING_FROM_EMAIL) throw new Error('Set RESEND_API_KEY and BOOKING_FROM_EMAIL in Cloudflare Pages secrets.');
  const start = addMinutes(booking.date, booking.time, 0, env);
  const dateLabel = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: timezone(env) }).format(start);
  const timeLabel = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: timezone(env) }).format(start);
  const text = [
    'A new Way to Live session request was received.', '', `Client: ${booking.name}`, `Email: ${booking.email}`,
    `Session: ${booking.service}`, `Date: ${dateLabel}`, `Time: ${timeLabel} (${timezone(env)})`, `Format: ${booking.format}`,
    `Booking ID: ${booking.id}`, '', 'Open the Way to Live dashboard to review the request and client note.',
  ].join('\n');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.BOOKING_FROM_EMAIL, to: [env.BOOKING_NOTIFICATION_EMAIL || 'may.wytu@gmail.com'], subject: `New session request: ${booking.name}`, text }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Resend returned ${response.status}.`);
}

async function route(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return fail('D1 binding DB is not configured for this Pages project.', 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const method = request.method;

  if (method === 'GET' && path === '/health') return json({ ok: true });

  if (method === 'GET' && path === '/availability') {
    const date = url.searchParams.get('date');
    if (!safeDate(date)) return fail('Choose a valid date.');
    const service = url.searchParams.get('service') || 'One-to-one counselling';
    if (!Object.hasOwn(PRICES, service)) return fail('Choose a valid session.');
    try {
      const busy = await busyIntervals(db, env, date);
      const [slots, bookings] = await Promise.all([
        db.prepare('SELECT time FROM availability WHERE date=? AND enabled=1 ORDER BY time').bind(date).all(),
        db.prepare("SELECT id,date,time,service,status,starts_at_ms,ends_at_ms FROM bookings WHERE date=? AND status IN ('pending','confirmed')").bind(date).all(),
      ]);
      const available = slots.results.filter((slot) => {
        const { start, end } = durationColumns(date, slot.time, service, env);
        return !bookings.results.some((booking) => booking.starts_at_ms < end && booking.ends_at_ms > start)
          && (!busy || !overlapsBusy(date, slot.time, service, busy, env));
      }).map((slot) => ({ value: slot.time, label: labelTime(slot.time) }));
      const google = await db.prepare("SELECT key FROM settings WHERE key='google_calendar_token'").first();
      return json({ date, slots: available, googleConnected: Boolean(google) });
    } catch (error) { return fail(error.message, 503); }
  }

  if (method === 'GET' && path === '/events') {
    const { results } = await db.prepare('SELECT id,title,starts_at,ends_at,location,description FROM events WHERE is_published=1 AND starts_at>=? ORDER BY starts_at LIMIT 30').bind(new Date().toISOString()).all();
    return json(results);
  }

  if (method === 'POST' && path === '/bookings') {
    let data;
    try { data = await readBody(request); } catch (error) { return fail(error.message, error.status || 400); }
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    const { date, time, format, service } = data;
    const note = String(data.note || '').trim();
    if (name.length < 2 || name.length > 100) return fail('Enter a name between 2 and 100 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('Enter a valid email address.');
    if (!safeDate(date) || date < todayLocalISO(env) || !safeTime(time)) return fail('Choose a valid future date and time.');
    if (!['Online', 'In-person'].includes(format) || !Object.hasOwn(PRICES, service)) return fail('Choose a valid session and format.');
    if (addMinutes(date, time, 0, env).getTime() <= Date.now()) return fail('Choose a future session time.');
    if (note.length > 3000) return fail('Please keep your note under 3,000 characters.');
    const busy = await busyIntervals(db, env, date).catch((error) => { throw Object.assign(error, { status: 503 }); });
    if (busy && overlapsBusy(date, time, service, busy, env)) return fail('That time is busy on May’s calendar. Please choose another slot.', 409);
    const { start, end } = durationColumns(date, time, service, env);
    const result = await db.prepare(`INSERT INTO bookings(name,email,date,time,format,service,note,status,price_cents,payment_status,
      starts_at_ms,ends_at_ms,calendar_sync_status)
      SELECT ?,?,?,?,?,?,?,'pending',?,'unpaid',?,?,'not_connected'
      WHERE EXISTS(SELECT 1 FROM availability WHERE date=? AND time=? AND enabled=1)
      AND NOT EXISTS(SELECT 1 FROM bookings WHERE status IN ('pending','confirmed') AND starts_at_ms < ? AND ends_at_ms > ?)`)
      .bind(name, email, date, time, format, service, note, PRICES[service], start, end, date, time, end, start).run();
    if (result.meta.changes !== 1) return fail('That time is no longer available. Please choose another slot.', 409);
    const id = Number(result.meta.last_row_id);
    const booking = { id, name, email, date, time, format, service, note, status: 'pending', price_cents: PRICES[service], calendar_event_id: null };
    if (context.waitUntil) context.waitUntil(sendBookingEmail(env, booking).catch((error) => console.error('Booking email failed', id, error.message)));
    try {
      if (busy) {
        const eventId = await addCalendarHold(db, env, booking);
        await db.prepare("UPDATE bookings SET calendar_event_id=?,calendar_sync_status='synced' WHERE id=?").bind(eventId, id).run();
      }
    } catch (error) {
      await db.prepare("UPDATE bookings SET calendar_sync_status='failed' WHERE id=?").bind(id).run();
      console.error('Calendar hold sync failed for booking', id, error.message);
    }
    return json({ id, status: 'pending', message: 'Your request has been sent. May will be in touch to confirm.' }, 201);
  }

  if (method === 'POST' && path === '/admin/login') {
    let data;
    try { data = await readBody(request); } catch (error) { return fail(error.message, error.status || 400); }
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const attemptId = await sha256(ip);
    const now = Date.now();
    let attempts = await db.prepare('SELECT count,reset_at FROM login_attempts WHERE id=?').bind(attemptId).first();
    if (!attempts || attempts.reset_at < now) attempts = { count: 0, reset_at: now + 15 * 60_000 };
    if (attempts.count >= 8) return fail('Too many attempts. Wait 15 minutes and try again.', 429);
    const password = String(data.password || '');
    const validPassword = await verifyPlainPassword(password, env.ADMIN_PASSWORD);
    if (!validPassword) {
      await db.prepare(`INSERT INTO login_attempts(id,count,reset_at) VALUES(?,?,?)
        ON CONFLICT(id) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at`).bind(attemptId, attempts.count + 1, attempts.reset_at).run();
      return fail('The password did not match.', 401);
    }
    await db.prepare('DELETE FROM login_attempts WHERE id=?').bind(attemptId).run();
    const token = randomToken();
    const tokenHash = await sha256(token);
    await db.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)').bind(tokenHash, now + 12 * 60 * 60_000).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200` });
  }

  const publicGoogleCallback = method === 'GET' && path === '/admin/google/callback';
  if (path.startsWith('/admin/') && !publicGoogleCallback) {
    const session = await ensureAdmin(request, db);
    if (!session) return fail('Please sign in to the dashboard.', 401);
  }

  if (method === 'GET' && path === '/admin/session') return json({ ok: true });
  if (method === 'POST' && path === '/admin/logout') {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
  }
  if (method === 'GET' && path === '/admin/summary') {
    const month = url.searchParams.get('month') || '';
    if (!/^\d{4}-\d{2}$/.test(month)) return fail('Choose a valid month.');
    const next = new Date(`${month}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    const end = next.toISOString().slice(0, 10);
    const [sales, pending, events] = await Promise.all([
      db.prepare("SELECT COALESCE(SUM(price_cents),0) AS cents,COUNT(*) AS count FROM bookings WHERE payment_status='paid' AND paid_at>=? AND paid_at<?").bind(`${month}-01T00:00:00.000Z`, `${end}T00:00:00.000Z`).first(),
      db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE status='pending'").first(),
      db.prepare('SELECT COUNT(*) AS count FROM events WHERE is_published=1 AND starts_at>=?').bind(new Date().toISOString()).first(),
    ]);
    return json({ salesCents: sales.cents, paidCount: sales.count, pendingCount: pending.count, upcomingEvents: events.count, currency: 'USD' });
  }
  if (method === 'GET' && path === '/admin/bookings') {
    const month = url.searchParams.get('month') || '';
    if (month && !/^\d{4}-\d{2}$/.test(month)) return fail('Choose a valid month.');
    const query = month ? db.prepare('SELECT * FROM bookings WHERE date>=? AND date<? ORDER BY date DESC,time DESC').bind(`${month}-01`, (() => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })()) : db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500');
    const { results } = await query.all();
    return json(results.map(bookingDto));
  }
  const bookingMatch = path.match(/^\/admin\/bookings\/(\d+)$/);
  if (method === 'PATCH' && bookingMatch) {
    let data;
    try { data = await readBody(request); } catch (error) { return fail(error.message, error.status || 400); }
    const id = Number(bookingMatch[1]);
    const current = await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
    if (!current) return fail('Booking not found.', 404);
    const status = data.status ?? current.status;
    const paymentStatus = data.paymentStatus ?? current.payment_status;
    const amount = data.amount === undefined ? current.price_cents : Math.round(Number(data.amount) * 100);
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status) || !['paid', 'unpaid'].includes(paymentStatus) || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return fail('The booking update is invalid.');
    const paidAt = paymentStatus === 'paid' ? (current.payment_status === 'paid' ? current.paid_at : new Date().toISOString()) : null;
    const active = ['pending', 'confirmed'].includes(status);
    const update = await db.prepare(`UPDATE bookings SET status=?,payment_status=?,price_cents=?,paid_at=?
      WHERE id=? AND (?=0 OR NOT EXISTS(SELECT 1 FROM bookings AS other WHERE other.id<>bookings.id
      AND other.status IN ('pending','confirmed') AND other.starts_at_ms < bookings.ends_at_ms AND other.ends_at_ms > bookings.starts_at_ms))`)
      .bind(status, paymentStatus, amount, paidAt, id, active ? 1 : 0).run();
    if (update.meta.changes !== 1) return fail('That time overlaps another active booking.', 409);
    const updated = await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
    try { await updateCalendarHold(db, env, updated); }
    catch (error) { await db.prepare("UPDATE bookings SET calendar_sync_status='failed' WHERE id=?").bind(id).run(); console.error('Calendar status sync failed', id, error.message); }
    return json(bookingDto(await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first()));
  }
  if (method === 'GET' && path === '/admin/availability') {
    const date = url.searchParams.get('date');
    if (!safeDate(date)) return fail('Choose a valid date.');
    const [slots, bookings] = await Promise.all([
      db.prepare('SELECT id,time,enabled FROM availability WHERE date=? ORDER BY time').bind(date).all(),
      db.prepare("SELECT time,status FROM bookings WHERE date=? AND status IN ('pending','confirmed') ORDER BY time").bind(date).all(),
    ]);
    return json({ date, slots: slots.results, booked: bookings.results });
  }
  if (method === 'PUT' && path === '/admin/availability') {
    let data;
    try { data = await readBody(request); } catch (error) { return fail(error.message, error.status || 400); }
    const { date, slots } = data;
    if (!safeDate(date) || !Array.isArray(slots) || slots.some((time) => !safeTime(time)) || new Set(slots).size !== slots.length) return fail('Choose a valid date and time list.');
    if (date < todayLocalISO(env)) return fail('Availability cannot be set in the past.');
    const active = await db.prepare("SELECT time FROM bookings WHERE date=? AND status IN ('pending','confirmed')").bind(date).all();
    if (active.results.some(({ time }) => !slots.includes(time))) return fail('A requested or confirmed booking uses one of those times. Update the booking first.', 409);
    const existing = await db.prepare('SELECT id,time FROM availability WHERE date=?').bind(date).all();
    const wanted = new Set(slots);
    const statements = existing.results.filter((row) => !wanted.has(row.time)).map((row) => db.prepare('DELETE FROM availability WHERE id=?').bind(row.id));
    for (const time of slots) statements.push(db.prepare('INSERT INTO availability(date,time,enabled) VALUES(?,?,1) ON CONFLICT(date,time) DO UPDATE SET enabled=1').bind(date, time));
    if (statements.length) await db.batch(statements);
    return json({ date, slots });
  }
  if (method === 'GET' && path === '/admin/events') {
    const { results } = await db.prepare('SELECT * FROM events ORDER BY starts_at DESC LIMIT 300').all();
    return json(results);
  }
  if (method === 'POST' && path === '/admin/events') {
    let data;
    try { data = await readBody(request); } catch (error) { return fail(error.message, error.status || 400); }
    const title = String(data.title || '').trim();
    const location = String(data.location || '').trim();
    const description = String(data.description || '').trim();
    const startsAt = String(data.startsAt || '');
    const endsAt = String(data.endsAt || '');
    if (title.length < 2 || title.length > 120 || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt)) return fail('Enter a title and future start and end times.');
    if (location.length > 200 || description.length > 3000) return fail('Event details are too long.');
    const row = { title, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString(), location, description, is_published: 1, created_at: new Date().toISOString() };
    const result = await db.prepare('INSERT INTO events(title,starts_at,ends_at,location,description,is_published,created_at) VALUES(?,?,?,?,?,?,?)').bind(row.title, row.starts_at, row.ends_at, row.location, row.description, row.is_published, row.created_at).run();
    return json({ id: Number(result.meta.last_row_id), ...row }, 201);
  }
  const eventMatch = path.match(/^\/admin\/events\/(\d+)$/);
  if (method === 'DELETE' && eventMatch) {
    await db.prepare('DELETE FROM events WHERE id=?').bind(Number(eventMatch[1])).run();
    return json({ ok: true });
  }
  if (method === 'GET' && path === '/admin/google/status') {
    const token = await db.prepare("SELECT key FROM settings WHERE key='google_calendar_token'").first();
    const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
    return json({ configured, connected: Boolean(token), redirectUri: env.GOOGLE_REDIRECT_URI || '', calendarId: env.GOOGLE_CALENDAR_ID || 'primary' });
  }
  if (method === 'GET' && path === '/admin/google/connect') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) return fail('Add Google Calendar OAuth credentials and callback URL to Cloudflare Pages secrets.');
    const session = await ensureAdmin(request, db);
    const state = randomToken(24);
    const returnTo = env.APP_BASE_URL || url.origin;
    await db.prepare('INSERT INTO oauth_states(state,session_hash,return_to,expires_at) VALUES(?,?,?,?)').bind(state, await sha256(session.token), returnTo, Date.now() + 10 * 60_000).run();
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events', access_type: 'offline', prompt: 'consent', state }).toString();
    return Response.redirect(auth.toString(), 302);
  }
  if (method === 'GET' && path === '/admin/google/callback') {
    const token = parseCookies(request)[SESSION_COOKIE];
    const sessionHash = token ? await sha256(token) : '';
    const state = String(url.searchParams.get('state') || '');
    const stateRecord = await db.prepare('SELECT * FROM oauth_states WHERE state=?').bind(state).first();
    const destination = env.APP_BASE_URL || url.origin;
    const dashboard = new URL('/admin', destination);
    if (!stateRecord || stateRecord.expires_at < Date.now() || stateRecord.session_hash !== sessionHash) {
      dashboard.searchParams.set('google', 'error');
      return Response.redirect(dashboard.toString(), 302);
    }
    await db.prepare('DELETE FROM oauth_states WHERE state=?').bind(state).run();
    if (url.searchParams.has('error')) {
      dashboard.searchParams.set('google', 'error');
      return Response.redirect(dashboard.toString(), 302);
    }
    const params = new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: env.GOOGLE_CLIENT_ID || '', client_secret: env.GOOGLE_CLIENT_SECRET || '', redirect_uri: env.GOOGLE_REDIRECT_URI || '', grant_type: 'authorization_code' });
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    const result = await response.json();
    if (!response.ok || !result.access_token || !result.refresh_token) {
      dashboard.searchParams.set('google', 'error');
      return Response.redirect(dashboard.toString(), 302);
    }
    await db.prepare("INSERT INTO settings(key,value) VALUES('google_calendar_token',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({ access_token: result.access_token, refresh_token: result.refresh_token, expires_at: Date.now() + result.expires_in * 1000, scope: result.scope || '', updated_at: new Date().toISOString() })).run();
    dashboard.searchParams.set('google', 'connected');
    return Response.redirect(dashboard.toString(), 302);
  }
  if (method === 'POST' && path === '/admin/google/disconnect') {
    await db.prepare("DELETE FROM settings WHERE key='google_calendar_token'").run();
    return json({ ok: true });
  }
  return fail('API endpoint not found.', 404);
}

export async function onRequest(context) {
  try {
    if (!context.env.DB) return fail('D1 binding DB is not configured for this Pages project.', 503);
    await seedAvailability(context.env.DB, context.env);
    return await route(context);
  } catch (error) {
    console.error('Cloudflare API error:', error);
    return fail(error.message || 'Something went wrong. Please try again.', error.status || 500);
  }
}
