import { useEffect, useMemo, useState } from 'react';
import api, { statusLabel, requestMessage, localDateTime } from '../../lib/api';

const emptyForm = { deliveryType: 'DROP_OFF', orderId: '', driverName: 'Unassigned', timeSlot: '', status: 'SCHEDULED' };
const statuses = ['SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'];
const transitions = { SCHEDULED: ['PICKED_UP', 'FAILED', 'CANCELLED'], PICKED_UP: ['IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'], IN_TRANSIT: ['DELIVERED', 'FAILED'], FAILED: ['SCHEDULED', 'CANCELLED'], DELIVERED: [], CANCELLED: [] };

export default function DeliveryDispatchPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const fetchDeliveries = async () => {
    try {
      setDeliveries((await api.get('/deliveries')).data);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load deliveries');
    }
  };

  useEffect(() => { fetchDeliveries(); api.get('/deliveries/drivers').then(({ data }) => setDrivers(data)).catch(() => setError('Unable to load available drivers.')); }, []);

  const summary = useMemo(() => ({
    scheduled: deliveries.filter((delivery) => delivery.status === 'SCHEDULED').length,
    dispatched: deliveries.filter((delivery) => delivery.status === 'PICKED_UP' || delivery.status === 'IN_TRANSIT').length,
    delivered: deliveries.filter((delivery) => delivery.status === 'DELIVERED').length,
  }), [deliveries]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      if (editingId) await api.put(`/deliveries/${editingId}`, formData);
      else await api.post('/deliveries', formData);
      setFormData(emptyForm);
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchDeliveries();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save delivery');
    } finally { setBusy(false); }
  };

  const edit = (delivery) => {
    setEditingId(delivery.id);
    setFormData({ deliveryType: delivery.deliveryType, orderId: delivery.orderId, driverName: delivery.driverName, timeSlot: delivery.timeSlot.replace(' ', 'T'), status: delivery.status });
  };

  const status = async (id, value) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    await api.put(`/deliveries/${id}/status`, value, { headers: { 'Content-Type': 'text/plain' } });
    await fetchDeliveries();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Cancel this delivery?')) return;
    await api.delete(`/deliveries/${id}`);
    await fetchDeliveries();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const showHistory = async (delivery) => {
    setError('');
    try { const { data } = await api.get(`/deliveries/${delivery.id}/history`); setDetail({ ...data, deliveryId: delivery.id }); }
    catch (error) { setError(requestMessage(error)); }
  };
  const reportIncident = async (delivery) => {
    const description = window.prompt(`Describe the incident for delivery #${delivery.id}`);
    if (!description) return;
    setBusy(true); setError('');
    try { await api.post(`/deliveries/${delivery.id}/incidents`, { description }); await showHistory(delivery); setSuccess('Incident reported.'); }
    catch (error) { setError(requestMessage(error)); } finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Delivery Dispatch" subtitle="Schedule pickups and drop-offs, assign drivers, and update route status." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Scheduled" value={loaded ? summary.scheduled : '—'} />
        <Metric label="On route" value={loaded ? summary.dispatched : '—'} />
        <Metric label="Delivered" value={loaded ? summary.delivered : '—'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update delivery #${editingId}` : 'Schedule delivery'}</h2>
          <label className="label mt-5">Order ID<input type="number" min="1" disabled={Boolean(editingId)} value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Delivery type<select disabled={Boolean(editingId)} value={formData.deliveryType} onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })} className="field mt-2"><option value="PICKUP">Pickup</option><option value="DROP_OFF">Drop-off</option></select></label>
          <label className="label mt-4">Driver<select value={formData.driverName} onChange={(e) => setFormData({ ...formData, driverName: e.target.value })} className="field mt-2"><option value="Unassigned">Unassigned</option>{drivers.map((driver) => <option key={driver.email} value={driver.name}>{driver.name} · {driver.email}</option>)}</select><small className="block mt-2 text-slate-500">Assign a driver with a dated shift covering this slot.</small></label>
          <label className="label mt-4">Date & time<input type="datetime-local" value={formData.timeSlot} onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Status<select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="field mt-2">{(editingId ? [formData.status, ...(transitions[deliveries.find((item) => item.id === editingId)?.status] || [])].filter((value, index, list) => list.indexOf(value) === index) : ['SCHEDULED']).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save delivery' : 'Schedule delivery'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData(emptyForm); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Order</th><th className="p-3">Driver</th><th className="p-3">Slot</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="table-cell font-semibold">#{delivery.id}</td>
                    <td className="table-cell">{delivery.orderId}</td>
                    <td className="table-cell">{delivery.driverName}</td>
                    <td className="table-cell">{delivery.timeSlot}</td>
                    <td className="table-cell"><Status value={delivery.status} /></td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busy} onClick={() => showHistory(delivery)} className="btn-soft px-3 py-1.5">History & incidents</button>
                        <button disabled={busy} onClick={() => reportIncident(delivery)} className="btn-soft px-3 py-1.5">Report incident</button>
                        {!['DELIVERED', 'CANCELLED'].includes(delivery.status) && <button disabled={busy} onClick={() => edit(delivery)} className="btn-soft px-3 py-1.5">Edit schedule</button>}
                        {(transitions[delivery.status] || []).filter((value) => !['SCHEDULED','CANCELLED'].includes(value)).map((value) => <button disabled={busy} key={value} onClick={() => status(delivery.id, value)} className="btn-soft px-3 py-1.5">{statusLabel(value)}</button>)}
                        {(transitions[delivery.status] || []).includes('CANCELLED') && <button disabled={busy} onClick={() => remove(delivery.id)} className="btn-danger px-3 py-1.5">Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!deliveries.length && <tr><td className="p-6 text-slate-500" colSpan="6">No delivery schedules.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {detail && <section className="panel-pad mt-6"><div className="flex justify-between"><h2 className="text-xl font-semibold">Delivery #{detail.deliveryId} history & incidents</h2><button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button></div><div className="grid gap-6 md:grid-cols-2 mt-4"><div><h3 className="font-semibold">Status history</h3>{detail.history.map((event, index) => <p key={index} className="mt-3 text-sm">{statusLabel(event.status)} · {event.time}</p>)}</div><div><h3 className="font-semibold">Incidents</h3>{detail.incidents.map((incident) => <article key={incident.id} className="mt-3 text-sm"><p>{incident.description}</p><p>{incident.status === 'OPEN' ? 'Open' : 'Resolved'} · {incident.time}</p>{incident.status === 'OPEN' && <button disabled={busy} className="btn-soft mt-2" onClick={async () => { setBusy(true); try { await api.put(`/deliveries/${detail.deliveryId}/incidents/${incident.id}/resolve`); await showHistory({ id: detail.deliveryId }); setSuccess('Incident resolved.'); } catch (error) { setError(requestMessage(error)); } finally { setBusy(false); } }}>Mark resolved</button>}</article>)}{!detail.incidents.length && <p className="mt-3 text-sm">No incidents reported.</p>}</div></div></section>}
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Dispatch</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}

function Status({ value }) {
  const tone = value === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : value === 'FAILED' ? 'bg-rose-100 text-rose-800' : value === 'PICKED_UP' || value === 'IN_TRANSIT' ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800';
  return <span className={`badge ${tone}`}>{statusLabel(value)}</span>;
}
