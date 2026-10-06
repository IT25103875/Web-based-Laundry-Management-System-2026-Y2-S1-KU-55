import { useEffect, useMemo, useState } from 'react';
import api, { requestMessage } from '../../lib/api';

const emptyForm = { fullName: '', email: '', phone: '', address: '', password: '' };

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const fetchCustomers = async () => {
    try {
      setCustomers((await api.get('/customers')).data);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load customers');
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filteredCustomers = useMemo(() => {
    const term = query.toLowerCase();
    return customers.filter((customer) => [customer.fullName, customer.email, customer.phone, customer.address].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [customers, query]);

  const update = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      if (editingId) await api.put(`/customers/${editingId}`, formData);
      else await api.post('/customers', formData);
      setFormData(emptyForm);
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchCustomers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save customer');
    } finally { setBusy(false); }
  };

  const edit = (customer) => {
    setEditingId(customer.id);
    setFormData({ fullName: customer.fullName, email: customer.email, phone: customer.phone, address: customer.address, password: '' });
  };

  const archive = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Archive this customer record?')) return;
    await api.delete(`/customers/${id}`);
    await fetchCustomers();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Customer Management" subtitle="Register customers, maintain contact details, and archive inactive profiles." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Active customers" value={loaded ? customers.length : '—'} />
        <Metric label="Search results" value={loaded ? filteredCustomers.length : '—'} />
        <Metric label="Portal accounts" value={customers.filter((customer) => customer.email).length} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={submit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update customer #${editingId}` : 'Register customer'}</h2>
          <label className="label mt-5">Full name<input name="fullName" minLength={2} maxLength={100} value={formData.fullName} onChange={update} className="field mt-2" required /></label>
          <label className="label mt-4">Email<input type="email" name="email" maxLength={100} value={formData.email} onChange={update} className="field mt-2" required /></label>
          <label className="label mt-4">Phone<input name="phone" minLength={9} maxLength={20} value={formData.phone} onChange={update} className="field mt-2" required /></label>
          <label className="label mt-4">Address<textarea name="address" minLength={3} maxLength={150} value={formData.address} onChange={update} className="field mt-2 min-h-20" required /></label>
          <label className="label mt-4">Password<input type="password" name="password" minLength={8} maxLength={72} placeholder={editingId ? 'Leave blank to keep current password' : ''} value={formData.password} onChange={update} className="field mt-2" required={!editingId} /></label>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save customer' : 'Register customer'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData(emptyForm); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field" placeholder="Search customers by name, email, phone or address" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Address</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="table-cell font-semibold">#{customer.id}</td>
                    <td className="table-cell">{customer.fullName}</td>
                    <td className="table-cell">{customer.email}</td>
                    <td className="table-cell">{customer.phone}</td>
                    <td className="table-cell max-w-xs">{customer.address}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={() => edit(customer)} className="btn-soft px-3 py-1.5">Edit</button>
                        <button disabled={busy} onClick={() => archive(customer.id)} className="btn-danger px-3 py-1.5">Archive</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredCustomers.length && <tr><td className="p-6 text-slate-500" colSpan="6">No matching customers.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Customers</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}
