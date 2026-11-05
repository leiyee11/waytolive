import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, Facebook, Heart, Instagram, Menu, Music2, Search, Sparkles, X, Youtube } from 'lucide-react';
import AdminDashboard from './AdminDashboard.jsx';
import './i18n.js';
import { useTranslation } from 'react-i18next';
import './style.css';

const offerings = [
  { number: '01', title: 'One-to-one counselling', titleKey: 'serviceCounselling', type: 'COUNSELLING · DISCUSSION', typeKey: 'serviceCounsellingType', copy: 'A calm, confidential one-hour space to untangle what feels heavy and find your own way forward.', copyKey: 'serviceCounsellingCopy', duration: '1 hour', price: 'Online ฿300 · In-person ฿500', myanmarPrice: 'Myanmar online: 30,000 MMK', icon: Heart },
  { number: '02', title: 'Breathwork + meditation (private)', titleKey: 'serviceBreathwork', type: 'PRIVATE SESSION', typeKey: 'serviceBreathworkType', copy: 'A private breathwork and meditation session to help you slow down, reconnect, and make room for the present.', copyKey: 'serviceBreathworkCopy', duration: '1.5 hours', price: 'Online ฿500 · In-person ฿700', icon: Sparkles },
  { number: '03', title: 'Breathwork + meditation (group, up to 5 people)', titleKey: 'serviceGroup', type: 'GROUP SESSION · UP TO 5 PEOPLE', typeKey: 'serviceGroupType', copy: 'Share a guided breathwork and meditation practice with up to four other people.', copyKey: 'serviceGroupCopy', duration: '1.5 hours', price: 'Online ฿1,000 · In-person ฿1,500', priceNote: 'Fixed total for up to 5 people', icon: Sparkles },
  { number: '04', title: 'The first conversation', titleKey: 'serviceIntro', type: 'FREE · ONLINE ONLY', typeKey: 'serviceIntroType', copy: 'Not sure where to begin? Let’s meet online for a free 20-minute chat and see what feels right.', copyKey: 'serviceIntroCopy', duration: '20 minutes', price: 'Free · Online only', icon: Clock3 },
];

const moneyLabel = (amount, currency) => `${currency === 'THB' ? '฿' : 'MMK '}${Number(amount).toLocaleString('en-US')}`;
function selectedPrice(service, country, format) {
  if (country === 'Myanmar' && service === 'One-to-one counselling') return { amount: 30000, currency: 'MMK' };
  const rates = {
    'One-to-one counselling': { Online: 300, 'In-person': 500 },
    'Breathwork + meditation (private)': { Online: 500, 'In-person': 700 },
    'Breathwork + meditation (group, up to 5 people)': { Online: 1000, 'In-person': 1500 },
    'The first conversation': { Online: 0 },
  };
  return { amount: rates[service]?.[format] ?? 0, currency: 'THB' };
}

const certificates = [
  { title: 'Reiki Level 2 · Okuden', date: '19 March 2023', dateTime: '2023-03-19', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Prana · Intermediate Level', date: '24 February 2023', dateTime: '2023-02-24', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Prana · Advanced Level', date: '26 June 2023', dateTime: '2023-06-26', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Reiki Level 1 · Shoden', date: '17 December 2022', dateTime: '2022-12-17', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Prana · Foundation Level', date: '30 December 2022', dateTime: '2022-12-30', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Chakra Temple · Meditation Facilitator', date: '1 August 2022', dateTime: '2022-08-01', organization: 'Thu Global' },
  { title: 'Trained LPI Practitioner', date: 'February 2023', dateTime: '2023-02', organization: 'TRUST School of Healing and Therapeutic' },
  { title: 'Self Emotional Awareness · Practitioner', date: '26 February 2023', dateTime: '2023-02-26', organization: 'TRUST School of Healing and Therapeutic' },
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
function monthCalendar(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: first.getUTCDay() + count }, (_, index) => index < first.getUTCDay() ? null : `${month}-${String(index - first.getUTCDay() + 1).padStart(2, '0')}`);
}

function App() {
  const { t, i18n } = useTranslation();
  const [booking, setBooking] = useState(false);
  const [bookingLookupOpen, setBookingLookupOpen] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupCodeSent, setLookupCodeSent] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [selected, setSelected] = useState(offerings[0].title);
  const [confirmed, setConfirmed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [visibleMonth, setVisibleMonth] = useState(() => businessToday().slice(0, 7));
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [sessionFormat, setSessionFormat] = useState('Online');
  const [country, setCountry] = useState('Thailand');
  const [participantCount, setParticipantCount] = useState('3');
  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const availableTimes = bookingDate ? availabilityByDate[bookingDate] || [] : [];
  const onlineOnly = country === 'Myanmar' || selected === 'The first conversation';
  const price = selectedPrice(selected, country, sessionFormat);
  const bookingTotal = price.amount * selectedSlots.length;
  const filteredOfferings = offerings.filter((offering) => {
    const query = sessionSearch.trim().toLocaleLowerCase();
    return !query || [offering.title, t(offering.titleKey), offering.type, t(offering.typeKey), offering.copy, t(offering.copyKey), offering.duration, offering.price, offering.myanmarPrice].filter(Boolean).some((value) => value.toLocaleLowerCase().includes(query));
  });
  const calendarCells = monthCalendar(visibleMonth);
  const [calendarYear, calendarMonthNumber] = visibleMonth.split('-').map(Number);
  const calendarMonthDate = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1));
  const calendarMonthLabel = new Intl.DateTimeFormat(i18n.language === 'my' ? 'my' : 'en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarMonthDate);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(i18n.language === 'my' ? 'my' : 'en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + index))));
  const minimumMonth = businessToday().slice(0, 7);

  useEffect(() => {
    document.documentElement.lang = i18n.language === 'my' ? 'my' : 'en';
    localStorage.setItem('waytolive-language', i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (!booking) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [booking]);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my');
  }

  useEffect(() => {
    apiRequest('/api/events').then(setUpcomingEvents).catch(() => setUpcomingEvents([]));
  }, []);

  useEffect(() => {
    if (!booking) return;
    const controller = new AbortController();
    setAvailabilityByDate({}); setAvailabilityError(''); setAvailabilityLoading(true);
    const query = new URLSearchParams({ month: visibleMonth, service: selected, country, format: sessionFormat });
    apiRequest(`/api/availability?${query}`, { signal: controller.signal })
      .then((result) => {
        const byDate = Object.fromEntries((result.days || []).map((day) => [day.date, day.slots]));
        setAvailabilityByDate(byDate);
        setSelectedSlots((current) => current.filter((slot) => (
          slot.date.slice(0, 7) !== visibleMonth || (byDate[slot.date] || []).some((availableSlot) => availableSlot.value === slot.time)
        )));
      })
      .catch((error) => { if (error.name !== 'AbortError') setAvailabilityError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [booking, visibleMonth, selected, country, sessionFormat]);

  useEffect(() => {
    if (!booking) return;
    let active = true;
    const refreshAvailability = () => {
      const query = new URLSearchParams({ month: visibleMonth, service: selected, country, format: sessionFormat });
      apiRequest(`/api/availability?${query}`)
        .then((result) => {
          if (!active) return;
          const byDate = Object.fromEntries((result.days || []).map((day) => [day.date, day.slots]));
          setAvailabilityByDate(byDate);
          setSelectedSlots((current) => current.filter((slot) => (
            slot.date.slice(0, 7) !== visibleMonth || (byDate[slot.date] || []).some((availableSlot) => availableSlot.value === slot.time)
          )));
          setAvailabilityError('');
        })
        .catch((error) => { if (active) setAvailabilityError(error.message); });
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refreshAvailability(); };
    const timer = window.setInterval(refreshAvailability, 10000);
    window.addEventListener('focus', refreshAvailability);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshAvailability);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [booking, visibleMonth, selected, country, sessionFormat]);

  useEffect(() => {
    if (sliderPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, [sliderPaused]);

  useEffect(() => {
    const targets = document.querySelectorAll('.hero-copy,.photo-banner,.portfolio-heading,.portfolio-grid > .portfolio-card,.certificates-heading,.certificate-card,.sessions-heading,.offering,.quote-section,.cta-section,.footer');
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
    setSelected(service); setConfirmed(false); setBooking(true); setMenuOpen(false); setBookingDate(''); setSelectedSlots([]); setAvailabilityByDate({}); setVisibleMonth(businessToday().slice(0, 7)); setBookingError(''); setSessionFormat('Online'); setCountry('Thailand'); setParticipantCount('3');
  }

  function openBookingLookup() {
    setBooking(false); setBookingLookupOpen(true); setMenuOpen(false); setLookupEmail(''); setLookupCodeSent(false); setLookupCode(''); setLookupResults(null); setLookupError('');
  }

  function changeVisibleMonth(delta) {
    const [year, month] = visibleMonth.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setVisibleMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
    setBookingDate('');
  }

  function selectBookingDate(date) {
    setBookingDate(date);
  }

  function slotKey(slot) {
    return `${slot.date}T${slot.time}`;
  }

  function toggleBookingSlot(time) {
    const slot = { date: bookingDate, time };
    setSelectedSlots((current) => {
      const withoutSlot = current.filter((selectedSlot) => slotKey(selectedSlot) !== slotKey(slot));
      return withoutSlot.length === current.length
        ? [...current, slot].sort((first, second) => slotKey(first).localeCompare(slotKey(second)))
        : withoutSlot;
    });
  }

  function removeSelectedSlot(slot) {
    setSelectedSlots((current) => current.filter((selectedSlot) => slotKey(selectedSlot) !== slotKey(slot)));
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedSlots.length) { setBookingError('Choose an available date and time first.'); return; }
    const form = new FormData(event.currentTarget);
    setSubmittingBooking(true); setBookingError('');
    try {
      const bookingData = { ...Object.fromEntries(form.entries()), slots: selectedSlots };
      if (bookingData.service !== 'Breathwork + meditation (group, up to 5 people)') bookingData.participantCount = '1';
      await apiRequest('/api/bookings', { method: 'POST', body: JSON.stringify(bookingData) });
      setConfirmed(true);
      setSelectedSlots([]);
    } catch (error) { setBookingError(error.message); }
    finally { setSubmittingBooking(false); }
  }

  async function requestBookingLookupCode(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLookupLoading(true); setLookupError(''); setLookupResults(null);
    try {
      const email = String(form.get('email') || '').trim().toLowerCase();
      await apiRequest('/api/bookings/lookup-code', { method: 'POST', body: JSON.stringify({ email }) });
      setLookupEmail(email); setLookupCodeSent(true);
    } catch (error) { setLookupError(error.message); }
    finally { setLookupLoading(false); }
  }

  async function searchCustomerBookings(event) {
    event.preventDefault();
    setLookupLoading(true); setLookupError(''); setLookupResults(null);
    try {
      const result = await apiRequest('/api/bookings/lookup', { method: 'POST', body: JSON.stringify({ email: lookupEmail, code: lookupCode }) });
      setLookupResults(result.bookings || []);
    } catch (error) { setLookupError(error.message); }
    finally { setLookupLoading(false); }
  }

  return <>
    <header className="nav wrap">
      <a className="brand" href="#home" aria-label="Way to Live home"><span className="brand-mark">w.</span><span>way to live</span></a>
      <button className="menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <a href="#way-to-live" onClick={() => setMenuOpen(false)}>{t('navAbout')}</a><a href="#sessions" onClick={() => setMenuOpen(false)}>{t('navSessions')}</a><a href="#about" onClick={() => setMenuOpen(false)}>{t('navMay')}</a>
        <div className="nav-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div>
        {/* <button className="language-toggle" type="button" onClick={toggleLanguage} aria-label={`Change language to ${t('language')}`}>{t('language')}</button> */}<button className="nav-lookup" onClick={openBookingLookup}>{t('findMyBooking')}</button><button className="nav-cta" onClick={() => openBooking()}>{t('bookSession')} <ArrowUpRight size={15} /></button>
      </nav>
    </header>

    <main>
      <section className="hero wrap" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> {t('eyebrow')}</div>
          <h1>{t('heroTitle')}<br /><em>{t('heroYourself')}</em></h1>
          <p className="hero-lede">{t('heroLead')}</p>
          <div className="hero-actions"><button className="button button-dark" onClick={() => openBooking()}>{t('findSpace')} <ArrowRight size={17} /></button><a className="text-link" href="#way-to-live">{t('approachLink')} <ArrowDown size={14} /></a></div>
          <div className="hero-note"><div className="avatar-stack"><span>✳</span><span>✳</span><span>✳</span></div><span>{t('oneStep')}<br /><b>{t('atPace')}</b></span></div>
        </div>
        <div className="hero-art photo-banner" role="region" aria-label={t('slideRegion')} aria-roledescription="carousel" onMouseEnter={() => setSliderPaused(true)} onMouseLeave={() => setSliderPaused(false)} onFocus={() => setSliderPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSliderPaused(false); }}>
          {heroSlides.map((slide, index) => <figure className={`banner-photo${activeSlide === index ? ' active' : ''}`} key={slide.image} aria-hidden={activeSlide !== index}><img src={slide.image} alt={slide.alt} /><figcaption>{slide.caption}</figcaption></figure>)}
          <div className="slider-controls"><button type="button" aria-label={t('previousPhoto')} onClick={() => moveSlide(-1)}><ChevronLeft size={18} /></button><div className="slider-dots">{heroSlides.map((slide, index) => <button type="button" key={slide.image} className={activeSlide === index ? 'active' : ''} aria-label={t('showPhoto', { number: index + 1 })} aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)} />)}</div><button type="button" aria-label={t('nextPhoto')} onClick={() => moveSlide(1)}><ChevronRight size={18} /></button></div>
        </div>
      </section>

      <section className="ticker" aria-label={t('tickerLabel')}><div className="ticker-track"><span>{t('ticker1')}</span><b>✳</b><span>{t('ticker2')}</span><b>✳</b><span>{t('ticker3')}</span><b>✳</b><span>{t('ticker1')}</span></div></section>

      <section className="portfolio section" id="way-to-live">
        <div className="wrap"><div className="portfolio-heading"><div><div className="section-label">{t('personBehind')} <span>↘</span></div><h2>{t('aboutWay')} <em>{t('practice')}</em></h2></div><p>{t('practiceIntro')}</p></div>
          <div className="portfolio-grid">
            <article className="portfolio-card personal-card" id="about"><span className="portfolio-index">01 / {t('personal')}</span><div className="portrait-mark">m.</div><h3>{t('hiMay')}</h3><p>{t('bio')}</p><div className="personal-facts"><span>{t('basedIn')} <b>{t('location')}</b></span><span>{t('workingIn')} <b>{t('counsellingMeditation')}</b></span></div></article>
            <article className="portfolio-card credentials-card"><span className="portfolio-index">02 / {t('learning')}</span><h3>{t('grounded')}</h3><p>{t('training')}</p><ul className="credential-list"><li><span>✳</span><div><b>{t('reiki')}</b><small>{t('reikiCert')}</small></div></li><li><span>✳</span><div><b>{t('prana')}</b><small>{t('pranaCert')}</small></div></li></ul></article>
            <article className="portfolio-card events-card"><span className="portfolio-index">03 / {t('community')}</span><figure className="event-photo"><img src="/images/may-community-session.jpg" alt="May speaking with participants during an outdoor group session" /></figure><h3>{t('makingSpace')}<br /><em>{t('together')}</em></h3><p>{t('groupText')}</p><div className="event-tags"><span>{t('communitySession')}</span><span>{t('groupPractice')}</span></div></article>
          </div>
          <div className="certificates-heading"><div><div className="section-label">{t('certificates')} <span>↘</span></div><h3>{t('learningHonoured')} <em>{t('honoured')}</em></h3></div><p>{t('certIntro')}</p></div>
          <div className="certificates-grid">{certificates.map((certificate) => <article className="certificate-card" key={certificate.title}><h4>{certificate.title}</h4><time dateTime={certificate.dateTime}>{certificate.date}</time><span className="certificate-organization">{certificate.organization}</span></article>)}</div>
        </div>
      </section>

      <section className="sessions section" id="sessions"><div className="wrap"><div className="sessions-heading"><div><div className="section-label">{t('waysWork')} <span>↘</span></div><h2>{t('placeBegin')} <em>{t('begin')}</em></h2></div><div className="sessions-tools"><p>{t('sessionsIntro')}</p><label className="session-search"><Search size={17} aria-hidden="true" /><input type="search" value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder={t('sessionSearch')} aria-label={t('sessionSearch')} /></label></div></div>
        {filteredOfferings.length ? <div className="offerings">{filteredOfferings.map(({ number, title, titleKey, type, typeKey, copy, copyKey, duration, price: rateLabel, priceNote, myanmarPrice, icon: Icon }) => <article className="offering" key={number}><div className="offering-top"><span>{number}</span><Icon size={19} strokeWidth={1.5} /></div><div className="offering-type">{t(typeKey)}</div><h3>{t(titleKey)}</h3><p>{t(copyKey)}</p><div className="offering-bottom"><div className="offering-rate"><span>{duration}</span><b>{rateLabel}</b>{priceNote && <small>{priceNote}</small>}{myanmarPrice && <small>{myanmarPrice}</small>}</div><button aria-label={t('bookingService', { service: t(titleKey) })} onClick={() => openBooking(title)}><ArrowUpRight size={18} /></button></div></article>)}</div> : <p className="session-search-empty">{t('noSessionsFound')}</p>}
      </div></section>

      {upcomingEvents.length > 0 && <section className="public-events section"><div className="wrap"><div className="section-label">{t('gather')} <span>↘</span></div><h2>{t('upcoming')} <em>{t('events')}</em></h2><div className="public-event-grid">{upcomingEvents.map((item) => <article className="public-event-card" key={item.id}><span className="event-date">{formatEventDate(item.starts_at)}</span><h3>{item.title}</h3>{item.location && <p className="event-location">{item.location}</p>}{item.description && <p>{item.description}</p>}<button className="text-link" onClick={() => openBooking(offerings[3].title)}>{t('askEvent')} <ArrowRight size={15} /></button></article>)}</div></div></section>}

      <section className="quote-section wrap" id="about-may"><div className="quote-mark">“</div><div><div className="section-label">{t('quoteLabel')}</div><blockquote>{t('quote')}</blockquote><div className="quote-author"><span className="may-avatar">m.</span><span><b>May</b><small>{t('therapist')}</small></span></div></div><div className="quote-flower">✳</div></section>

      <section className="cta-section"><div className="cta-orb orb-one" /><div className="cta-orb orb-two" /><div className="cta-inner"><div className="eyebrow light"><span className="eyebrow-dot" /> {t('ready')}</div><h2>{t('startHere')}<br /><em>{t('here')}</em></h2><p>{t('startText')}</p><button className="button button-light" onClick={() => openBooking(offerings[3].title)}>{t('firstChat')} <ArrowRight size={17} /></button></div><span className="cta-spark">✳</span></section>
    </main>

    <footer className="footer wrap"><a className="brand" href="#home"><span className="brand-mark">w.</span><span>way to live</span></a><span className="footer-note">{t('footerNote')}</span><div className="footer-socials"><a href="https://www.facebook.com/thewaytolive8" target="_blank" rel="noreferrer" aria-label="Way to Live on Facebook"><Facebook /></a><a href="https://www.instagram.com/thewaytolive8/" target="_blank" rel="noreferrer" aria-label="Way to Live on Instagram"><Instagram /></a><a href="https://www.youtube.com/@TheWayToLive-88" target="_blank" rel="noreferrer" aria-label="Way to Live on YouTube"><Youtube /></a><a href="https://www.tiktok.com/@thewaytolivebymay?lang=en" target="_blank" rel="noreferrer" aria-label="Way to Live on TikTok"><Music2 /></a></div><span className="copyright">{t('copyright')}</span><button className="dashboard-link customer-booking-link" onClick={openBookingLookup}>{t('findMyBooking')}</button><a className="dashboard-link" href="/admin">{t('dashboard')}</a></footer>

    {bookingLookupOpen && <main className="booking-page">
      <header className="booking-page-header"><a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setBookingLookupOpen(false); }}><span className="brand-mark">w.</span><span>way to live</span></a><div className="booking-page-step">{t('bookingLookup')}</div><button className="booking-page-close" aria-label={t('closeBooking')} onClick={() => setBookingLookupOpen(false)}><X size={20} /></button></header>
      <section className="booking-page-content booking-lookup-content"><div className="booking-page-intro"><div className="eyebrow"><span className="eyebrow-dot" /> {t('bookingLookup')}</div><h1>{t('lookupTitle')}</h1><p>{t('lookupIntro')}</p></div>
        {!lookupCodeSent ? <form className="booking-details-panel booking-lookup-form" onSubmit={requestBookingLookupCode}><label>{t('email')}<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label>{lookupError && <p className="booking-error" role="alert">{lookupError}</p>}<button className="button button-dark submit-button" type="submit" disabled={lookupLoading}>{lookupLoading ? t('searchingBookings') : t('sendLookupCode')} <ArrowRight size={17} /></button></form>
          : <form className="booking-details-panel booking-lookup-form" onSubmit={searchCustomerBookings}><p className="lookup-code-note" role="status">{t('lookupCodeSent', { email: lookupEmail })}</p><label>{t('lookupCode')}<input required inputMode="numeric" name="code" value={lookupCode} onChange={(event) => setLookupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength="6" maxLength="6" pattern="[0-9]{6}" autoComplete="one-time-code" /></label>{lookupError && <p className="booking-error" role="alert">{lookupError}</p>}<button className="button button-dark submit-button" type="submit" disabled={lookupLoading || lookupCode.length !== 6}>{lookupLoading ? t('searchingBookings') : t('searchBookings')} <Search size={17} /></button><button className="lookup-resend" type="button" onClick={() => { setLookupCodeSent(false); setLookupCode(''); setLookupResults(null); }}>{t('changeLookupEmail')}</button>
          {lookupResults && (lookupResults.length ? <div className="booking-lookup-results" aria-live="polite">{lookupResults.map((item) => <article className="booking-lookup-result" key={`${item.date}-${item.time}`}><b>{new Intl.DateTimeFormat(i18n.language === 'my' ? 'my' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${item.date}T12:00:00Z`))} · {item.time}</b><span>{item.service} · {item.format}</span><span>{t(`bookingStatus_${item.status}`, { defaultValue: item.status })} · {t(`payment_${item.paymentStatus}`, { defaultValue: item.paymentStatus })}</span></article>)}</div> : <p className="booking-lookup-empty" role="status">{t('lookupNoResults')}</p>)}
          </form>}
      </section>
    </main>}

    {booking && <main className="booking-page">
      <header className="booking-page-header"><a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setBooking(false); }}><span className="brand-mark">w.</span><span>way to live</span></a><div className="booking-page-step">{t('goodStart')}</div><div className="booking-header-actions"><button className="booking-header-lookup" onClick={openBookingLookup}>{t('findMyBooking')}</button><button className="booking-page-close" aria-label={t('closeBooking')} onClick={() => setBooking(false)}><X size={20} /></button></div></header>
      {confirmed ? <section className="booking-page-confirmation confirmation"><span className="confirm-icon"><Check size={25} /></span><div className="eyebrow">{t('firstStep')}</div><h1>{t('thanks')}<br /><em>{t('reaching')}</em></h1><p>{t('confirmation')}</p><button className="button button-dark" onClick={() => setBooking(false)}>{t('backHome')} <ArrowRight size={17} /></button></section> : <section className="booking-page-content">
        <div className="booking-page-intro"><div className="eyebrow"><span className="eyebrow-dot" /> {t('goodStart')}</div><h1 id="booking-title">{t('bookingTitle')}</h1><p>{t('modalIntro')}</p></div>
        <form className="booking-page-form" onSubmit={submitBooking}>
          <section className="booking-calendar-panel" aria-label={t('preferredDate')}>
            <div className="booking-panel-heading"><div><span className="booking-panel-kicker">{t('preferredDate')}</span><h2>{calendarMonthLabel}</h2></div><div className="calendar-month-controls"><button type="button" aria-label={t('previousMonth')} disabled={visibleMonth <= minimumMonth} onClick={() => changeVisibleMonth(-1)}><ChevronLeft size={18} /></button><button type="button" aria-label={t('nextMonth')} onClick={() => changeVisibleMonth(1)}><ChevronRight size={18} /></button></div></div>
            {availabilityError && <p className="calendar-error" role="alert">{availabilityError}</p>}
            <div className="booking-calendar-grid">{weekdayLabels.map((weekday, index) => <span className="calendar-weekday" key={`${weekday}-${index}`}>{weekday}</span>)}{calendarCells.map((date, index) => {
              if (!date) return <span className="calendar-empty" key={`empty-${index}`} />;
              const hasSlots = Boolean(availabilityByDate[date]?.length);
              const isPast = date < businessToday();
              return <button key={date} type="button" className={`calendar-day${bookingDate === date ? ' selected' : ''}${hasSlots ? ' has-slots' : ''}`} disabled={isPast} aria-pressed={bookingDate === date} onClick={() => selectBookingDate(date)}><span>{Number(date.slice(-2))}</span>{hasSlots && <i />}</button>;
            })}</div>
            <div className="calendar-legend"><span><i /> {availabilityLoading ? t('checkingCalendar') : t('calendarHasSlots')}</span></div>
            <div className="calendar-time-panel"><div className="booking-panel-kicker">{bookingDate ? new Intl.DateTimeFormat(i18n.language === 'my' ? 'my' : 'en', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${bookingDate}T12:00:00Z`)) : t('availableTime')}</div>
              {!bookingDate ? <p className="calendar-prompt">{t('selectCalendarDate')}</p> : availabilityLoading ? <p className="calendar-prompt">{t('checking')}</p> : availableTimes.length ? <div className="booking-time-options">{availableTimes.map((slot) => {
                const bookingSlot = { date: bookingDate, time: slot.value };
                const isSelected = selectedSlots.some((selectedSlot) => slotKey(selectedSlot) === slotKey(bookingSlot));
                return <button type="button" key={slot.value} className={isSelected ? 'selected' : ''} aria-pressed={isSelected} onClick={() => toggleBookingSlot(slot.value)}>{slot.label}</button>;
              })}</div> : <p className="calendar-prompt">{t('noTimesHint')}</p>}
            </div>
          </section>
          <section className="booking-details-panel">
            {selectedSlots.length ? <ul className="booking-selected-slots" aria-label={t('selectedTimes')}>{selectedSlots.map((slot) => {
              const formattedDate = new Intl.DateTimeFormat(i18n.language === 'my' ? 'my' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${slot.date}T12:00:00Z`));
              return <li key={slotKey(slot)}><span>{formattedDate} · {slot.time}</span><button type="button" onClick={() => removeSelectedSlot(slot)} aria-label={t('removeSelectedTime', { date: formattedDate, time: slot.time })}><X size={15} /></button></li>;
            })}</ul> : <p className="calendar-prompt">{t('selectCalendarDate')}</p>}
            <div className="booking-panel-heading"><div><span className="booking-panel-kicker">{t('session')}</span><h2>{t('bookingDetails')}</h2></div></div>
            <label>{t('session')}<select name="service" value={selected} onChange={(e) => { setSelected(e.target.value); if (e.target.value === 'The first conversation') setSessionFormat('Online'); }}>{offerings.map(o => <option key={o.title} value={o.title}>{t(o.titleKey)} · {o.duration}</option>)}</select></label>
            <label>{t('country')}<select name="country" value={country} onChange={(e) => { setCountry(e.target.value); setSessionFormat('Online'); }}><option value="Thailand">{t('thailand')}</option><option value="Myanmar">{t('myanmar')}</option></select></label>
            {onlineOnly ? <input type="hidden" name="format" value="Online" /> : <label>{t('sessionFormat')}<select name="format" value={sessionFormat} onChange={(e) => setSessionFormat(e.target.value)}><option value="Online">{t('online')}</option><option value="In-person">{t('inPerson')}</option></select></label>}
            {sessionFormat === 'In-person' && <p className="inperson-note">{t('inPersonNote')}</p>}
            {selected === 'Breathwork + meditation (group, up to 5 people)' ? <label>{t('groupSize')}<select name="participantCount" value={participantCount} onChange={(e) => setParticipantCount(e.target.value)}>{[3, 4, 5].map(count => <option key={count} value={count}>{count} {t('people')}</option>)}</select></label> : <input type="hidden" name="participantCount" value="1" />}
            <div className="booking-price"><span>{t('bookingTotal')}</span><b>{selectedSlots.length ? (price.amount ? moneyLabel(bookingTotal, price.currency) : t('free')) : t('selectTimeForTotal')}</b>{selectedSlots.length > 0 && <small>{t('totalBreakdown', { price: price.amount ? moneyLabel(price.amount, price.currency) : t('free'), count: selectedSlots.length })}</small>}{selected === 'Breathwork + meditation (group, up to 5 people)' && <small>{t('groupPriceNote')}</small>}{country === 'Myanmar' && <small>{t('myanmarOnlineOnly')}</small>}</div>
            <label>{t('yourName')}<input required name="name" placeholder={t('namePlaceholder')} autoComplete="name" /></label>
            <label>{t('email')}<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label>
            <label>{t('anythingKnow')} <span className="optional">{t('optional')}</span><textarea name="note" rows="3" placeholder={t('notePlaceholder')} /></label>
            {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
            <button className="button button-dark submit-button" type="submit" disabled={submittingBooking || !selectedSlots.length}>{submittingBooking ? t('sending') : t('sendRequest')} {!submittingBooking && <ArrowRight size={17} />}</button><small className="privacy-note">{t('privacy')}</small>
          </section>
        </form>
      </section>}
    </main>}
  </>;
}

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/admin') ? <AdminDashboard /> : <App />);
