import { useEffect, useMemo, useState } from 'react';
import api, { statusLabel, requestMessage, localDateTime } from '../../lib/api';

const emptyForm = { customerId: '', serviceType: 'Wash', status: 'RECEIVED' };
const orderTransitions = { RECEIVED: ['IN_WASHING','IN_DRY_CLEANING','IN_IRONING'], IN_WASHING: ['IN_IRONING','QUALITY_CHECKED'], IN_DRY_CLEANING: ['IN_IRONING','QUALITY_CHECKED'], IN_IRONING: ['QUALITY_CHECKED'], QUALITY_CHECKED: ['READY_FOR_COLLECTION'], READY_FOR_COLLECTION: ['OUT_FOR_DELIVERY','COMPLETED'], OUT_FOR_DELIVERY: ['READY_FOR_COLLECTION','COMPLETED'] };

export default function OrderManagementPage() {
  const [orders, setOrders] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const fetchOrders = async () => {
    try {
      setOrders((await api.get('/orders')).data);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load orders');
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const summary = useMemo(() => ({
    pending: orders.filter((order) => order.status === 'RECEIVED').length,
    processing: orders.filter((order) => order.status === 'IN_WASHING').length,
    ready: orders.filter((order) => order.status === 'READY_FOR_COLLECTION').length,
  }), [orders]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      if (editingId) await api.put(`/orders/${editingId}`, formData);
      else await api.post('/orders', formData);
      setFormData(emptyForm);
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchOrders();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save order');
    } finally { setBusy(false); }
  };

  const edit = (order) => {
    setEditingId(order.id);
    setFormData({ customerId: order.customerId, serviceType: order.serviceType, status: order.status });
  };

  const cancel = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Cancel this order?')) return;
    await api.delete(`/orders/${id}`);
    await fetchOrders();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const updateStatus = async (id, status) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    await api.put(`/orders/${id}/status`, status, { headers: { 'Content-Type': 'text/plain' } });
    await fetchOrders();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Order Management" subtitle="Create laundry orders and move them through the operational workflow." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Pending" value={loaded ? summary.pending : '—'} />
        <Metric label="Processing" value={loaded ? summary.processing : '—'} />
        <Metric label="Ready" value={loaded ? summary.ready : '—'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update order #${editingId}` : 'Create order'}</h2>
          <label className="label mt-5">Customer ID<input type="number" min="1" disabled={Boolean(editingId)} value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })} className="field mt-2" required /></label>
          <label className="label mt-4">Service<select value={formData.serviceType} onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })} className="field mt-2"><option>Wash</option><option>Iron</option><option>Dry-Clean</option></select></label>
          <label className="label mt-4">Status<select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="field mt-2">{(editingId ? [...new Set([orders.find((item) => item.id === editingId)?.status, ...(orderTransitions[orders.find((item) => item.id === editingId)?.status] || [])])] : ['RECEIVED']).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save order' : 'Create order'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData(emptyForm); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Customer</th><th className="p-3">Service</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="table-cell font-semibold">#{order.id}</td>
                    <td className="table-cell">{order.customerId}</td>
                    <td className="table-cell">{order.serviceType}</td>
                    <td className="table-cell"><Status value={order.status} /></td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        {!['COMPLETED', 'CANCELLED'].includes(order.status) && <button disabled={busy} onClick={() => edit(order)} className="btn-soft px-3 py-1.5">Edit / update stage</button>}
                        {order.status === 'RECEIVED' && <button disabled={busy} onClick={() => updateStatus(order.id, order.serviceType?.toLowerCase().includes('dry') ? 'IN_DRY_CLEANING' : order.serviceType?.toLowerCase().includes('iron') ? 'IN_IRONING' : 'IN_WASHING')} className="btn-soft px-3 py-1.5">Start processing</button>}
                        {order.status?.startsWith('IN_') && <button disabled={busy} onClick={() => updateStatus(order.id, 'QUALITY_CHECKED')} className="btn-soft px-3 py-1.5">Quality checked</button>}
                        {order.status === 'QUALITY_CHECKED' && <button disabled={busy} onClick={() => updateStatus(order.id, 'READY_FOR_COLLECTION')} className="btn-soft px-3 py-1.5">Ready</button>}
                        {['READY_FOR_COLLECTION','OUT_FOR_DELIVERY'].includes(order.status) && <button disabled={busy} onClick={() => updateStatus(order.id, 'COMPLETED')} className="btn-soft px-3 py-1.5">Complete order</button>}
                        {order.status === 'RECEIVED' && <button disabled={busy} onClick={() => cancel(order.id)} className="btn-danger px-3 py-1.5">Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!orders.length && <tr><td className="p-6 text-slate-500" colSpan="5">No active orders.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Operations</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}

function Status({ value }) {
  const tone = value === 'READY_FOR_COLLECTION' ? 'bg-emerald-100 text-emerald-800' : value === 'IN_WASHING' ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800';
  return <span className={`badge ${tone}`}>{statusLabel(value)}</span>;
}
