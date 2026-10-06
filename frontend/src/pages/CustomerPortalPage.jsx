import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { statusLabel, requestMessage, localDateTime, getCredentials, setCredentials, clearCredentials, encodeCredentials, decodeCredentials, readUser } from '../lib/api';

export const servicePrices = { Wash: 850, Iron: 450, 'Dry-Clean': 1450 };
const initialOrder = { serviceType: 'Wash', serviceId: '', garmentType: '', fabricType: '', quantity: 1, careInstructions: '', deliverySlot: '' };

function snapshotKey(customerId) {
  return `cleancloud_snap_${customerId}`;
}
function notesKey(customerId) {
  return `cleancloud_notes_${customerId}`;
}

function buildSnapshot(orders, payments, deliveries, garments) {
  return {
    orders: Object.fromEntries((orders || []).map((item) => [String(item.id), String(item.status || '')])),
    payments: Object.fromEntries((payments || []).map((item) => [String(item.id), `${item.status || ''}|${item.amount || 0}`])),
    deliveries: Object.fromEntries((deliveries || []).map((item) => [String(item.id), `${item.status || ''}|${item.timeSlot || ''}`])),
    garments: Object.fromEntries((garments || []).map((item) => [String(item.id), String(Boolean(item.damaged))])),
  };
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function diffNotifications(prev, next) {
  const notes = [];
  const time = new Date().toLocaleString();
  const push = (text) => notes.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, time, unread: true });

  Object.entries(next.orders || {}).forEach(([id, status]) => {
    if (!prev.orders?.[id]) push(`Order #${id} was placed.`);
    else if (prev.orders[id] !== status) push(`Order #${id} is now ${statusLabel(status)}.`);
  });
  Object.entries(next.payments || {}).forEach(([id, value]) => {
    const status = value.split('|')[0];
    const amount = value.split('|')[1];
    if (!prev.payments?.[id]) push(`Invoice created for payment #${id} (${statusLabel(status)}).`);
    else if (prev.payments[id] !== value) push(`Payment #${id} updated to ${statusLabel(status)}${amount ? ` · LKR ${Number(amount).toLocaleString()}` : ''}.`);
  });
  Object.entries(next.deliveries || {}).forEach(([id, value]) => {
    const status = value.split('|')[0];
    if (!prev.deliveries?.[id]) push(`Delivery #${id} was scheduled.`);
    else if (prev.deliveries[id] !== value) push(`Delivery #${id} is now ${statusLabel(status)}.`);
  });
  Object.entries(next.garments || {}).forEach(([id, damaged]) => {
    if (prev.garments?.[id] && prev.garments[id] !== damaged && damaged === 'true') {
      push(`A garment on your order was flagged as damaged.`);
    }
  });
  return notes;
}

function PortalIcon({ name = 'orders', className = '' }) {
  const shapes = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    orders: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6m-6 4h6"/></>,
    book: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/></>,
    care: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
    bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 4h4M12 2v2"/></>,
    invoice: <><path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2Z"/><path d="M9 7h6m-6 4h6m-6 4h3"/></>,
    delivery: <><path d="M2 6h12v12H2V6Zm12 5h4l4 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    signout: <><path d="M9 4H4v16h5m6-4 4-4-4-4m-6 4h10"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes.orders}</svg>;
}

export default function CustomerPortalPage() {
  const [user, setUser] = useState(() => readUser());
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [garments, setGarments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [formData, setFormData] = useState(initialOrder);
  const [services, setServices] = useState([]);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState('');
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || user?.username || '',
    phone: user?.phone || '',
    address: user?.address || '',
    password: '',
  });
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [notifications, setNotifications] = useState(() => readJson(notesKey(readUser()?.customerId), []));
  const [showNotes, setShowNotes] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const profileDirty = useRef(false);
  const mounted = useRef(true);
  const updateProfileField = (value) => { profileDirty.current = true; setProfileData(value); };
  const notesPanel = useRef(null);
  const notesButton = useRef(null);
  useEffect(() => {
    if (!showNotes) return;
    const outside = (event) => { if (!notesPanel.current?.contains(event.target) && !notesButton.current?.contains(event.target)) setShowNotes(false); };
    const escape = (event) => { if (event.key === 'Escape') { setShowNotes(false); notesButton.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [showNotes]);

  const customerId = user?.customerId;

  const loadPortal = async () => {
    if (!customerId) return;
    const [{ data: ownProfile }, { data: ownOrders }, { data: nextGarments }, { data: nextPayments }, { data: nextDeliveries }, eventResponse] = await Promise.all([
      api.get('/customers/me'), api.get('/orders'), api.get('/garments'), api.get('/payments'), api.get('/deliveries'), api.get('/customers/me/notifications'),
    ]);
    if (!mounted.current) return;
    const nextUser = { ...user, ...ownProfile, username: ownProfile.email, customerId: ownProfile.id, role: 'CUSTOMER' };
    setUser(nextUser);
    localStorage.setItem('cleancloud_user', JSON.stringify(nextUser));
    if (!profileDirty.current) setProfileData((current) => ({
      ...current,
      fullName: ownProfile.fullName || '',
      email: ownProfile.email || '',
      phone: ownProfile.phone || '',
      address: ownProfile.address || '',
    }));

    setOrders(ownOrders);
    setGarments(nextGarments);
    setPayments(nextPayments);
    setDeliveries(nextDeliveries);

    const previousNotes = readJson(notesKey(customerId), []);
    const eventLabels = { ORDER_READY: 'Your laundry is ready for collection.', DELAY: 'A delivery delay was reported.', PAYMENT: 'Your payment record was updated.', GARMENT_EXCEPTION: 'The team reported a garment incident.', DELIVERY: 'Your delivery record was updated.' };
    const databaseNotes = eventResponse.data.map((event) => {
      const old = previousNotes.find((note) => note.id === `db-${event.id}`);
      return { id: `db-${event.id}`, text: `Order #${event.orderId || '—'} · ${eventLabels[event.type] || 'An update is available.'}`, time: 'Saved account update', unread: old ? old.unread : true };
    });
    const mergedNotes = [...databaseNotes, ...previousNotes.filter((note) => !String(note.id).startsWith('db-'))].slice(0, 30);
    localStorage.setItem(notesKey(customerId), JSON.stringify(mergedNotes));
    setNotifications(mergedNotes);

    const nextSnap = buildSnapshot(ownOrders, nextPayments, nextDeliveries, nextGarments);
    const prevSnap = readJson(snapshotKey(customerId), null);
    if (prevSnap) {
      const fresh = diffNotifications(prevSnap, nextSnap);
      if (fresh.length) {
        const merged = [...fresh, ...readJson(notesKey(customerId), [])].slice(0, 30);
        localStorage.setItem(notesKey(customerId), JSON.stringify(merged));
        setNotifications(merged);
      }
    }
    localStorage.setItem(snapshotKey(customerId), JSON.stringify(nextSnap));
  };

  useEffect(() => {
    mounted.current = true;
    api.get('/garments/services').then(({ data }) => setServices(data)).catch((error) => setPortalError(requestMessage(error, 'Unable to load services.')));
    loadPortal().then(() => setPortalError('')).catch((error) => setPortalError(requestMessage(error, 'Unable to load your portal data right now.'))).finally(() => setPortalLoading(false));
    const timer = setInterval(() => {
      loadPortal().then(() => setPortalError('')).catch((error) => setPortalError(requestMessage(error, 'Updates paused. Your last loaded data is shown.')));
    }, 15000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [customerId]);

  const latestOrders = useMemo(() => [...orders].sort((a, b) => b.id - a.id), [orders]);
  const pendingInvoices = payments.filter((item) => ['PENDING', 'PARTIALLY_PAID'].includes(item.status));

  const submitOrder = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (editingOrderId) {
        await api.put(`/orders/${editingOrderId}`, { customerId, serviceType: formData.serviceType, status: 'RECEIVED' });
      } else {
        const selectedService = services.find((item) => Number(item.id) === Number(formData.serviceId));
        if (!selectedService) throw new Error('Choose an available service.');
        await api.post('/orders/booking', {
          order: { customerId, serviceType: selectedService.name, status: 'RECEIVED' },
          garment: { serviceId: Number(formData.serviceId), garmentType: formData.garmentType, fabricType: formData.fabricType, quantity: Number(formData.quantity), careInstructions: formData.careInstructions, damaged: false },
          delivery: { timeSlot: formData.deliverySlot, status: 'SCHEDULED', driverName: 'Unassigned' },
        });
      }

      setMessage(editingOrderId ? 'Pending order updated.' : 'Order placed and delivery slot requested.');
      setFormData(initialOrder);
      setEditingOrderId(null);
      await loadPortal();
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || requestError.message || 'Unable to save order.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (order) => {
    const delivery = deliveries.find((item) => Number(item.orderId) === Number(order.id));
    setEditingOrderId(order.id);
    setFormData({
      ...initialOrder,
      serviceType: order.serviceType,
      careInstructions: '',
      deliverySlot: delivery?.timeSlot || initialOrder.deliverySlot,
    });
    setActiveSection('book');
  };

  const cancelOrder = async (order) => {
    if (order.status !== 'RECEIVED') {
      setMessage('Only pending orders can be cancelled from the customer portal.');
      return;
    }
    if (!window.confirm(`Cancel order #${order.id}?`)) return;
    setLoading(true);
    try { await api.delete(`/orders/${order.id}`); setMessage(`Order #${order.id} cancelled.`); await loadPortal(); }
    catch (error) { setMessage(requestMessage(error)); }
    finally { setLoading(false); }
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/customers/me', profileData);
      const nextUser = { ...user, ...data, username: data.email, customerId: data.id, role: 'CUSTOMER' };
      setUser(nextUser);
      localStorage.setItem('cleancloud_user', JSON.stringify(nextUser));
      profileDirty.current = false;
      setProfileData({ fullName: data.fullName || '', email: data.email || '', phone: data.phone || '', address: data.address || '', password: '' });
      const previous = decodeCredentials(getCredentials() || '');
      const retainedPassword = previous.slice(previous.indexOf(':') + 1);
      setCredentials(encodeCredentials(data.email, profileData.password || retainedPassword));
      setMessage('Profile updated successfully.');
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || 'Unable to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('cleancloud_user');
    clearCredentials();
    navigate('/');
  };

  const unreadCount = notifications.filter((item) => item.unread).length;
  const markNotesRead = () => {
    const next = notifications.map((item) => ({ ...item, unread: false }));
    setNotifications(next);
    if (customerId) localStorage.setItem(notesKey(customerId), JSON.stringify(next));
    setShowNotes((open) => !open);
  };

  const sectionLinks = [['overview', 'Overview'], ['orders', 'My orders'], ['book', 'Book a service'], ['care', 'Garment care'], ['profile', 'My profile']];
  const visibleOrders = activeSection === 'overview' ? latestOrders.slice(0, 3) : latestOrders;
  const firstName = (user?.fullName || 'there').split(' ')[0];

  const bookingForm = <form onSubmit={submitOrder} className="portal-booking workspace-panel">
    <div className="workspace-panel-heading"><span className="workspace-icon"><PortalIcon name="book"/></span><div><p className="workspace-kicker">YOUR NEXT LAUNDRY DAY</p><h2>{editingOrderId ? `Edit order #${editingOrderId}` : 'Book a laundry service'}</h2></div></div>
    <p className="workspace-copy">Choose your service, share care instructions and request your delivery window.</p>
    {editingOrderId ? <p className="mt-4 workspace-copy">Service: {formData.serviceType}. Contact the team for changes to tagged garments or the delivery request.</p> : <>
    <label className="label mt-6">Service<select value={formData.serviceId} onChange={(event) => setFormData({ ...formData, serviceId: event.target.value })} className="field mt-2" required><option value="">Choose a service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · LKR {Number(service.price).toLocaleString()} per item</option>)}</select></label>
    <label className="label mt-4">Garment type<input value={formData.garmentType} onChange={(e) => setFormData({ ...formData, garmentType: e.target.value })} className="field mt-2" placeholder="e.g. Shirt" minLength={2} maxLength={50} required /></label>
    <label className="label mt-4">Fabric<input value={formData.fabricType} onChange={(e) => setFormData({ ...formData, fabricType: e.target.value })} className="field mt-2" placeholder="e.g. Cotton" minLength={2} maxLength={50} required /></label>
    <label className="label mt-4">Quantity<input type="number" min="1" max="1000" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="field mt-2" required /></label>
    <label className="label mt-4">Requested delivery date & time<input type="datetime-local" value={formData.deliverySlot} min={localDateTime()} onChange={(e) => setFormData({ ...formData, deliverySlot: e.target.value })} className="field mt-2" required /></label>
    <label className="label mt-4">Care instructions<textarea value={formData.careInstructions} maxLength={2000} onChange={(event) => setFormData({ ...formData, careInstructions: event.target.value })} className="field mt-2 min-h-28" placeholder="Fabric details, stains or special handling instructions"/></label>
    <div className="portal-estimate"><div><span>Estimated garment total</span><p>{formData.serviceId ? `LKR ${(Number(services.find((item) => Number(item.id) === Number(formData.serviceId))?.price || 0) * Number(formData.quantity)).toLocaleString()}` : 'Choose a service'}</p></div><PortalIcon name="invoice"/><small>Uses the current service price in your database. Staff confirms your invoice and records cash received.</small></div>
    </>}
    <button disabled={loading} className="btn-primary mt-5 w-full">{loading ? 'Saving...' : editingOrderId ? 'Save pending order' : 'Submit order'} <span aria-hidden="true">→</span></button>
    {editingOrderId && <button type="button" onClick={() => { setEditingOrderId(null); setFormData(initialOrder); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
  </form>;

  const orderPanel = <section className="workspace-panel portal-orders">
    <div className="workspace-panel-heading"><div><p className="workspace-kicker">YOUR LAUNDRY AT A GLANCE</p><h2>Order tracking <span className="panel-count">{orders.length}</span></h2></div>{activeSection === 'overview' && <button type="button" className="workspace-text-button" onClick={() => setActiveSection('orders')}>View all →</button>}</div>
    <div className="portal-order-list">{visibleOrders.map((order) => {
      const invoice = payments.find((item) => Number(item.orderId) === Number(order.id));
      const delivery = deliveries.find((item) => Number(item.orderId) === Number(order.id));
      return <article key={order.id} className="portal-order-card"><div className="portal-order-title"><div><span className="order-card-number">Order #{order.id}</span><p>{order.serviceType} service</p></div><Status value={order.status}/></div><dl className="portal-order-details"><div><dt>Invoice</dt><dd>{invoice ? `LKR ${Number(invoice.amount || 0).toLocaleString()} · ${statusLabel(invoice.status)}` : 'Waiting for invoice'}</dd></div><div><dt>Delivery</dt><dd>{delivery ? `${statusLabel(delivery.status)} · ${delivery.timeSlot}` : 'Not scheduled'}</dd></div></dl><div className="portal-order-actions">{['PENDING', 'PARTIALLY_PAID'].includes(invoice?.status) && <span className="workspace-copy">Cash payment pending · Pay the staff when collecting your laundry.</span>}{order.status === 'RECEIVED' && <><button type="button" onClick={() => startEdit(order)} className="btn-soft">Edit order</button><button type="button" disabled={loading} onClick={() => cancelOrder(order)} className="btn-danger">Cancel order</button></>}</div></article>;
    })}{!latestOrders.length && <div className="workspace-empty"><span className="empty-icon"><PortalIcon name="orders"/></span><h3>Your first order starts here.</h3><p>Once you book, your order status, invoice and delivery updates will appear in this space.</p><button type="button" className="btn-soft" onClick={() => setActiveSection('book')}>Schedule a service →</button></div>}</div>
  </section>;

  const carePanel = <section className="workspace-panel portal-care"><div className="workspace-panel-heading"><div><p className="workspace-kicker">CARE IN EVERY DETAIL</p><h2>Garments & care notes</h2></div><PortalIcon name="care" className="panel-heading-icon"/></div><div className="portal-care-list">{garments.map((garment) => <article key={garment.id} className="portal-care-card"><span className="workspace-icon"><PortalIcon name="care"/></span><div><h3>Order #{garment.orderId} · {garment.fabricType}</h3><p>{garment.careInstructions || 'No additional instructions recorded.'}</p>{garment.damaged && <span className="badge mt-2 bg-rose-100 text-rose-800">Damage flagged</span>}{garment.missing && <span className="badge mt-2 bg-rose-100 text-rose-800">Missing item reported</span>}</div></article>)}{!garments.length && <div className="workspace-empty compact-empty"><span className="empty-icon"><PortalIcon name="care"/></span><h3>Care notes, kept together.</h3><p>Add fabric details when booking. Garment notes recorded for your orders will appear here.</p></div>}</div></section>;

  const profilePanel = <section className="workspace-panel portal-profile"><div className="workspace-panel-heading"><span className="workspace-icon"><PortalIcon name="profile"/></span><div><p className="workspace-kicker">YOUR ACCOUNT</p><h2>Profile & pickup details</h2></div></div><p className="workspace-copy">Keep your contact and pickup information up to date.</p><form onSubmit={updateProfile} className="profile-fields mt-6"><label className="label">Full name<input className="field mt-2" value={profileData.fullName} onChange={(event) => updateProfileField({ ...profileData, fullName: event.target.value })} autoComplete="name" required/></label><label className="label">Email address<input type="email" className="field mt-2" value={profileData.email} onChange={(event) => updateProfileField({ ...profileData, email: event.target.value })} autoComplete="email" required/></label><label className="label">Phone number<input type="tel" className="field mt-2" value={profileData.phone} onChange={(event) => updateProfileField({ ...profileData, phone: event.target.value })} autoComplete="tel" required/></label><label className="label profile-wide">Pickup address<textarea className="field mt-2 min-h-20" value={profileData.address} onChange={(event) => updateProfileField({ ...profileData, address: event.target.value })} autoComplete="street-address" required/></label><label className="label profile-wide">New password <span className="field-optional">(optional)</span><input type="password" minLength={8} maxLength={72} className="field mt-2" value={profileData.password} onChange={(event) => updateProfileField({ ...profileData, password: event.target.value })} autoComplete="new-password" placeholder="Leave blank to keep your current password"/></label><p className="workspace-copy profile-wide">Your email is your login username. Leave the new password blank to keep your existing password.</p><button disabled={profileSaving} className="btn-primary profile-wide">{profileSaving ? 'Saving profile...' : 'Save profile changes'}</button></form></section>;

  return <div className="customer-workspace workspace-theme">
    <aside className="portal-sidebar"><Link to="/" className="workspace-brand"><span className="brand-mark">CC</span><span>CleanCloud<small>Customer workspace</small></span></Link><p className="sidebar-label">MY LAUNDRY</p><nav aria-label="Customer workspace">{sectionLinks.map(([id,label]) => <button key={id} type="button" className={activeSection === id ? 'workspace-nav-item is-active' : 'workspace-nav-item'} aria-pressed={activeSection === id} onClick={() => setActiveSection(id)}><PortalIcon name={id}/><span>{label}</span>{activeSection === id && <i aria-hidden="true"/>}</button>)}</nav><div className="portal-sidebar-bottom"><span className="workspace-avatar">{(user?.fullName || user?.username || 'C').slice(0,1).toUpperCase()}</span><div><strong>{user?.fullName || user?.username}</strong><small>Customer account</small></div><Link to="/" className="workspace-home-link">Back to the website ↗</Link></div></aside>
    <div className="portal-workspace-body">
      <header className="portal-topbar"><div className="workspace-breadcrumb">My workspace <span aria-hidden="true">/</span><strong>{sectionLinks.find(([id]) => id === activeSection)?.[1]}</strong></div><div className="portal-header-actions"><div className="portal-notification-anchor"><button ref={notesButton} type="button" onClick={markNotesRead} className="workspace-icon-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={showNotes} aria-controls="customer-notifications"><PortalIcon name="bell"/>{unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}</button>{showNotes && <section ref={notesPanel} id="customer-notifications" className="notification-popover" aria-label="Order notifications"><div className="notification-heading"><div><strong>Your notifications</strong><small>Order, invoice & delivery updates</small></div><button type="button" className="workspace-icon-button" onClick={() => { setShowNotes(false); notesButton.current?.focus(); }} aria-label="Close notifications">×</button></div><div className="notification-list">{notifications.length ? notifications.map((note) => <article key={note.id} className={note.unread ? 'notification-item is-unread' : 'notification-item'}><span className="notification-dot"/><div><p>{note.text}</p><time>{note.time}</time></div></article>) : <div className="notification-empty"><PortalIcon name="bell"/><strong>You’re all caught up.</strong><p>Updates appear here when the team changes your order, payment or delivery.</p></div>}</div></section>}</div><span className="workspace-avatar small-avatar" title={user?.fullName || user?.username}>{(user?.fullName || user?.username || 'C').slice(0,1).toUpperCase()}</span><button type="button" onClick={signOut} className="workspace-signout"><PortalIcon name="signout"/><span>Sign out</span></button></div></header>
      <main className="portal-main" id="portal-content"><section className="portal-welcome"><div><p className="workspace-kicker">YOUR PERSONAL LAUNDRY SPACE</p><h1>Hello, {firstName}.</h1><p>Your orders, care notes and delivery details. All together.</p></div><button type="button" className="btn-primary" onClick={() => setActiveSection('book')}><PortalIcon name="book"/> Book a service</button><div className="welcome-orbit" aria-hidden="true"/></section><section className="portal-metrics" aria-label="Your account summary"><Metric label="Orders" value={portalLoading || portalError ? '—' : orders.length} icon="orders" onClick={() => setActiveSection('orders')}/><Metric label="Care notes" value={portalLoading || portalError ? '—' : garments.length} icon="care" onClick={() => setActiveSection('care')}/><Metric label="Pending invoices" value={portalLoading || portalError ? '—' : pendingInvoices.length} icon="invoice" onClick={() => setActiveSection('orders')}/><Metric label="Deliveries" value={portalLoading || portalError ? '—' : deliveries.length} icon="delivery" onClick={() => setActiveSection('orders')}/></section>
      {portalLoading && <p role="status" className="workspace-message">Loading your account…</p>}
      {portalError && <p role="alert" className="workspace-message">{portalError} <button type="button" className="btn-soft" onClick={() => loadPortal().then(() => setPortalError('')).catch((error) => setPortalError(requestMessage(error)))}>Retry</button></p>}
      {message && <p role="status" className="workspace-message">{message}</p>}
      {activeSection === 'overview' && <div className="portal-overview-grid"><div className="portal-overview-left">{orderPanel}{carePanel}</div>{bookingForm}</div>}
      {activeSection === 'orders' && orderPanel}
      {activeSection === 'book' && <div className="portal-book-view">{bookingForm}<aside className="workspace-panel portal-book-help"><span className="workspace-icon"><PortalIcon name="care"/></span><h2>A little preparation.</h2><p>Check your garment care labels. Include fabric details and any special handling instructions in your request.</p><ul><li>Choose an available service and enter garment details.</li><li>Request an exact delivery date and time.</li><li>Follow updates in My orders.</li><li>Review the final amount on your invoice.</li></ul><button type="button" className="workspace-text-button" onClick={() => setActiveSection('orders')}>View my orders →</button></aside></div>}
      {activeSection === 'care' && carePanel}
      {activeSection === 'profile' && profilePanel}
      <p className="workspace-footer">CleanCloud · Care for your laundry. Clarity for your day.</p></main>
    </div>
  </div>;
}

function Metric({ label, value, icon, onClick }) {
  return <button type="button" onClick={onClick} className="portal-metric"><span className="workspace-icon"><PortalIcon name={icon}/></span><span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong></span><span className="metric-arrow" aria-hidden="true">↗</span></button>;
}

function Status({ value }) {
  const tone = value === 'READY_FOR_COLLECTION' ? 'bg-emerald-100 text-emerald-800' : value === 'IN_WASHING' ? 'bg-amber-100 text-amber-800' : value === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800';
  return <span className={`badge ${tone}`}>{statusLabel(value)}</span>;
}
