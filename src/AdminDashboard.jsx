import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CalendarDays, Check, CircleDollarSign, ClipboardList, LogOut, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import './admin.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const result = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status}).`);
  return result;
}

const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const currentMonth = () => localDate().slice(0, 7);
const choices = ['08:00','09:00','10:00','10:30','11:00','11:30','12:00','13:00','14:00','14:30','15:00','15:30','16:00','17:00','18:00'];
const timeLabel = (value) => {
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const dateLabel = (value) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`));
const dateTimeLabel = (value) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
const inputDateTime = (date, hour) => `${date}T${hour}`;

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('Overview');
  const [month, setMonth] = useState(currentMonth());
  const [bookingSearch, setBookingSearch] = useState('');
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [google, setGoogle] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState(localDate());
  const [draftSlots, setDraftSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [newTime, setNewTime] = useState('');
  const [eventDraft, setEventDraft] = useState({ title: '', startsAt: '', endsAt: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request('/api/admin/session').then(() => setAuthenticated(true)).catch(() => setAuthenticated(false));
  }, []);

  async function refreshDashboard() {
    setError('');
    try {
      const [nextSummary, nextBookings, nextEvents, nextGoogle] = await Promise.all([
        request(`/api/admin/summary?month=${month}`),
        request('/api/admin/bookings'),
        request('/api/admin/events'),
        request('/api/admin/google/status'),
      ]);
      setSummary(nextSummary); setBookings(nextBookings); setEvents(nextEvents); setGoogle(nextGoogle);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { if (authenticated) refreshDashboard(); }, [authenticated, month]);

  useEffect(() => {
    if (!authenticated || !availabilityDate || tab !== 'Availability') return;
    let active = true;
    let initialLoad = true;
    const refreshAvailability = () => request(`/api/admin/availability?date=${encodeURIComponent(availabilityDate)}`)
      .then((result) => {
        if (!active) return;
        if (initialLoad) setDraftSlots(result.slots.filter((slot) => slot.enabled).map((slot) => slot.time));
        else setDraftSlots((current) => [...new Set([...current, ...result.booked.map((slot) => slot.time)])].sort());
        initialLoad = false;
        setBookedSlots(result.booked);
      })
      .catch((err) => { if (active) setError(err.message); });
    refreshAvailability();
    const interval = window.setInterval(refreshAvailability, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [authenticated, availabilityDate, tab]);

  async function signIn(event) {
    event.preventDefault(); setLoginError('');
    try {
      await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword(''); setAuthenticated(true);
    } catch (err) { setLoginError(err.message); }
  }

  async function signOut() {
    await request('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setAuthenticated(false); setSummary(null);
  }

  async function updateBooking(booking, patch) {
    setError(''); setNotice('');
    try {
      await request(`/api/admin/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice('Booking updated.'); await refreshDashboard();
    } catch (err) { setError(err.message); }
  }

  function toggleSlot(time) {
    if (bookedSlots.some((slot) => slot.time === time)) return;
    setDraftSlots((current) => current.includes(time) ? current.filter((item) => item !== time) : [...current, time].sort());
  }

  async function saveAvailability(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await request('/api/admin/availability', { method: 'PUT', body: JSON.stringify({ date: availabilityDate, slots: draftSlots }) });
      setNotice(`Availability saved for ${dateLabel(availabilityDate)}.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function createEvent(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await request('/api/admin/events', { method: 'POST', body: JSON.stringify(eventDraft) });
      setEventDraft({ title: '', startsAt: '', endsAt: '', location: '', description: '' });
      setNotice('Event created and published.'); await refreshDashboard();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function deleteEvent(id) {
    try { await request(`/api/admin/events/${id}`, { method: 'DELETE' }); setNotice('Event deleted.'); await refreshDashboard(); }
    catch (err) { setError(err.message); }
  }

  if (authenticated === null) return <div className="admin-loading">Opening May’s dashboard…</div>;
  if (!authenticated) return <main className="admin-login"><a href="/" className="admin-back"><ArrowLeft size={16} /> Way to Live</a><section className="login-card"><span className="admin-monogram">w.</span><div className="admin-kicker">WAY TO LIVE · PRIVATE AREA</div><h1>Welcome back.</h1><p>Sign in to manage bookings, availability, and events.</p><form onSubmit={signIn}><label>Dashboard password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{loginError && <p className="admin-error" role="alert">{loginError}</p>}<button className="admin-primary" type="submit">Sign in</button></form><small>First run? The initial password is printed in the server terminal.</small></section></main>;

  const navItems = [
    { name: 'Overview', icon: CalendarClock },
    { name: 'Bookings', icon: ClipboardList },
    { name: 'Availability', icon: CalendarDays },
    { name: 'Events', icon: Plus },
    { name: 'Google Calendar', icon: Check },
  ];
  const availabilityChoices = Array.from(new Set([...choices, ...draftSlots, ...bookedSlots.map((slot) => slot.time)])).sort();
  const bookingQuery = bookingSearch.trim().toLocaleLowerCase();
  const visibleBookings = bookings.filter((booking) => booking.date.startsWith(month) && (!bookingQuery || [booking.name, booking.email, booking.service, booking.format, booking.country, booking.date, booking.time, booking.status, booking.payment_status, booking.note, booking.participant_count].filter(Boolean).join(' ').toLocaleLowerCase().includes(bookingQuery)));

  return <main className="admin-shell">
    <aside className="admin-sidebar"><a href="/" className="admin-brand"><span className="admin-monogram">w.</span><span>way to live<small>STUDIO DASHBOARD</small></span></a><nav>{navItems.map(({ name, icon: Icon }) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setError(''); setNotice(''); }}><Icon size={17} />{name}{name === 'Bookings' && summary?.pendingCount > 0 && <i>{summary.pendingCount}</i>}</button>)}</nav><button className="admin-signout" onClick={signOut}><LogOut size={16} /> Sign out</button></aside>
    <section className="admin-main"><header className="admin-topbar"><div><span className="admin-kicker">WAY TO LIVE · CHIANG MAI</span><h1>{tab}</h1></div><div className="admin-top-actions"><a href="/" target="_blank" rel="noreferrer">View site <ArrowLeft size={14} /></a><button onClick={refreshDashboard} aria-label="Refresh dashboard"><RefreshCw size={16} /></button></div></header>
      {error && <div className="admin-alert error" role="alert">{error}</div>}{notice && <div className="admin-alert success"><Check size={15} />{notice}</div>}

      {tab === 'Overview' && <>
        <div className="admin-overview-tools"><label>Sales month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></div>
        <div className="metric-grid"><article><span>MONTHLY SALES</span><b>{Object.entries(summary?.salesByCurrency || {}).length ? Object.entries(summary.salesByCurrency).map(([currency, cents]) => `${currency === 'THB' ? '฿' : currency === 'MMK' ? 'MMK ' : '$'}${(cents / 100).toLocaleString('en-US',{minimumFractionDigits:currency === 'MMK' ? 0 : 2})}`).join(' · ') : '฿0'}</b><small>{summary?.paidCount || 0} paid bookings</small></article><article><span>NEEDS REVIEW</span><b>{summary?.pendingCount || 0}</b><small>pending booking requests</small></article><article><span>UPCOMING EVENTS</span><b>{summary?.upcomingEvents || 0}</b><small>published on the site</small></article><article><span>CALENDAR</span><b className="metric-status">{google?.connected ? 'Connected' : 'Not connected'}</b><small>Google Calendar sync</small></article></div>
        <div className="admin-panel"><div className="panel-title"><div><span className="admin-kicker">RECENT CLIENT REQUESTS</span><h2>Bookings to review</h2></div><button className="admin-subtle" onClick={() => setTab('Bookings')}>View all <ArrowLeft size={14} /></button></div>{bookings.slice(0,4).length ? <div className="booking-list">{bookings.slice(0,4).map((booking) => <BookingRow key={booking.id} booking={booking} onUpdate={updateBooking} />)}</div> : <Empty message="No booking requests yet. New requests will appear here." />}</div>
      </>}

      {tab === 'Bookings' && <div className="admin-panel"><div className="panel-title"><div><span className="admin-kicker">CLIENT REQUESTS</span><h2>Bookings</h2></div><div className="booking-filters"><label className="month-filter">Filter by date<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><label className="booking-search"><Search size={15} aria-hidden="true" /><input type="search" value={bookingSearch} onChange={(e) => setBookingSearch(e.target.value)} placeholder="Search bookings" aria-label="Search bookings" /></label></div></div>{visibleBookings.length ? <div className="booking-list">{visibleBookings.map((booking) => <BookingRow key={booking.id} booking={booking} onUpdate={updateBooking} />)}</div> : <Empty message={bookingQuery ? 'No bookings match your search.' : 'No bookings for this month yet.'} />}</div>}

      {tab === 'Availability' && <div className="admin-panel availability-panel"><div className="panel-title"><div><span className="admin-kicker">PUBLIC BOOKING SCHEDULE</span><h2>Available dates & times</h2></div><label>Select date<input type="date" min={localDate()} value={availabilityDate} onChange={(e) => setAvailabilityDate(e.target.value)} /></label></div><p className="panel-copy">Choose the times clients can request on this date. Booked times are marked unavailable automatically.</p><form onSubmit={saveAvailability}><div className="time-grid">{availabilityChoices.map((time) => { const booking = bookedSlots.find((slot) => slot.time === time); const locked = Boolean(booking); const available = draftSlots.includes(time) && !locked; return <label key={time} className={`${available ? 'checked' : ''}${locked ? ' locked booked' : ''}`}><input type="checkbox" checked={available} disabled={locked} onChange={() => toggleSlot(time)} /><span>{available ? <Check size={13} /> : <i />}</span>{timeLabel(time)}{locked && <small>Unavailable · {booking.status}</small>}</label>; })}</div><div className="availability-extra"><label>Add a custom time<input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></label><button type="button" className="admin-subtle" disabled={!newTime} onClick={() => { if (!draftSlots.includes(newTime)) setDraftSlots((current) => [...current,newTime].sort()); setNewTime(''); }}><Plus size={15} /> Add time</button></div><button className="admin-primary save-availability" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save availability'} <Save size={16} /></button></form></div>}

      {tab === 'Events' && <div className="events-admin-grid"><section className="admin-panel"><div className="panel-title"><div><span className="admin-kicker">PUBLISH TO THE LANDING PAGE</span><h2>Create an event</h2></div></div><form className="event-form" onSubmit={createEvent}><label>Event name<input required maxLength="120" value={eventDraft.title} onChange={(e) => setEventDraft({ ...eventDraft,title:e.target.value })} placeholder="Mindful Sunday gathering" /></label><div className="event-form-row"><label>Starts<input required type="datetime-local" value={eventDraft.startsAt} onChange={(e) => setEventDraft({ ...eventDraft,startsAt:e.target.value })} /></label><label>Ends<input required type="datetime-local" value={eventDraft.endsAt} onChange={(e) => setEventDraft({ ...eventDraft,endsAt:e.target.value })} /></label></div><label>Location<input maxLength="200" value={eventDraft.location} onChange={(e) => setEventDraft({ ...eventDraft,location:e.target.value })} placeholder="Chiang Mai or Online" /></label><label>Details<textarea rows="4" maxLength="3000" value={eventDraft.description} onChange={(e) => setEventDraft({ ...eventDraft,description:e.target.value })} placeholder="A short description for visitors" /></label><button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Create event'} <Plus size={16} /></button></form></section><section className="admin-panel"><div className="panel-title"><div><span className="admin-kicker">EVENTS ON YOUR SITE</span><h2>Created events</h2></div></div><div className="event-admin-list">{events.length ? events.map((item) => <article key={item.id}><div><span>{dateTimeLabel(item.starts_at)}</span><h3>{item.title}</h3>{item.location && <small>{item.location}</small>}</div><button className="icon-danger" aria-label={`Delete ${item.title}`} onClick={() => deleteEvent(item.id)}><Trash2 size={16} /></button></article>) : <Empty message="No events yet. Create one to feature it on the landing page." />}</div></section></div>}

      {tab === 'Google Calendar' && <section className="admin-panel google-panel"><div className="google-orb"><CalendarDays size={30} /></div><span className="admin-kicker">CALENDAR AVAILABILITY & SESSION HOLDS</span><h2>{google?.connected ? 'May’s calendar is connected.' : 'Connect May’s Google Calendar.'}</h2><p>Available slots are checked against calendar conflicts. New booking requests add a private, generic hold. Client names and notes are kept in this dashboard, not in calendar events.</p>{!google?.configured && <div className="setup-note"><b>One-time setup needed</b><span>Add Google Calendar OAuth credentials and the callback URL to Cloudflare Pages secrets, then redeploy the Pages project.</span></div>}{google?.connected ? <button className="admin-subtle" onClick={async () => { await request('/api/admin/google/disconnect',{method:'POST'}); await refreshDashboard(); }}>Disconnect calendar</button> : <a className={`admin-primary google-connect${!google?.configured ? ' disabled' : ''}`} href={google?.configured ? `${API_BASE_URL}/api/admin/google/connect` : '#google-setup'} onClick={(e) => { if (!google?.configured) e.preventDefault(); }}>Connect Google Calendar <ArrowLeft size={15} /></a>}<small>Required OAuth scope: Google Calendar events. Booking availability will update from the connected calendar.</small></section>}
    </section>
  </main>;
}

function BookingRow({ booking, onUpdate }) {
  const [amount, setAmount] = useState(String(Number(booking.price_cents / 100).toFixed(2)));
  const [noteOpen, setNoteOpen] = useState(Boolean(booking.note));
  const currency = booking.currency || 'USD';
  const symbol = currency === 'THB' ? '฿' : currency === 'MMK' ? 'MMK ' : '$';
  return <article className="booking-row"><div className="booking-row-main"><div className="booking-person"><div className="booking-avatar">{booking.name.slice(0,1).toUpperCase()}</div><div><b>{booking.name}</b><a href={`mailto:${booking.email}`}>{booking.email}</a></div></div><div className="booking-facts"><span>{dateLabel(booking.date)} · {timeLabel(booking.time)}</span><span>{booking.service} · {booking.format} · {booking.country || 'Thailand'}{booking.participant_count > 1 ? ` · ${booking.participant_count} people` : ''}</span></div><div className="booking-selects"><label>Status<select value={booking.status} onChange={(e) => onUpdate(booking,{status:e.target.value})}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Payment<select value={booking.payment_status} onChange={(e) => onUpdate(booking,{paymentStatus:e.target.value,amount})}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label></div></div>{noteOpen && <div className="client-note"><span>CLIENT NOTE</span><p>{booking.note || 'No note provided.'}</p></div>}<div className="booking-row-foot"><span className={`status-chip ${booking.status}`}>{booking.status}</span><span className="sync-state">Calendar: {booking.calendar_sync_status.replaceAll('_',' ')}</span><label className="amount-editor">Sale <span>{symbol}</span><input type="number" min="0" step={currency === 'MMK' ? '1' : '0.01'} value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => { if (Number(amount) !== booking.price_cents/100) onUpdate(booking,{amount,paymentStatus:booking.payment_status}); }} /></label>{booking.note && <button className="note-toggle" onClick={() => setNoteOpen(!noteOpen)}>{noteOpen ? 'Hide note' : 'Read client note'}</button>}</div></article>;
}

function Empty({ message }) { return <div className="admin-empty">{message}</div>; }
