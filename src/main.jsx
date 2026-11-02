import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, Facebook, Heart, Instagram, Menu, Music2, Sparkles, X, Youtube } from 'lucide-react';
import AdminDashboard from './AdminDashboard.jsx';
import './i18n.js';
import { useTranslation } from 'react-i18next';
import './style.css';

const offerings = [
  { number: '01', title: 'One-to-one counselling', titleKey: 'serviceCounselling', type: 'COUNSELLING', typeKey: 'serviceCounsellingType', copy: 'A calm, confidential space to untangle what feels heavy and find your own way forward.', copyKey: 'serviceCounsellingCopy', duration: '50 minutes', price: '$90', icon: Heart },
  { number: '02', title: 'Guided meditation', titleKey: 'serviceMeditation', type: 'MEDITATION', typeKey: 'serviceMeditationType', copy: 'Gentle, practical sessions to help you slow down, reconnect, and make room for the present.', copyKey: 'serviceMeditationCopy', duration: '30 minutes', price: '$45', icon: Sparkles },
  { number: '03', title: 'The first conversation', titleKey: 'serviceIntro', type: 'FREE · 20 MIN', typeKey: 'serviceIntroType', copy: 'Not sure where to begin? Let’s meet for a no-pressure chat and see what feels right.', copyKey: 'serviceIntroCopy', duration: '20 minutes', price: 'Free', icon: Clock3 },
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    credentials: 'include',
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
  const { t, i18n } = useTranslation();
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
    document.documentElement.lang = i18n.language === 'my' ? 'my' : 'en';
    localStorage.setItem('waytolive-language', i18n.language);
  }, [i18n.language]);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my');
  }

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
        <a href="#way-to-live" onClick={() => setMenuOpen(false)}>{t('navAbout')}</a><a href="#sessions" onClick={() => setMenuOpen(false)}>{t('navSessions')}</a><a href="#about" onClick={() => setMenuOpen(false)}>{t('navMay')}</a>
        <div className="nav-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div>
        <button className="language-toggle" type="button" onClick={toggleLanguage} aria-label={`Change language to ${t('language')}`}>{t('language')}</button><button className="nav-cta" onClick={() => openBooking()}>{t('bookSession')} <ArrowUpRight size={15} /></button>
      </nav>
    </header>

    <main>
      <section className="hero wrap" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> {t('eyebrow')}</div>
          <h1>{t('heroTitle')}<br /><em>{t('heroYourself')}</em></h1>
          <p className="hero-lede">{t('heroLead')}</p>
          <div className="hero-actions"><button className="button button-dark" onClick={() => openBooking()}>{t('findSpace')} <ArrowRight size={17} /></button><a className="text-link" href="#approach">{t('approachLink')} <ArrowDown size={14} /></a></div>
          <div className="hero-note"><div className="avatar-stack"><span>✳</span><span>✳</span><span>✳</span></div><span>{t('oneStep')}<br /><b>{t('atPace')}</b></span></div>
        </div>
        <div className="hero-art photo-banner" role="region" aria-label={t('slideRegion')} aria-roledescription="carousel" onMouseEnter={() => setSliderPaused(true)} onMouseLeave={() => setSliderPaused(false)} onFocus={() => setSliderPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSliderPaused(false); }}>
          {heroSlides.map((slide, index) => <figure className={`banner-photo${activeSlide === index ? ' active' : ''}`} key={slide.image} aria-hidden={activeSlide !== index}><img src={slide.image} alt={slide.alt} /><figcaption>{slide.caption}</figcaption></figure>)}
          <div className="slider-controls"><button type="button" aria-label={t('previousPhoto')} onClick={() => moveSlide(-1)}><ChevronLeft size={18} /></button><div className="slider-dots">{heroSlides.map((slide, index) => <button type="button" key={slide.image} className={activeSlide === index ? 'active' : ''} aria-label={t('showPhoto', { number: index + 1 })} aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)} />)}</div><button type="button" aria-label={t('nextPhoto')} onClick={() => moveSlide(1)}><ChevronRight size={18} /></button></div>
        </div>
      </section>

      <section className="ticker" aria-label={t('tickerLabel')}><div className="ticker-track"><span>{t('ticker1')}</span><b>✳</b><span>{t('ticker2')}</span><b>✳</b><span>{t('ticker3')}</span><b>✳</b><span>{t('ticker1')}</span></div></section>

      <section className="approach section wrap" id="approach">
        <div className="section-label">{t('gentleWay')} <span>↘</span></div>
        <div className="approach-content"><h2>{t('carryTitle')}<br /><em>{t('carryEm')}</em></h2><div className="approach-text"><p>{t('carryText1')}</p><p>{t('carryText2')}</p><a className="text-link underline-link" href="#about">{t('knowMay')} <ArrowRight size={15} /></a></div></div>
        <div className="values-row"><div><span>01</span><b>{t('value1')}</b><small>{t('value1sub')}</small></div><div><span>02</span><b>{t('value2')}</b><small>{t('value2sub')}</small></div><div><span>03</span><b>{t('value3')}</b><small>{t('value3sub')}</small></div></div>
      </section>

      <section className="portfolio section" id="way-to-live">
        <div className="wrap"><div className="portfolio-heading"><div><div className="section-label">{t('personBehind')} <span>↘</span></div><h2>{t('aboutWay')} <em>{t('practice')}</em></h2></div><p>{t('practiceIntro')}</p></div>
          <div className="portfolio-grid">
            <article className="portfolio-card personal-card" id="about"><span className="portfolio-index">01 / {t('personal')}</span><div className="portrait-mark">m.</div><h3>{t('hiMay')}</h3><p>{t('bio')}</p><div className="personal-facts"><span>{t('basedIn')} <b>{t('location')}</b></span><span>{t('workingIn')} <b>{t('counsellingMeditation')}</b></span></div></article>
            <article className="portfolio-card credentials-card"><span className="portfolio-index">02 / {t('learning')}</span><h3>{t('grounded')}</h3><p>{t('training')}</p><ul className="credential-list"><li><span>✳</span><div><b>{t('reiki')}</b><small>{t('reikiCert')}</small></div></li><li><span>✳</span><div><b>{t('prana')}</b><small>{t('pranaCert')}</small></div></li></ul></article>
            <article className="portfolio-card events-card"><span className="portfolio-index">03 / {t('community')}</span><figure className="event-photo"><img src="/images/may-community-session.jpg" alt="May speaking with participants during an outdoor group session" /></figure><h3>{t('makingSpace')}<br /><em>{t('together')}</em></h3><p>{t('groupText')}</p><div className="event-tags"><span>{t('communitySession')}</span><span>{t('groupPractice')}</span></div></article>
          </div>
          <div className="certificates-heading"><div><div className="section-label">{t('certificates')} <span>↘</span></div><h3>{t('learningHonoured')} <em>{t('honoured')}</em></h3></div><p>{t('certIntro')}</p></div>
          <div className="certificates-grid">{certificates.map((certificate) => <figure className="certificate-card" key={certificate.title}><a href={certificate.image} target="_blank" rel="noreferrer" aria-label={`View ${certificate.title} certificate`}><img src={certificate.image} alt={`${certificate.title} certificate for May Thinzar Oo`} loading="lazy" /></a><figcaption><b>{certificate.title}</b><span>{certificate.date}</span></figcaption></figure>)}</div>
        </div>
      </section>

      <section className="sessions section" id="sessions"><div className="wrap"><div className="sessions-heading"><div><div className="section-label">{t('waysWork')} <span>↘</span></div><h2>{t('placeBegin')} <em>{t('begin')}</em></h2></div><p>{t('sessionsIntro')}</p></div>
        <div className="offerings">{offerings.map(({ number, title, titleKey, type, typeKey, copy, copyKey, duration, price, icon: Icon }) => <article className="offering" key={number}><div className="offering-top"><span>{number}</span><Icon size={19} strokeWidth={1.5} /></div><div className="offering-type">{t(typeKey)}</div><h3>{t(titleKey)}</h3><p>{t(copyKey)}</p><div className="offering-bottom"><span>{duration} <i /> {price}</span><button aria-label={t('bookingService', { service: t(titleKey) })} onClick={() => openBooking(title)}><ArrowUpRight size={18} /></button></div></article>)}</div>
      </div></section>

      {upcomingEvents.length > 0 && <section className="public-events section"><div className="wrap"><div className="section-label">{t('gather')} <span>↘</span></div><h2>{t('upcoming')} <em>{t('events')}</em></h2><div className="public-event-grid">{upcomingEvents.map((item) => <article className="public-event-card" key={item.id}><span className="event-date">{formatEventDate(item.starts_at)}</span><h3>{item.title}</h3>{item.location && <p className="event-location">{item.location}</p>}{item.description && <p>{item.description}</p>}<button className="text-link" onClick={() => openBooking(offerings[2].title)}>{t('askEvent')} <ArrowRight size={15} /></button></article>)}</div></div></section>}

      <section className="quote-section wrap" id="about-may"><div className="quote-mark">“</div><div><div className="section-label">{t('quoteLabel')}</div><blockquote>{t('quote')}</blockquote><div className="quote-author"><span className="may-avatar">m.</span><span><b>May</b><small>{t('therapist')}</small></span></div></div><div className="quote-flower">✳</div></section>

      <section className="cta-section"><div className="cta-orb orb-one" /><div className="cta-orb orb-two" /><div className="cta-inner"><div className="eyebrow light"><span className="eyebrow-dot" /> {t('ready')}</div><h2>{t('startHere')}<br /><em>{t('here')}</em></h2><p>{t('startText')}</p><button className="button button-light" onClick={() => openBooking(offerings[2].title)}>{t('firstChat')} <ArrowRight size={17} /></button></div><span className="cta-spark">✳</span></section>
    </main>

    <footer className="footer wrap"><a className="brand" href="#home"><span className="brand-mark">w.</span><span>way to live</span></a><span className="footer-note">{t('footerNote')}</span><div className="footer-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div><span className="copyright">{t('copyright')}</span><a className="dashboard-link" href="/admin">{t('dashboard')}</a></footer>

    {booking && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setBooking(false); }}><section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="modal-close" aria-label={t('closeBooking')} onClick={() => setBooking(false)}><X size={20} /></button>{confirmed ? <div className="confirmation"><span className="confirm-icon"><Check size={25} /></span><div className="eyebrow">{t('firstStep')}</div><h2>{t('thanks')}<br /><em>{t('reaching')}</em></h2><p>{t('confirmation')}</p><button className="button button-dark" onClick={() => setBooking(false)}>{t('backHome')} <ArrowRight size={17} /></button></div> : <><div className="eyebrow"><span className="eyebrow-dot" /> {t('goodStart')}</div><h2 id="booking-title">{t('bookingTitle')}</h2><p className="modal-intro">{t('modalIntro')}</p><form onSubmit={submitBooking}>
      <label>{t('yourName')}<input required name="name" placeholder={t('namePlaceholder')} autoComplete="name" /></label><label>{t('email')}<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label>
      <label>{t('preferredDate')}<input required name="date" type="date" min={businessToday()} value={bookingDate} onChange={(e) => { setBookingDate(e.target.value); setBookingTime(''); }} /></label>
      <div className="form-row"><label>{t('availableTime')}<select required name="time" value={bookingTime} disabled={!bookingDate || availabilityLoading || availableTimes.length === 0} onChange={(e) => setBookingTime(e.target.value)}><option value="">{!bookingDate ? t('chooseDate') : availabilityLoading ? t('checking') : availableTimes.length ? t('chooseTime') : t('noTimes')}</option>{availableTimes.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select>{bookingDate && <small className="availability-hint">{availabilityError || (availabilityLoading ? t('checkingCalendar') : availableTimes.length ? t('liveAvailability') : t('noTimesHint'))}</small>}</label><label>{t('sessionFormat')}<select name="format" value={sessionFormat} onChange={(e) => setSessionFormat(e.target.value)}><option value="Online">{t('online')}</option><option value="In-person">{t('inPerson')}</option></select></label></div>
      {sessionFormat === 'In-person' && <p className="inperson-note">{t('inPersonNote')}</p>}
      <label>{t('session')}<select name="service" value={selected} onChange={(e) => setSelected(e.target.value)}>{offerings.map(o => <option key={o.title} value={o.title}>{t(o.titleKey)}</option>)}</select></label>
      <label>{t('anythingKnow')} <span className="optional">{t('optional')}</span><textarea name="note" rows="3" placeholder={t('notePlaceholder')} /></label>
      {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}<button className="button button-dark submit-button" type="submit" disabled={submittingBooking}>{submittingBooking ? t('sending') : t('sendRequest')} {!submittingBooking && <ArrowRight size={17} />}</button><small className="privacy-note">{t('privacy')}</small>
    </form></>}</section></div>}
  </>;
}

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/admin') ? <AdminDashboard /> : <App />);
