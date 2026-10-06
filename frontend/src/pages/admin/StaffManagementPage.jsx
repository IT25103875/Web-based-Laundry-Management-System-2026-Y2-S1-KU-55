import { useEffect, useMemo, useState } from 'react';
import api, { requestMessage, localDateTime } from '../../lib/api';

const emptyForm = { fullName: '', email: '', phone: '', address: '', jobPosition: '', dateOfJoining: localDateTime().slice(0, 10), salary: '', branch: 'Main Branch', department: '', emergencyContactName: '', emergencyContactPhone: '', supervisorId: '', temporaryPassword: '', systemRole: 'WASHER', shiftDate: '', startTime: '', endTime: '', duty: '', shiftId: null };
const roles = ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'CUSTOMER_SERVICE_OFFICER', 'CASHIER', 'DELIVERY_COORDINATOR', 'DRIVER', 'WASHER'];

export default function StaffManagementPage() {
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [audit, setAudit] = useState([]);

  const fetchEmployees = async () => {
    try {
      setEmployees((await api.get('/staff')).data);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load staff directory');
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const coverage = useMemo(() => ({
    admin: employees.filter((employee) => employee.systemRole === 'BUSINESS_OWNER').length,
    washer: employees.filter((employee) => employee.systemRole === 'WASHER').length,
    driver: employees.filter((employee) => employee.systemRole === 'DRIVER').length,
  }), [employees]);

  const handleInputChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSuccess('');
    setError('');
    try {
      if (editingId) await api.put(`/staff/${editingId}`, { ...formData, salary: formData.salary === '' ? null : Number(formData.salary), supervisorId: formData.supervisorId === '' ? null : Number(formData.supervisorId) });
      else await api.post('/staff', { ...formData, salary: formData.salary === '' ? null : Number(formData.salary), supervisorId: formData.supervisorId === '' ? null : Number(formData.supervisorId) });
      setFormData(emptyForm);
      setEditingId(null);
      setSuccess('Saved successfully.');
      await fetchEmployees();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save employee');
    } finally { setBusy(false); }
  };

  const handleEdit = (employee) => {
    setEditingId(employee.id);
    setFormData(Object.fromEntries(Object.entries({ ...emptyForm, ...employee, temporaryPassword: '' }).map(([key, value]) => [key, value ?? (key === 'shiftId' ? null : '')])));
    setShifts([]); setAudit([]);
    api.get(`/staff/${employee.id}/audit`).then(({ data }) => setAudit(data)).catch((error) => setError(requestMessage(error)));
    api.get(`/staff/${employee.id}/shifts`).then(({ data }) => setShifts(data)).catch((error) => setError(requestMessage(error)));

  };

  const handleRevoke = async (id) => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
    if (!window.confirm('Revoke this employee access?')) return;
    await api.delete(`/staff/${id}`);
    await fetchEmployees();
      setSuccess('Action completed.');
    } catch (requestError) { setError(requestMessage(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-5 lg:p-8">
      <PageTitle title="Staff Directory" subtitle="Onboard employees, assign roles, manage shift timings, and revoke access." />
      {!loaded && !error && <p role="status" className="mb-5">Loading records…</p>}
      {error && <p role="alert" className="mb-5 notice-error">{error}</p>}
      {success && <p role="status" className="mb-5 notice-success">{success}</p>}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric label="Employees" value={loaded ? employees.length : '—'} />
        <Metric label="Admins" value={loaded ? coverage.admin : '—'} />
        <Metric label="Washers" value={loaded ? coverage.washer : '—'} />
        <Metric label="Drivers" value={loaded ? coverage.driver : '—'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={handleSubmit} className="panel-pad">
          <h2 className="text-xl font-semibold">{editingId ? `Update employee #${editingId}` : 'Onboard employee'}</h2>
          <label className="label mt-5">Full name<input name="fullName" value={formData.fullName} onChange={handleInputChange} className="field mt-2" required /></label>
          <label className="label mt-4">Email<input type="email" name="email" value={formData.email} onChange={handleInputChange} className="field mt-2" required /></label>
          <label className="label mt-4">Phone<input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="field mt-2" minLength={9} maxLength={20} required /></label>
          <label className="label mt-4">Address<textarea name="address" value={formData.address} onChange={handleInputChange} className="field mt-2" minLength={3} maxLength={255} required /></label>
          <label className="label mt-4">Job position<input name="jobPosition" value={formData.jobPosition} onChange={handleInputChange} className="field mt-2" minLength={2} maxLength={50} required /></label>
          <label className="label mt-4">Joining date<input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleInputChange} className="field mt-2" required /></label>
          <label className="label mt-4">Salary (optional)<input type="number" min="0" step="0.01" name="salary" value={formData.salary} onChange={handleInputChange} className="field mt-2" /></label>
          <label className="label mt-4">Branch<input name="branch" value={formData.branch} onChange={handleInputChange} className="field mt-2" maxLength={60} required /></label>
          <label className="label mt-4">Department<input name="department" value={formData.department} onChange={handleInputChange} className="field mt-2" maxLength={60} /></label>
          <label className="label mt-4">Emergency contact name<input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="field mt-2" maxLength={100} /></label>
          <label className="label mt-4">Emergency contact phone<input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleInputChange} className="field mt-2" maxLength={20} /></label>
          <label className="label mt-4">Supervisor ID (optional)<input type="number" name="supervisorId" min="1" value={formData.supervisorId} onChange={handleInputChange} className="field mt-2" /></label>
          <label className="label mt-4">System role<select name="systemRole" value={formData.systemRole} onChange={handleInputChange} className="field mt-2">{roles.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
          {!editingId && <label className="label mt-4">Temporary password<input type="password" name="temporaryPassword" autoComplete="new-password" value={formData.temporaryPassword} onChange={handleInputChange} minLength={8} maxLength={72} className="field mt-2" required /><span className="block mt-2 text-sm text-slate-500">The employee must replace this password at first sign-in.</span></label>}
          <fieldset className="mt-6"><legend className="label">Dated shift (optional)</legend>
          <label className="label mt-3">Date<input type="date" name="shiftDate" value={formData.shiftDate} onChange={handleInputChange} className="field mt-2" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="label mt-3">Starts<input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="field mt-2" required={Boolean(formData.shiftDate)} /></label><label className="label mt-3">Ends<input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="field mt-2" required={Boolean(formData.shiftDate)} /></label></div>
          <label className="label mt-3">Duty<input name="duty" value={formData.duty} onChange={handleInputChange} className="field mt-2" maxLength={100} /></label>
          {editingId && <button disabled={busy} type="button" className="btn-soft mt-3" onClick={() => setFormData({ ...formData, shiftId: null, shiftDate: '', startTime: '', endTime: '', duty: '' })}>Add another shift</button>}
          </fieldset>
          <button disabled={busy} className="btn-dark mt-5 w-full">{editingId ? 'Save employee' : 'Onboard employee'}</button>
          {editingId && <button disabled={busy} type="button" onClick={() => { setEditingId(null); setFormData(emptyForm); }} className="btn-soft mt-3 w-full">Cancel edit</button>}
        </form>

        <div><div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="table-head"><tr><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Shift</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="table-cell font-semibold">#{employee.id}</td>
                    <td className="table-cell">{employee.fullName}</td>
                    <td className="table-cell">{employee.email}</td>
                    <td className="table-cell"><span className="badge bg-orange-100 text-orange-800">{employee.systemRole.replaceAll('_', ' ')}</span></td>
                    <td className="table-cell">{employee.shiftDate ? `${employee.shiftDate} · ${employee.startTime}–${employee.endTime}` : 'No shift scheduled'}{employee.duty && <small className="block">{employee.duty}</small>}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={() => handleEdit(employee)} className="btn-soft px-3 py-1.5">Edit</button>
                        <button disabled={busy} onClick={() => handleRevoke(employee.id)} className="btn-danger px-3 py-1.5">Revoke</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!employees.length && <tr><td className="p-6 text-slate-500" colSpan="6">No active staff records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {editingId && <section className="panel-pad mt-5" aria-label="Employee schedule"><h2 className="text-xl font-semibold">Schedule for employee #{editingId}</h2>{shifts.length ? shifts.map((shift) => <p key={shift.id} className="mt-3 text-sm">{shift.date} · {shift.start}–{shift.end} · {shift.duty || 'No duty specified'}</p>) : <p className="mt-3 text-sm">No shifts scheduled.</p>}<h3 className="mt-6 font-semibold">Access & role history</h3>{audit.map((entry, index) => <article key={index} className="mt-3 text-sm"><strong>{entry.action.replaceAll('_', ' ')}</strong><p>{entry.before} → {entry.after}</p><small>{entry.time}</small></article>)}{!audit.length && <p className="mt-3 text-sm">No audit entries available.</p>}</section>}
        </div>
      </section>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return <div className="mb-6"><p className="page-kicker">Staff access</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}
