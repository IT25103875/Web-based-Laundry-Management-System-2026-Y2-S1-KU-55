import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/api';

function WaveLogo({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function CleanCloudLogo() {
  return <svg className="cleancloud-logo" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 30h20a7 7 0 0 0 .4-14A10.5 10.5 0 0 0 11 12.5 8.8 8.8 0 0 0 10 30Z" />
    <path d="M18 18a2 2 0 1 1 4 0c0 1.2-2 1.5-2 3v1l7 4H13l7-4" />
  </svg>;
}

function AccountIcon({ staff = false }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    {staff && <><path d="M18 4a3 3 0 0 1 0 6M21 20v-2a5 5 0 0 0-2-4M6 4a3 3 0 0 0 0 6M3 20v-2a5 5 0 0 1 2-4" /></>}
  </svg>;
}

const cloudOutline = 'M35 103h136c21 0 36-14 36-32 0-17-14-31-32-32-4-21-22-37-44-37-18 0-34 10-42 25-7-7-17-11-28-11-22 0-40 16-43 37C7 57 0 66 0 77c0 15 15 26 35 26Z';
function SkyClouds({ fill = 'rgba(235,246,255,0.72)' }) {
  return <div className="sky-clouds" aria-hidden="true">{[
    ['8%', '190px', '52s', '-12s'], ['23%', '140px', '64s', '-39s'], ['5%', '245px', '75s', '-54s'], ['38%', '105px', '58s', '-27s'],
  ].map(([top,width,duration,delay],index) => <svg key={index} viewBox="0 0 215 110" fill={fill} style={{ top,width,animationDuration:duration,animationDelay:delay }}><path d={cloudOutline}/></svg>)}</div>;
}
function HeroWeather() {
  return <div className="hero-weather" aria-hidden="true"><div className="weather-shade"/>
    <svg className="weather-sun" viewBox="0 0 90 90" fill="none"><circle cx="45" cy="45" r="19" fill="#ffd580"/><circle cx="45" cy="45" r="26" stroke="#ffe7b3" strokeOpacity=".5"/><path d="M45 5v10m0 60v10M5 45h10m60 0h10M17 17l7 7m42 42 7 7M17 73l7-7m42-42 7-7" stroke="#ffe7b3" strokeWidth="3" strokeLinecap="round"/></svg>
    <svg className="weather-moon" viewBox="0 0 100 100" fill="none"><path d="M63 15a32 32 0 1 0 22 49A35 35 0 0 1 63 15Z" fill="#d4e8ff"/><path d="m81 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM24 5v8m-4-4h8" stroke="#b3d6ff" strokeWidth="1.5"/></svg>
    <svg className="weather-rain" viewBox="0 0 215 165" fill="none"><path d={cloudOutline} fill="#88acd7"/><g className="weather-rain-lines" stroke="#a9d9ff" strokeWidth="3" strokeLinecap="round"><path d="m40 117-8 14m29-14-8 14m72-14-8 14m29-14-8 14m-96 14-8 14m112-14-8 14"/></g><path d="m91 106-17 29h16l-8 26 30-38H97l12-17Z" fill="#d8edff"/></svg>
  </div>;
}

function FreshCareIllustration() {
  return <div className="fresh-care-visual" aria-label="CleanCloud garment care illustration" role="img">
    <div className="care-visual-header"><span><WaveLogo /> CleanCloud</span><span className="care-visual-badge">Garment care</span></div>
    <div className="care-drum"><div className="care-drum-orbit"/><div className="care-drum-inner"><LaundryIcon name="shirt"/></div><span className="care-bubble bubble-one"/><span className="care-bubble bubble-two"/><span className="care-bubble bubble-three"/></div>
    <p className="care-visual-title">A fresh perspective.</p><p className="care-visual-caption">Good care. From start to finish.</p>
    <div className="care-visual-tags"><span>Wash</span><span>Press</span><span>Care</span></div>
  </div>;
}

const services = [
  { icon: 'wash', title: 'Wash & fold', desc: 'Everyday clothes, washed and neatly folded. Add fabric-care notes when you place your order.', detail: 'For your everyday laundry' },
  { icon: 'shirt', title: 'Dry cleaning', desc: 'Care for garments that need special handling. Share fabric details and any instructions with the team.', detail: 'For garments needing extra care' },
  { icon: 'iron', title: 'Press & iron', desc: 'A neat finish for shirts, workwear and linens. Choose Iron when requesting your service.', detail: 'For a smooth, ready-to-wear finish' },
  { icon: 'delivery', title: 'Pickup & delivery', desc: 'Request a delivery window with your order and follow the scheduling updates in your portal.', detail: 'Connected to your laundry order' },
];

function LaundryIcon({ name = 'wash' }) {
  const paths = {
    wash: <><rect x="4" y="2" width="16" height="20" rx="3"/><circle cx="12" cy="14" r="5"/><path d="M7 14c3-3 7 3 10 0M7 6h3m6 0h1"/></>,
    shirt: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>,
    iron: <><path d="M3 17h18l-3-9H9l-6 9Zm0 0v3h18v-3M9 8V5h6a3 3 0 0 1 3 3"/></>,
    delivery: <><path d="M2 6h12v12H2V6Zm12 5h4l4 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    order: <><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6m-6 4h6m-6 4h3"/></>,
    invoice: <><path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2Z"/><path d="M9 7h6m-6 4h6m-6 4h3"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.wash}</svg>;
}

const finishes = [
  ['Everyday cotton', 'Washed, tumbled, folded into a quiet stack.'],
  ['Silk & wool', 'Dry cleaned, steamed, hung so it keeps its shape.'],
  ['Whites', 'Separated, brightened, never greyed by a mixed load.'],
  ['Bedding', 'King, queen, duvet — returned in a bag you can actually carry.'],
];

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const location = useLocation();
  const menuButton = useRef(null);
  const menuPanel = useRef(null);
  const accountMenu = useRef(null);
  const navigation = [['services', 'Services'], ['how', 'How it works'], ['pricing', 'Pricing']];
  const homeAnchor = (id) => location.pathname === '/' ? `#${id}` : `/#${id}`;
  const closeMenu = () => { setOpen(false); menuButton.current?.focus(); };
  const selectSection = (event, id) => {
    setOpen(false);
    setActive(id);
    // Re-selecting the current URL anchor must still return to its section.
    if (location.pathname === '/' && location.hash === `#${id}`) {
      event.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };

  useEffect(() => { setOpen(false); setActive(location.hash.slice(1)); accountMenu.current?.removeAttribute('open'); }, [location.pathname, location.hash]);
  useEffect(() => {
    const outside = (event) => { if (accountMenu.current && !accountMenu.current.contains(event.target)) accountMenu.current.removeAttribute('open'); };
    const escape = (event) => { if (event.key === 'Escape' && accountMenu.current?.hasAttribute('open')) { accountMenu.current.removeAttribute('open'); accountMenu.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => {
    if (location.pathname !== '/') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id === 'main-content' ? '' : entry.target.id);
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    ['main-content', 'services', 'how', 'pricing', 'care', 'studio', 'help', 'get-started'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuPanel.current?.querySelector('button')?.focus();
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', escape); };
  }, [open]);

  const keepMenuFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = menuPanel.current?.querySelectorAll('a[href], button:not([disabled])');
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <>
    <header className="public-header">
      <nav className="section-wrap header-content" aria-label="Main navigation">
        <Link to="/" className="header-brand"><span className="brand-mark brand-cloud-mark"><CleanCloudLogo /></span><span>CleanCloud<small>Laundry services</small></span></Link>
        <div className="header-section-links">
          {navigation.map(([id, label]) => <Link key={id} to={homeAnchor(id)} onClick={(event) => selectSection(event, id)} className={active === id ? 'header-link is-active' : 'header-link'} aria-current={location.pathname === '/' && active === id ? 'location' : undefined}>{label}</Link>)}
          <Link to="/project" className={location.pathname === '/project' ? 'header-link is-active' : 'header-link'} aria-current={location.pathname === '/project' ? 'page' : undefined}>Our project</Link>
        </div>
        <div className="header-actions">
          <details ref={accountMenu} className="header-account-menu account-menu-polished">
            <summary className="header-signin"><AccountIcon /> Sign in <span className="account-chevron" aria-hidden="true">⌄</span></summary>
            <div className="account-dropdown account-choice-panel">
              <div className="account-choice-heading"><span>WELCOME TO CLEANCLOUD</span><p>Choose your workspace.</p></div>
              <Link className="account-choice" to="/login" onClick={(event) => event.currentTarget.closest('details').removeAttribute('open')}>
                <span className="account-choice-icon"><AccountIcon /></span><span className="account-choice-copy">Customer portal<small>Your orders, invoices & delivery updates</small></span><span className="account-choice-arrow" aria-hidden="true">↗</span>
              </Link>
              <Link className="account-choice" to="/staff-login" onClick={(event) => event.currentTarget.closest('details').removeAttribute('open')}>
                <span className="account-choice-icon staff-choice-icon"><AccountIcon staff /></span><span className="account-choice-copy">Staff workspace<small>Your team, tasks & assigned modules</small></span><span className="account-choice-arrow" aria-hidden="true">↗</span>
              </Link>
              <div className="account-choice-register"><span>New to CleanCloud?</span><Link to="/register" onClick={(event) => event.currentTarget.closest('details').removeAttribute('open')}>Create an account <span aria-hidden="true">→</span></Link></div>
            </div>
          </details>
          <Link to="/register" className="btn-primary header-book">Book a pickup <span aria-hidden="true">→</span></Link><button ref={menuButton} type="button" className="header-menu-button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="site-menu"><span aria-hidden="true">☰</span></button>
        </div>
      </nav>
    </header>
    <div className={`menu-backdrop ${open ? 'is-open' : ''}`} onClick={closeMenu} />
    <aside ref={menuPanel} id="site-menu" className={`blue-menu-panel ${open ? 'is-open' : ''}`} aria-label="CleanCloud menu" aria-hidden={!open} inert={!open ? '' : undefined} onKeyDown={keepMenuFocus}>
      <div className="menu-heading"><strong>Your CleanCloud</strong><button type="button" onClick={closeMenu} aria-label="Close menu">✕</button></div>
      <nav aria-label="Mobile navigation">{navigation.map(([id, label]) => <Link key={id} to={homeAnchor(id)} onClick={(event) => selectSection(event, id)} className={active === id ? 'is-active' : ''}>{label}<span aria-hidden="true">↗</span></Link>)}<Link to="/project" onClick={() => setOpen(false)}>Our project <span aria-hidden="true">↗</span></Link><Link to={homeAnchor('help')} onClick={(event) => selectSection(event, 'help')}>Questions & answers <span aria-hidden="true">↗</span></Link></nav>
      <div className="menu-account-links"><Link to="/register" className="btn-primary" onClick={() => setOpen(false)}>Book a pickup →</Link><Link to="/login" className="btn-soft" onClick={() => setOpen(false)}>Customer sign in</Link><Link to="/staff-login" className="menu-staff-link" onClick={() => setOpen(false)}>Staff workspace →</Link></div>
    </aside>
  </>;
}

function PublicFooter() {
  return (
      <footer className="bg-black py-16 text-white">
        <div className="footer-blue-rule" />
        <div className="section-wrap grid gap-10 pt-12 md:grid-cols-4">
          <div>
            <Link to="/" className="brand-link">
              <span className="brand-mark brand-cloud-mark"><CleanCloudLogo /></span>
              <span className="brand-name">CleanCloud</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-white/50">Laundry care for Colombo. Keep your orders, garment updates and deliveries connected.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Visit</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-white/70">
              <a href="https://www.youtube.com" target="_blank" rel="noreferrer">YouTube</a>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer">Instagram</a>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Legal</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-white/70">
              <span>Terms of service</span>
              <span>Privacy policy</span>
              <span>Safety statement</span>
              <Link to="/project" className="hover:text-white">About our project</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Get the app</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <a className="rounded-xl border border-white/15 px-4 py-3" href="https://play.google.com/store" target="_blank" rel="noreferrer">Google Play</a>
              <a className="rounded-xl border border-white/15 px-4 py-3" href="https://apps.apple.com" target="_blank" rel="noreferrer">App Store</a>
            </div>
          </div>
        </div>
        <div className="section-wrap mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/45">
          <p>English · සිංහල · CleanCloud Laundry</p>
          <p className="software-company-credit">© {new Date().getFullYear()} <span>Cloud Service Software Company.</span> All rights reserved.</p>
        </div>
      </footer>
  );
}

export default function HomePage() {
  const [selectedService, setSelectedService] = useState('Wash');
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => { api.get('/garments/services').then(({ data }) => setCatalog(data)).catch(() => setCatalogError(true)); }, []);
  const selectedRate = catalog.find((service) => {
    const name = service.name.toLowerCase();
    return selectedService === 'Wash' ? name.includes('wash') : selectedService === 'Iron' ? name.includes('iron') || name.includes('press') : name.includes('dry');
  });
  const [selectedFabric, setSelectedFabric] = useState(0);
  const [skyPlaying, setSkyPlaying] = useState(true);
  const labels = { Wash: 'Wash & fold', Iron: 'Press & iron', 'Dry-Clean': 'Dry cleaning' };
  return (
    <div className="home-page professional-blue bg-[#061433] text-white">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <PublicHeader />
      <main>
        <section id="main-content" className={`blue-hero weather-hero${skyPlaying ? "" : " weather-paused"}`}>
          <img src="/art/sky.jpg" alt="" className="hero-sky-image" />
          <div className="hero-sky-overlay" />
          <HeroWeather />
          <SkyClouds />
          <div className="section-wrap hero-main">
            <div className="hero-copy">
              <p className="hero-eyebrow"><span/> Colombo · collected with care</p>
              <h1 className="font-display">Laundry day,<br /><span>made lighter.</span></h1>
              <p className="hero-description">Book your laundry online. Follow your order, view your invoices, and keep delivery updates in one place.</p>
              <div className="hero-buttons"><Link to="/register" className="btn-primary">Start an order <span aria-hidden="true">→</span></Link><Link to="/portal" className="hero-secondary">Track my laundry <span aria-hidden="true">↗</span></Link></div>
            </div>
            <div className="hero-original-art">
              <div className="float-card blue-textile-card" aria-label="Blue folded garment illustration" role="img"><svg viewBox="0 0 140 130" fill="none" aria-hidden="true"><rect x="17" y="76" width="107" height="28" rx="9" fill="#3974b8" stroke="#99c8ff"/><path d="M23 90h91" stroke="#b5d8ff" strokeOpacity=".55"/><rect x="13" y="50" width="109" height="28" rx="9" fill="#255c9c" stroke="#94c7ff"/><path d="M21 63h90" stroke="#b5d8ff" strokeOpacity=".55"/><rect x="20" y="24" width="105" height="28" rx="9" fill="#194b87" stroke="#8cbdff"/><path d="M28 37h85" stroke="#b5d8ff" strokeOpacity=".55"/></svg><span>Neatly folded.</span><small>Ready for your day.</small></div>
              <div className="float-card-delay photo-studio"><img src="/art/studio.jpg" alt="The CleanCloud laundry studio" /></div>
              <FreshCareIllustration />
            </div>
          </div>
          <nav className="section-wrap hero-quick-actions" aria-label="Laundry quick actions">
            <a href="#services" className="hero-action-card"><span className="quick-action-icon"><LaundryIcon name="shirt"/></span><span><strong>The care you notice.</strong><small>Find the right service for your garments.</small><b>Explore services →</b></span></a>
            <Link to="/portal" className="hero-action-card"><span className="quick-action-icon"><LaundryIcon name="order"/></span><span><strong>The updates you want.</strong><small>Follow your order in your customer portal.</small><b>Track my laundry →</b></span></Link>
            <Link to="/portal" className="hero-action-card"><span className="quick-action-icon"><LaundryIcon name="delivery"/></span><span><strong>The rhythm you need.</strong><small>Request a service and a delivery window.</small><b>Schedule a service →</b></span></Link>
          </nav>
          <div className="hero-bottom-controls"><a className="hero-scroll-cue" href="#services">Explore CleanCloud <span aria-hidden="true">↓</span></a><button type="button" className="sky-motion-control" aria-pressed={!skyPlaying} onClick={() => setSkyPlaying((playing) => !playing)}>{skyPlaying ? 'Pause sky' : 'Resume sky'} <span aria-hidden="true">{skyPlaying ? 'Ⅱ' : '▷'}</span></button></div>
        </section>

        <section id="services" className="blue-services public-section">
          <div className="section-wrap">
            <div className="blue-section-heading"><div><p className="section-eyebrow">OUR SERVICES</p><h2>Good care for<br />everyday things.</h2></div><p>Choose the care your laundry needs.<br />Add your instructions when you order.</p></div>
            <div className="blue-service-grid">{services.map((service) => <article key={service.title} className="blue-service-card"><span className="service-line-icon"><LaundryIcon name={service.icon}/></span><p className="service-detail">{service.detail}</p><h3>{service.title}</h3><p className="service-description">{service.desc}</p><Link to="/portal" className="service-action">{service.icon === 'delivery' ? 'Schedule with your order' : 'Request this service'} <span aria-hidden="true">→</span></Link></article>)}</div>
          </div>
        </section>

        <section id="how" className="blue-process public-section">
          <img src="/art/dusk.jpg" alt="" className="process-dusk-image"/><div className="process-blue-overlay"/><SkyClouds fill="rgba(180,210,255,0.16)"/>
          <div className="section-wrap relative z-10">
            <div className="blue-section-heading"><div><p className="section-eyebrow">HOW IT WORKS</p><h2>Your laundry,<br />step by step.</h2></div><p>From your first order to the final update,<br />know what to do and where to find it.</p></div>
            <ol className="laundry-step-grid">{[
              ['01', 'Create your account', 'Register with your contact details so your orders and updates stay together.', '/register', 'Create an account'],
              ['02', 'Request a service', 'Choose Wash, Iron or Dry-Clean. Add care instructions and request a delivery slot.', '/portal', 'Place an order'],
              ['03', 'Follow the care', 'Check order status, garment notes and any care updates recorded by the team.', '/portal', 'Track your order'],
              ['04', 'Review your invoice', 'See the invoice amount and payment status issued for your laundry order.', '/portal', 'View invoices'],
              ['05', 'Check delivery updates', 'Find your scheduled window and follow the delivery status in your portal.', '/portal', 'Follow delivery'],
            ].map(([number, title, description, to, action]) => <li key={number} className="laundry-step"><span className="step-circle">{number}</span><h3>{title}</h3><p>{description}</p><Link to={to}>{action} <span aria-hidden="true">→</span></Link></li>)}</ol>
            <p className="process-help">Already a customer? <Link to="/portal">Open your portal for all your order details →</Link></p>
          </div>
        </section>

        <section id="pricing" className="blue-pricing public-section">
          <div className="section-wrap pricing-layout">
            <div><p className="section-eyebrow">PRICING, MADE CLEAR</p><h2>Choose a service.<br />See your estimate.</h2><p className="pricing-explanation">View the current rate per garment from our service catalog. Your final invoice uses the saved garment quantities and prices.</p><div className="pricing-guide"><span><LaundryIcon name="order"/></span><div><strong>Before you order</strong><p>Review your estimate and add garment-care notes.</p></div></div><div className="pricing-guide"><span><LaundryIcon name="invoice"/></span><div><strong>After your invoice is issued</strong><p>View the amount and payment status beside your order.</p></div></div></div>
            <div className="service-estimate-card"><p className="estimate-label">YOUR SERVICE ESTIMATE</p><div className="estimate-options" role="group" aria-label="Choose a service estimate">{Object.entries(labels).map(([value, label]) => <button key={value} type="button" aria-pressed={selectedService === value} onClick={() => setSelectedService(value)}>{label}</button>)}</div><div className="estimate-result" aria-live="polite"><span className="estimate-service">{labels[selectedService]}</span><p>{selectedRate ? <><span>LKR</span> {Number(selectedRate.price).toLocaleString()}</> : catalogError ? 'Rates unavailable' : catalog.length ? 'Currently unavailable' : 'Loading rates…'}</p><small>{selectedRate ? 'Per garment · final amount on your invoice' : 'Available services and rates are confirmed in your portal.'}</small></div><Link to="/portal" className="btn-primary">Open customer portal <span aria-hidden="true">→</span></Link><p className="estimate-account-note">New to CleanCloud? <Link to="/register">Create an account</Link></p></div>
          </div>
        </section>

        <section id="care" className="blue-fabric-care public-section">
          <img src="/art/mint.jpg" alt="" className="fabric-background"/><div className="fabric-blue-overlay"/>
          <div className="section-wrap relative z-10"><div className="blue-section-heading"><div><p className="section-eyebrow">CARE IN EVERY DETAIL</p><h2>Every piece gets<br />its own finish.</h2></div><p>Tell us about the fabrics in your order.<br />Your instructions help the team care for them.</p></div><div className="fabric-guide-layout"><div className="fabric-care-choices" role="group" aria-label="Choose a fabric care guide">{finishes.map(([title], index) => <button key={title} type="button" aria-pressed={selectedFabric === index} onClick={() => setSelectedFabric(index)}><span>0{index + 1}</span>{title}<b aria-hidden="true">↗</b></button>)}</div><div className="fabric-care-detail" aria-live="polite"><span className="service-line-icon"><LaundryIcon name={selectedFabric === 1 ? 'shirt' : 'wash'}/></span><p className="section-eyebrow">YOUR FABRIC GUIDE</p><h3>{finishes[selectedFabric][0]}</h3><p>{finishes[selectedFabric][1]}</p><p className="fabric-care-note">Check the care label before booking. Add fabric details, stains and special instructions to your service request.</p><Link to="/portal" className="btn-primary">Add care notes to an order →</Link></div></div></div>
        </section>

        <section id="studio" className="blue-studio">
          <img src="/art/studio.jpg" alt="CleanCloud laundry studio" className="studio-original-photo"/><div className="studio-blue-overlay"/>
          <div className="section-wrap studio-content"><p className="section-eyebrow">THE PEOPLE BEHIND YOUR LAUNDRY</p><h2>Sorted, washed,<br />pressed, packed.</h2><p>Care for your garments, with order updates you can follow from home.</p><Link to="/register" className="btn-primary">Book your first pickup →</Link></div>
        </section>

        <section id="help" className="blue-help public-section">
          <div className="section-wrap help-layout"><div><p className="section-eyebrow">A LITTLE GUIDANCE</p><h2>Good questions.<br />Clear answers.</h2><p className="help-intro">Everything you need to get started, with quick links to your account.</p><div className="help-shortcuts"><Link to="/login">Customer sign in ↗</Link><Link to="/staff-login">Staff sign in ↗</Link><Link to="/project">Explore our project ↗</Link></div></div><div className="faq-list">{[
            ['How do I place my first order?', 'Create a customer account, sign in and open your portal. Choose a service, add garment details and care instructions, then submit your request.'],
            ['Which service should I choose?', 'Wash is for everyday washable laundry, Iron is for pressing, and Dry-Clean is for garments requiring specialist care. Always check your garment label and include any special requirements.'],
            ['Is the estimate my final invoice?', 'Rates are loaded from the current service catalog. The final invoice is calculated from your tagged garment quantities and saved prices. Review that invoice and its payment status in your portal.'],
            ['Where can I follow my order?', 'Sign in to your customer portal to see your orders, garment updates, invoices and delivery information recorded by the laundry team.'],
            ['Can I request a delivery window?', 'Add your preferred delivery slot when requesting a service. Check the delivery updates in your portal for the scheduling information recorded by the team.'],
          ].map(([question,answer],index)=><details key={question} className="faq-item" open={index === 0 ? true : undefined}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div>
        </section>

        <section id="get-started" className="blend-sky-cta blue-closing-section"><SkyClouds fill="rgba(180,210,255,0.16)"/><div className="section-wrap relative z-10"><div><p className="section-eyebrow">YOUR NEXT LAUNDRY DAY</p><h2>A fresh start,<br />with fewer things to manage.</h2></div><div className="closing-actions"><Link to="/register" className="btn-primary">Create an account →</Link><Link to="/portal" className="btn-soft">Go to my customer portal</Link><Link to="/project" className="closing-project-link">Meet the project behind CleanCloud ↗</Link></div></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}

const projectModules = [
  ['Customer management', 'Customer profiles, contact details and order history.'],
  ['Order management', 'Laundry orders, workflow updates and cancellations.'],
  ['Garment management', 'Garment records, fabric-care notes and exceptions.'],
  ['Payment management', 'Invoices, payment records and refunds.'],
  ['Delivery management', 'Pickup scheduling, dispatch and delivery updates.'],
  ['Staff management', 'Employee records, roles and shift details.'],
];

export function ProjectPage() {
  return (
    <div className="project-page bg-[#061433] text-white">
      <PublicHeader />
      <main id="main-content">
        <section className="relative overflow-hidden pb-16 pt-32 sm:pb-20">
          <img src="/art/sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#061433]/10 to-[#bcd7ff]" />
          <SkyClouds />
          <div className="section-wrap relative z-10 text-[#061433]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">SE2030 · Group 2026-Y2-S1-KU-55</p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">The story behind<br />Clean Cloud Laundry Services.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#061433]/80">Our web-based laundry management project connects customers, laundry teams, delivery personnel and administrators in one system. It brings orders, garments, invoices and service updates together.</p>
            <Link to="/" className="btn-primary mt-7">← Back to our website</Link>
          </div>
        </section>
        <section className="bg-[#eef3ff] py-16 text-[#0e1730]">
          <div className="section-wrap">
            <p className="page-kicker">From idea to implementation</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Our software engineering journey.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5b6784]">The full software development lifecycle provides the structure below. Our proposal and design work inform the project, while implementation and testing repeat through Scrum sprints. These stages describe the process, not a claim that every stage is complete.</p>
            <ol className="lifecycle-grid mt-8 grid gap-4">
              {[
                ['01', 'Feasibility study', 'Assess the problems in manual laundry operations, the proposed scope, technical needs, available resources and whether the project is practical within the university timeline.'],
                ['02', 'Requirements gathering', 'Identify the needs of customers, laundry staff, delivery personnel and administrators. Record the required functions and quality expectations in the proposal and backlog.'],
                ['03', 'Analysis', 'Translate the gathered needs into workflows, use cases, business rules and priorities. Clarify how orders, garments, payments and deliveries relate.'],
                ['04', 'System design', 'Plan the interface, application architecture and shared data model. Describe classes, activities, access permissions and interactions before implementation.'],
                ['05', 'Implementation', 'Develop the frontend and Java backend through Scrum sprints. Connect the existing MySQL data model to the customer and operational workflows.'],
                ['06', 'Testing', 'Check validation, permissions, order transitions and integration. Review the interface and refine issues found during sprint testing and demonstrations.'],
                ['07', 'Deployment', 'Prepare the integrated application, environment settings and setup instructions. Verify it in the intended environment before the final university demonstration.'],
                ['08', 'Maintenance', 'After delivery, review feedback, fix defects and keep the system usable as requirements evolve. This is an ongoing lifecycle activity, rather than a claim that all future work is complete.'],
              ].map(([n, title, description]) => (
                <li key={n} className="flex gap-5 rounded-2xl border border-[#d5e0f2] bg-white p-5 sm:p-6">
                  <span className="font-display text-3xl text-[#1d5bff]/60">{n}</span>
                  <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#5b6784]">{description}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-2xl border border-[#bcd1ff] bg-[#dce9ff] p-6">
              <h3 className="text-lg font-semibold">Progress recorded in our design document</h3>
              <p className="mt-2 text-sm leading-6">The Phase 2 report records 18 of 24 backlog items completed across Sprints 1–3. Sprint 4 covers planned dispatch, staff administration and reporting work. This reflects the report, rather than a live completion measure.</p>
            </div>
          </div>
        </section>
        <section className="blend-sky-cta py-16">
          <div className="section-wrap">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9d5ff]">Six modules · One connected system</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">What our team is building.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projectModules.map(([title, description]) => <article key={title} className="rounded-2xl border border-white/20 bg-[#061433]/40 p-6"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/85">{description}</p></article>)}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
