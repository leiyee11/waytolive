import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, Facebook, Heart, Instagram, Menu, Music2, Sparkles, X, Youtube } from 'lucide-react';
import AdminDashboard from './AdminDashboard.jsx';
import './style.css';

const offerings = [
  { number: '01', title: 'One-to-one counselling', type: 'COUNSELLING', copy: 'A calm, confidential space to untangle what feels heavy and find your own way forward.', duration: '50 minutes', price: '$90', icon: Heart },
  { number: '02', title: 'Guided meditation', type: 'MEDITATION', copy: 'Gentle, practical sessions to help you slow down, reconnect, and make room for the present.', duration: '30 minutes', price: '$45', icon: Sparkles },
  { number: '03', title: 'The first conversation', type: 'FREE · 20 MIN', copy: 'Not sure where to begin? Let’s meet for a no-pressure chat and see what feels right.', duration: '20 minutes', price: 'Free', icon: Clock3 },
];

const certificates = [
  { title: 'Reiki Level 2 · Okuden', date: '19 March 2023', image: '/certificates/reiki-level-2-okuden.jpeg' },
  { title: 'Prana · Intermediate Level', date: '24 February 2023', image: '/certificates/prana-intermediate.jpeg' },
  { title: 'Prana · Advanced Level', date: '26 June 2023', image: '/certificates/prana-advanced.jpeg' },
  { title: 'Reiki Level 1 · Shoden', date: '17 December 2022', image: '/certificates/reiki-level-1-shoden.jpeg' },
  { title: 'Prana · Foundation Level', date: '30 December 2022', image: '/certificates/prana-foundation.jpeg' },
  { title: 'Chakra Temple · Meditation Facilitator', date: '1 August 2022', image: '/certificates/chakra-temple-meditation-facilitator.jpeg' },
  { title: 'Trained LPI Practitioner', date: 'February 2023', image: '/certificates/lpi-practitioner.jpeg' },
  { title: 'Self Emotional Awareness · Practitioner', date: '26 February 2023', image: '/certificates/self-emotional-awareness-practitioner.jpeg' },
];

const heroSlides = [
  { image: '/images/may-by-the-river.jpg', alt: 'May sitting beside a flowing river in a green garden', caption: 'Find stillness in nature' },
  { image: '/images/may-in-the-mountains.jpg', alt: 'May in the mountains', caption: 'Make space to begin again' },
  { image: '/images/may-community-session.jpg', alt: 'May sharing reflections with participants during an outdoor group session', caption: 'A moment shared in community' },
];

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const result = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status}).`);
  return result;
}

function formatEventDate(value) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function businessToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function App() {
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState(offerings[0].title);
  const [confirmed, setConfirmed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [sessionFormat, setSessionFormat] = useState('Online');
  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const availableTimes = availableSlots;

  useEffect(() => {
    apiRequest('/api/events').then(setUpcomingEvents).catch(() => setUpcomingEvents([]));
  }, []);

  useEffect(() => {
    if (!bookingDate) { setAvailableSlots([]); setAvailabilityError(''); return; }
    const controller = new AbortController();
    setAvailableSlots([]); setAvailabilityError(''); setAvailabilityLoading(true);
    apiRequest(`/api/availability?date=${encodeURIComponent(bookingDate)}`, { signal: controller.signal })
      .then((result) => setAvailableSlots(result.slots || []))
      .catch((error) => { if (error.name !== 'AbortError') setAvailabilityError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [bookingDate]);

  useEffect(() => {
    if (sliderPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, [sliderPaused]);

  useEffect(() => {
    const targets = document.querySelectorAll('.hero-copy,.photo-banner,.approach,.portfolio-heading,.portfolio-grid > .portfolio-card,.certificates-heading,.certificate-card,.sessions-heading,.offering,.quote-section,.cta-section,.footer');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        activeObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -28px 0px' });

    targets.forEach((target, index) => {
      target.style.setProperty('--reveal-delay', `${(index % 3) * 90}ms`);
      target.classList.add('scroll-reveal');
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  function moveSlide(direction) {
    setActiveSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  function openBooking(service = offerings[0].title) {
    setSelected(service); setConfirmed(false); setBooking(true); setMenuOpen(false); setBookingDate(''); setBookingTime(''); setAvailableSlots([]); setBookingError(''); setSessionFormat('Online');
  }

  async function submitBooking(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmittingBooking(true); setBookingError('');
    try {
      await apiRequest('/api/bookings', { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) });
      setConfirmed(true);
    } catch (error) { setBookingError(error.message); }
    finally { setSubmittingBooking(false); }
  }

  return <>
    <header className="nav wrap">
      <a className="brand" href="#home" aria-label="Way to Live home"><span className="brand-mark">w.</span><span>way to live</span></a>
      <button className="menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <a href="#way-to-live" onClick={() => setMenuOpen(false)}>About</a><a href="#sessions" onClick={() => setMenuOpen(false)}>Sessions</a><a href="#about" onClick={() => setMenuOpen(false)}>About May</a>
        <div className="nav-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div>
        <button className="nav-cta" onClick={() => openBooking()}>Book a session <ArrowUpRight size={15} /></button>
      </nav>
    </header>

    <main>
      <section className="hero wrap" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> WAY TO LIVE · WELLBEING, YOUR WAY</div>
          <h1>Come back<br />to <em>yourself.</em></h1>
          <p className="hero-lede">Mindful reflections for a conscious life. Where Eastern wisdom meets modern living, to help you heal, grow, and begin again, one present moment at a time. 🌿</p>
          <div className="hero-actions"><button className="button button-dark" onClick={() => openBooking()}>Find your space <ArrowRight size={17} /></button><a className="text-link" href="#approach">A little about how I work <ArrowDown size={14} /></a></div>
          <div className="hero-note"><div className="avatar-stack"><span>✳</span><span>✳</span><span>✳</span></div><span>One step at a time.<br /><b>Always at your pace.</b></span></div>
        </div>
        <div className="hero-art photo-banner" role="region" aria-label="May in nature photo slider" aria-roledescription="carousel" onMouseEnter={() => setSliderPaused(true)} onMouseLeave={() => setSliderPaused(false)} onFocus={() => setSliderPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSliderPaused(false); }}>
          {heroSlides.map((slide, index) => <figure className={`banner-photo${activeSlide === index ? ' active' : ''}`} key={slide.image} aria-hidden={activeSlide !== index}><img src={slide.image} alt={slide.alt} /><figcaption>{slide.caption}</figcaption></figure>)}
          <div className="slider-controls"><button type="button" aria-label="Previous photo" onClick={() => moveSlide(-1)}><ChevronLeft size={18} /></button><div className="slider-dots">{heroSlides.map((slide, index) => <button type="button" key={slide.image} className={activeSlide === index ? 'active' : ''} aria-label={`Show photo ${index + 1}`} aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)} />)}</div><button type="button" aria-label="Next photo" onClick={() => moveSlide(1)}><ChevronRight size={18} /></button></div>
        </div>
      </section>

      <section className="ticker" aria-label="Our values"><div className="ticker-track"><span>MAKE ROOM TO BREATHE</span><b>✳</b><span>MEET YOURSELF WITH KINDNESS</span><b>✳</b><span>YOU DON'T HAVE TO HAVE IT FIGURED OUT</span><b>✳</b><span>MAKE ROOM TO BREATHE</span></div></section>

      <section className="approach section wrap" id="approach">
        <div className="section-label">A GENTLER WAY FORWARD <span>↘</span></div>
        <div className="approach-content"><h2>You don’t have to<br />carry it <em>all alone.</em></h2><div className="approach-text"><p>Somewhere along the way, we can lose the feeling of being at home in ourselves. The overthinking, the doing, the trying to keep it all together.</p><p>Here, there’s no fixing or rushing. Just a grounded, compassionate space to listen to what you need and begin from there.</p><a className="text-link underline-link" href="#about">Get to know May <ArrowRight size={15} /></a></div></div>
        <div className="values-row"><div><span>01</span><b>Come as you are</b><small>No perfect words required.</small></div><div><span>02</span><b>Your pace, always</b><small>We go one breath at a time.</small></div><div><span>03</span><b>Care that feels human</b><small>Warm, honest, and just for you.</small></div></div>
      </section>

      <section className="portfolio section" id="way-to-live">
        <div className="wrap"><div className="portfolio-heading"><div><div className="section-label">THE PERSON BEHIND THE PRACTICE <span>↘</span></div><h2>About <em>Way to Live.</em></h2></div><p>A little about the practice, the person, and the experience behind each session.</p></div>
          <div className="portfolio-grid">
            <article className="portfolio-card personal-card" id="about"><span className="portfolio-index">01 / PERSONAL</span><div className="portrait-mark">m.</div><h3>Hi, I’m May.</h3><p>I’m a counsellor and meditation guide who believes wellbeing should feel personal, practical, and welcoming. My work makes space for you to arrive as you are.</p><div className="personal-facts"><span>BASED IN <b>Chiang Mai, Thailand</b></span><span>WORKING IN <b>Counselling · Meditation</b></span></div></article>
            <article className="portfolio-card credentials-card"><span className="portfolio-index">02 / LEARNING & PRACTICE</span><h3>Grounded in care.</h3><p>Training across meditation facilitation, Reiki, Prana, and coaching informs my ongoing learning and practice.</p><ul className="credential-list"><li><span>✳</span><div><b>Reiki · Shoden & Okuden</b><small>Level 1 and Level 2 certificates</small></div></li><li><span>✳</span><div><b>Prana · Foundation to Advanced</b><small>Foundation, Intermediate, and Advanced certificates</small></div></li></ul></article>
            <article className="portfolio-card events-card"><span className="portfolio-index">03 / IN COMMUNITY</span><figure className="event-photo"><img src="/images/may-community-session.jpg" alt="May speaking with participants during an outdoor group session" /></figure><h3>Making space,<br /><em>together.</em></h3><p>Sharing mindful practice and reflections in a group setting.</p><div className="event-tags"><span>COMMUNITY SESSION</span><span>GROUP PRACTICE</span></div></article>
          </div>
          <div className="certificates-heading"><div><div className="section-label">TRAINING & CERTIFICATES <span>↘</span></div><h3>Learning, <em>honoured.</em></h3></div><p>Certificates in meditation facilitation, Reiki, Prana, LPI practice, and self emotional awareness.</p></div>
          <div className="certificates-grid">{certificates.map((certificate) => <figure className="certificate-card" key={certificate.title}><a href={certificate.image} target="_blank" rel="noreferrer" aria-label={`View ${certificate.title} certificate`}><img src={certificate.image} alt={`${certificate.title} certificate for May Thinzar Oo`} loading="lazy" /></a><figcaption><b>{certificate.title}</b><span>{certificate.date}</span></figcaption></figure>)}</div>
        </div>
      </section>

      <section className="sessions section" id="sessions"><div className="wrap"><div className="sessions-heading"><div><div className="section-label">WAYS WE CAN WORK TOGETHER <span>↘</span></div><h2>A place to <em>begin.</em></h2></div><p>There’s no one-size-fits-all way to feel better. Let’s find what meets you where you are.</p></div>
        <div className="offerings">{offerings.map(({ number, title, type, copy, duration, price, icon: Icon }) => <article className="offering" key={number}><div className="offering-top"><span>{number}</span><Icon size={19} strokeWidth={1.5} /></div><div className="offering-type">{type}</div><h3>{title}</h3><p>{copy}</p><div className="offering-bottom"><span>{duration} <i /> {price}</span><button aria-label={`Book ${title}`} onClick={() => openBooking(title)}><ArrowUpRight size={18} /></button></div></article>)}</div>
      </div></section>

      {upcomingEvents.length > 0 && <section className="public-events section"><div className="wrap"><div className="section-label">GATHER WITH WAY TO LIVE <span>↘</span></div><h2>Upcoming <em>events.</em></h2><div className="public-event-grid">{upcomingEvents.map((item) => <article className="public-event-card" key={item.id}><span className="event-date">{formatEventDate(item.starts_at)}</span><h3>{item.title}</h3>{item.location && <p className="event-location">{item.location}</p>}{item.description && <p>{item.description}</p>}<button className="text-link" onClick={() => openBooking(offerings[2].title)}>Ask about this event <ArrowRight size={15} /></button></article>)}</div></div></section>}

      <section className="quote-section wrap" id="about-may"><div className="quote-mark">“</div><div><div className="section-label">A NOTE FROM MAY</div><blockquote>You are not behind. You are not too much. You are a person, finding your way — and that is enough.</blockquote><div className="quote-author"><span className="may-avatar">m.</span><span><b>May</b><small>THERAPIST & MEDITATION GUIDE</small></span></div></div><div className="quote-flower">✳</div></section>

      <section className="cta-section"><div className="cta-orb orb-one" /><div className="cta-orb orb-two" /><div className="cta-inner"><div className="eyebrow light"><span className="eyebrow-dot" /> WHENEVER YOU’RE READY</div><h2>You can start<br />right <em>here.</em></h2><p>No pressure to know what to say. Just a first, small step.</p><button className="button button-light" onClick={() => openBooking(offerings[2].title)}>Let’s have a first chat <ArrowRight size={17} /></button></div><span className="cta-spark">✳</span></section>
    </main>

    <footer className="footer wrap"><a className="brand" href="#home"><span className="brand-mark">w.</span><span>way to live</span></a><span className="footer-note">A little more at home in yourself.</span><div className="footer-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div><span className="copyright">© 2025 WAY TO LIVE · MADE WITH CARE</span><a className="dashboard-link" href="/admin">Dashboard</a></footer>

    {booking && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setBooking(false); }}><section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="modal-close" aria-label="Close booking form" onClick={() => setBooking(false)}><X size={20} /></button>{confirmed ? <div className="confirmation"><span className="confirm-icon"><Check size={25} /></span><div className="eyebrow">YOUR FIRST STEP</div><h2>Thank you for<br /><em>reaching out.</em></h2><p>Your request is in the Way to Live dashboard. May can review it and follow up about a time that works for you.</p><button className="button button-dark" onClick={() => setBooking(false)}>Back to Way to Live <ArrowRight size={17} /></button></div> : <><div className="eyebrow"><span className="eyebrow-dot" /> A GOOD PLACE TO START</div><h2 id="booking-title">Let’s find a time.</h2><p className="modal-intro">Share a little, and we’ll take it from there. No pressure, ever.</p><form onSubmit={submitBooking}>
      <label>Your name<input required name="name" placeholder="The name you go by" autoComplete="name" /></label><label>Email address<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label>
      <label>Preferred date<input required name="date" type="date" min={businessToday()} value={bookingDate} onChange={(e) => { setBookingDate(e.target.value); setBookingTime(''); }} /></label>
      <div className="form-row"><label>Available time<select required name="time" value={bookingTime} disabled={!bookingDate || availabilityLoading || availableTimes.length === 0} onChange={(e) => setBookingTime(e.target.value)}><option value="">{!bookingDate ? 'Choose a date first' : availabilityLoading ? 'Checking availability…' : availableTimes.length ? 'Choose a time' : 'No times available'}</option>{availableTimes.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select>{bookingDate && <small className="availability-hint">{availabilityError || (availabilityLoading ? 'Checking May’s calendar…' : availableTimes.length ? 'Live availability for this date.' : 'No times available on this date. Please choose another date.')}</small>}</label><label>Session format<select name="format" value={sessionFormat} onChange={(e) => setSessionFormat(e.target.value)}><option>Online</option><option>In-person</option></select></label></div>
      {sessionFormat === 'In-person' && <p className="inperson-note">In-person sessions are available. We’ll share the meeting location when confirming your request.</p>}
      <label>Session<select name="service" value={selected} onChange={(e) => setSelected(e.target.value)}>{offerings.map(o => <option key={o.title}>{o.title}</option>)}</select></label>
      <label>Anything you’d like me to know? <span className="optional">OPTIONAL</span><textarea name="note" rows="3" placeholder="It’s okay to keep this brief." /></label>
      {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}<button className="button button-dark submit-button" type="submit" disabled={submittingBooking}>{submittingBooking ? 'Sending request…' : 'Send a booking request'} {!submittingBooking && <ArrowRight size={17} />}</button><small className="privacy-note">Your details stay private and are only used to get back to you.</small>
    </form></>}</section></div>}
  </>;
}

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/admin') ? <AdminDashboard /> : <App />);
