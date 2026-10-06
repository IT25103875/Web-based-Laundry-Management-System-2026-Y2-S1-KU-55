import { useEffect, useMemo, useState } from 'react';
import api, { statusLabel, requestMessage, hasRole, readUser } from '../../lib/api';

const emptyForm = { orderId: '', amount: '', status: 'PENDING' };

export default function PaymentManagementPage() {
  const [invoices, setInvoices] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [receipts, setReceipts] = useState(null);
  const canApprove = hasRole(readUser(), ['ADMIN']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const fetchInvoices = async () => {
    try {
      const [invoiceResponse, refundResponse, receiptResponse] = await Promise.all([api.get('/payments'), api.get('/payments/refunds'), api.get('/payments/summary')]);
      setInvoices(invoiceResponse.data); setLoaded(true); setRefunds(refundResponse.data); setReceipts(receiptResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load invoices');
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const totals = useMemo(() => ({
    paid: Number(receipts?.net || 0),
    pending: invoices.filter((invoice) => invoice.status === 'PENDING').length,
    refunded: refunds.filter((refund) => refund.status === 'PROCESSED').length,
  }), [invoices, refunds, receipts]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      await api.post('/payments', { orderId: Number(formData.orderId), status: 'PENDING' });
      setFormData(emptyForm);
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchInvoices();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save invoice');
    } finally { setBusy(false); }
  };

  const edit = (invoice) => {
    setEditingId(invoice.id);
    setFormData({ orderId: invoice.orderId, amount: invoice.amount, status: invoice.status });
  };

  const markPaid = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    await api.put(`/payments/${id}/pay`);
    await fetchInvoices();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const updateStatus = async (id, value) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    await api.put(`/payments/${id}/refund`, value, { headers: { 'Content-Type': 'text/plain' } });
    await fetchInvoices();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Void this unpaid invoice?')) return;
    await api.delete(`/payments/${id}`);
    await fetchInvoices();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Payments & Invoices" subtitle="Generate invoices, verify payments, and process refunds or voids." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Net cash received" value={`LKR ${totals.paid.toLocaleString()}`} />
        <Metric label="Pending invoices" value={loaded ? totals.pending : '—'} />
        <Metric label="Refunded" value={loaded ? totals.refunded : '—'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update invoice #${editingId}` : 'Create invoice'}</h2>
          <label className="label mt-5">Order ID<input type="number" min="1" value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} className="field mt-2" required /></label>
          <p className="mt-4 text-sm text-slate-500">The invoice total is calculated from the saved garment quantities and service prices. It cannot be edited after generation.</p>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save invoice' : 'Generate invoice'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData(emptyForm); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="table-cell font-semibold">#{invoice.id}</td>
                    <td className="table-cell">{invoice.orderId}</td>
                    <td className="table-cell">LKR {Number(invoice.amount || 0).toLocaleString()}</td>
                    <td className="table-cell"><Status value={invoice.status} /></td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        {['PENDING','PARTIALLY_PAID'].includes(invoice.status) && <button disabled={busy} onClick={() => { if (window.confirm('Confirm you received the remaining cash amount?')) markPaid(invoice.id); }} className="btn-soft px-3 py-1.5">Record cash received</button>}
                        {['PAID','PARTIALLY_PAID'].includes(invoice.status) && <button disabled={busy} onClick={() => updateStatus(invoice.id, 'REFUNDED')} className="btn-soft px-3 py-1.5">Request refund</button>}
                        {invoice.status === 'PENDING' && <button disabled={busy} onClick={() => remove(invoice.id)} className="btn-danger px-3 py-1.5">Void unpaid invoice</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!invoices.length && <tr><td className="p-6 text-slate-500" colSpan="5">No invoices yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="panel-pad mt-6"><h2 className="text-xl font-semibold">Refund requests</h2><p className="mt-2 text-sm text-slate-500">The business owner approves requests. Record completion only after returning the cash.</p><div className="overflow-x-auto mt-4"><table className="w-full min-w-[640px] text-sm text-left"><thead className="table-head"><tr><th className="p-3">Refund</th><th className="p-3">Invoice</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{refunds.map((refund) => <tr key={refund.id}><td className="table-cell">#{refund.id}</td><td className="table-cell">#{refund.invoiceId}</td><td className="table-cell">LKR {Number(refund.amount).toLocaleString()}</td><td className="table-cell">{statusLabel(refund.status)}</td><td className="table-cell">{canApprove && (refund.status === 'REQUESTED' ? ['APPROVED','REJECTED'] : refund.status === 'APPROVED' ? ['PROCESSED'] : []).map((value) => <button disabled={busy} key={value} className="btn-soft mr-2" onClick={async () => { if (value === 'PROCESSED' && !window.confirm('Confirm the cash refund has been returned?')) return; try { await api.put(`/payments/refunds/${refund.id}/decision`, value, { headers: { 'Content-Type': 'text/plain' } }); await fetchInvoices(); } catch (error) { setError(requestMessage(error)); } }}>{value === 'PROCESSED' ? 'Record cash returned' : statusLabel(value)}</button>)}</td></tr>)}{!refunds.length && <tr><td colSpan="5" className="p-5">No refund requests.</td></tr>}</tbody></table></div></section>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Finance</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}

function Status({ value }) {
  const tone = value === 'PAID' ? 'bg-emerald-100 text-emerald-800' : value === 'REFUNDED' ? 'bg-amber-100 text-amber-800' : value === 'VOID' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800';
  return <span className={`badge ${tone}`}>{statusLabel(value)}</span>;
}
