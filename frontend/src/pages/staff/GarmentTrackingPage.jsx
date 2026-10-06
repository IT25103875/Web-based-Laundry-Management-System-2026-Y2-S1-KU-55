import { useEffect, useMemo, useState } from 'react';
import api, { requestMessage } from '../../lib/api';

const emptyForm = { orderId: '', serviceId: '', garmentType: '', quantity: 1, fabricType: '', careInstructions: '', damaged: false };

export default function GarmentTrackingPage({ activeOrderId = '' }) {
  const [garments, setGarments] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm, orderId: activeOrderId });
  const [editingId, setEditingId] = useState(null);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const fetchGarments = async () => {
    try {
      setGarments((await api.get('/garments')).data);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load garments');
    }
  };

  useEffect(() => { fetchGarments(); api.get('/garments/services').then(({ data }) => setServices(data)).catch(() => setError('Unable to load available services.')); }, []);

  const summary = useMemo(() => ({
    total: garments.length,
    damaged: garments.filter((garment) => garment.damaged).length,
    care: garments.filter((garment) => garment.careInstructions).length,
  }), [garments]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      if (editingId) await api.put(`/garments/${editingId}`, formData);
      else await api.post('/garments', formData);
      setFormData({ ...emptyForm, orderId: activeOrderId });
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchGarments();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save garment');
    } finally { setBusy(false); }
  };

  const edit = (garment) => {
    setEditingId(garment.id);
    setFormData({ ...emptyForm, ...garment });
  };

  const remove = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Remove this garment entry?')) return;
    await api.delete(`/garments/${id}`);
    await fetchGarments();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const toggleDamage = async (garment) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    await api.put(`/garments/${garment.id}/damage?isDamaged=${!garment.damaged}`);
    await fetchGarments();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const reportMissing = async (garment) => {
    const description = window.prompt(`Describe the missing item for garment #${garment.id}`);
    if (!description) return;
    setBusy(true); setError('');
    try { await api.post(`/garments/${garment.id}/exceptions`, { type: 'MISSING', description }); await fetchGarments(); setSuccess('Missing-item report saved.'); }
    catch (error) { setError(requestMessage(error)); } finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Garment Tracking" subtitle="Digitally tag garments, record fabric care, and flag damage or missing-item issues." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Tagged garments" value={loaded ? summary.total : '—'} />
        <Metric label="Care instructions" value={loaded ? summary.care : '—'} />
        <Metric label="Damage flags" value={loaded ? summary.damaged : '—'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update garment #${editingId}` : 'Tag garment'}</h2>
          <label className="label mt-5">Order ID<input type="number" min="1" disabled={Boolean(editingId)} value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Service<select value={formData.serviceId} disabled={Boolean(editingId)} onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })} className="field mt-2" required><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · LKR {Number(service.price).toLocaleString()}</option>)}</select></label>
          <label className="label mt-4">Garment type<input value={formData.garmentType} onChange={(e) => setFormData({ ...formData, garmentType: e.target.value })} className="field mt-2" minLength={2} maxLength={50} required /></label>
          <label className="label mt-4">Quantity<input type="number" min="1" max="1000" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Fabric type<input value={formData.fabricType} onChange={(e) => setFormData({ ...formData, fabricType: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Care instructions<textarea value={formData.careInstructions} onChange={(e) => setFormData({ ...formData, careInstructions: e.target.value })} className="field mt-2 min-h-24" maxLength={2000} /></label>
          <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" disabled={Boolean(editingId && formData.damaged)} checked={formData.damaged} onChange={(e) => setFormData({ ...formData, damaged: e.target.checked })} /> Damage reported</label>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save garment' : 'Add garment'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData({ ...emptyForm, orderId: activeOrderId }); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Order</th><th className="p-3">Fabric</th><th className="p-3">Care</th><th className="p-3">Damage</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {garments.map((garment) => (
                  <tr key={garment.id}>
                    <td className="table-cell font-semibold">#{garment.id}</td>
                    <td className="table-cell">{garment.orderId}</td>
                    <td className="table-cell">{garment.garmentType} · {garment.fabricType}<small className="block">{garment.quantity} × LKR {Number(garment.unitPrice).toLocaleString()}</small></td>
                    <td className="table-cell max-w-xs">{garment.careInstructions}</td>
                    <td className="table-cell">{garment.missing ? <span className="badge bg-rose-100 text-rose-800">Missing</span> : garment.damaged ? <span className="badge bg-rose-100 text-rose-800">Flagged</span> : <span className="badge bg-emerald-100 text-emerald-800">Clear</span>}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busy} onClick={() => edit(garment)} className="btn-soft px-3 py-1.5">Edit</button>
                        {!garment.damaged && <button disabled={busy} onClick={() => toggleDamage(garment)} className="btn-soft px-3 py-1.5">Report damage</button>}
                        {!garment.missing && <button disabled={busy} onClick={() => reportMissing(garment)} className="btn-soft px-3 py-1.5">Report missing</button>}
                        <button disabled={busy} onClick={() => remove(garment.id)} className="btn-danger px-3 py-1.5">Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!garments.length && <tr><td className="p-6 text-slate-500" colSpan="6">No garment records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Garments</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}
