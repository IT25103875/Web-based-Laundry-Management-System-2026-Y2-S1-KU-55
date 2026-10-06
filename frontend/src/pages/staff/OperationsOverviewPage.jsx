import { useEffect, useMemo, useState } from 'react';
import api, { hasRole, readUser, statusLabel, requestMessage } from '../../lib/api';

export default function OperationsOverviewPage() {
  const [data, setData] = useState({ customers: [], orders: [], garments: [], invoices: [], deliveries: [], staff: [] });
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const user = readUser();

  const load = async () => {
    setLoading(true); setError('');
    const permissions = { customers: 'CUSTOMER_MANAGER', orders: 'ORDER_MANAGER', garments: 'GARMENT_MANAGER', receipts: 'PAYMENT_MANAGER', invoices: 'PAYMENT_MANAGER', deliveries: 'DELIVERY_MANAGER', staff: 'STAFF_MANAGER' };
    const endpoints = { customers: '/customers', orders: '/orders', garments: '/garments', receipts: '/payments/summary', invoices: '/payments', deliveries: '/deliveries', staff: '/staff' };
    const keys = Object.keys(permissions);
    const results = await Promise.allSettled(keys.map((key) => hasRole(user, ['ADMIN', permissions[key]]) ? api.get(endpoints[key]) : Promise.resolve(null)));
    const next = {}; const available = {}; const failed = [];
    results.forEach((result, index) => {
      const key = keys[index];
      available[key] = result.status === 'fulfilled' && result.value !== null;
      next[key] = available[key] ? result.value.data : [];
      if (result.status === 'rejected') failed.push(`${key}: ${requestMessage(result.reason)}`);
    });
    setData(next); setAvailability(available); setLoading(false);
    if (failed.length) setError(`Some summaries are unavailable. ${failed.join(' ')}`);
  };
  useEffect(() => { load(); }, []);
  const count = (key) => loading ? '…' : availability[key] ? data[key].length : '—';

  const revenue = Number(data.receipts?.net || 0);

  const pendingOrders = data.orders.filter((order) => order.status === 'RECEIVED').length;
  const readyOrders = data.orders.filter((order) => order.status === 'READY_FOR_COLLECTION').length;
  const damagedGarments = data.garments.filter((garment) => garment.damaged).length;

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">CleanCloud command center</p>
          <h1 className="page-title">Operations overview</h1>
          <p className="page-subtitle">Live summary across customers, orders, garments, invoices, deliveries, and staff modules.</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-4 text-white shadow-lg shadow-slate-900/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net cash received</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{loading ? 'Loading…' : availability.receipts ? `LKR ${revenue.toLocaleString()}` : 'Unavailable'}</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-5 notice-error">{error} <button type="button" className="btn-soft" onClick={load}>Retry</button></p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Active customers" value={count('customers')} detail="Registered customer profiles" />
        <Metric title="Open orders" value={loading ? '…' : availability.orders ? data.orders.filter((order) => !['COMPLETED','CANCELLED'].includes(order.status)).length : '—'} detail={availability.orders ? `${pendingOrders} received, ${readyOrders} ready` : 'Order summary unavailable for this account'} />
        <Metric title="Tagged garments" value={count('garments')} detail={availability.garments ? `${damagedGarments} damage reports` : 'Garment summary unavailable for this account'} />
        <Metric title="Deliveries" value={count('deliveries')} detail="Scheduled pickup and drop-off jobs" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-semibold">Recent order flow</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head">
                <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Service</th><th className="p-3">Status</th><th className="p-3">Invoice</th><th className="p-3">Delivery</th></tr>
              </thead>
              <tbody>
                {[...data.orders].sort((a, b) => b.id - a.id).slice(0, 8).map((order) => {
                  const invoice = data.invoices.find((item) => Number(item.orderId) === Number(order.id));
                  const delivery = data.deliveries.find((item) => Number(item.orderId) === Number(order.id));
                  return (
                    <tr key={order.id}>
                      <td className="table-cell font-semibold">#{order.id}</td>
                      <td className="table-cell">{order.customerId}</td>
                      <td className="table-cell">{order.serviceType}</td>
                      <td className="table-cell"><Status value={order.status} /></td>
                      <td className="table-cell">{invoice ? `${statusLabel(invoice.status)} - LKR ${Number(invoice.amount || 0).toLocaleString()}` : availability.invoices ? 'Not issued' : 'Unavailable'}</td>
                      <td className="table-cell">{delivery ? `${statusLabel(delivery.status)} / ${delivery.timeSlot}` : availability.deliveries ? 'Not scheduled' : 'Unavailable'}</td>
                    </tr>
                  );
                })}
                {!data.orders.length && <tr><td className="p-6 text-slate-500" colSpan="6">{loading ? 'Loading orders…' : availability.orders ? 'No active orders yet.' : 'Order data is unavailable for your role or could not be loaded.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="panel-pad">
            <h2 className="text-xl font-semibold">Workflow stages</h2>
            {['RECEIVED', 'PROCESSING', 'READY_FOR_COLLECTION', 'COMPLETED'].map((stage) => {
              const count = data.orders.filter((order) => stage === 'PROCESSING' ? order.status?.startsWith('IN_') || order.status === 'QUALITY_CHECKED' : order.status === stage).length;
              return (
                <div key={stage} className="mt-4">
                  <div className="mb-2 flex justify-between text-sm font-bold"><span>{stage === 'PROCESSING' ? 'Processing' : statusLabel(stage)}</span><span>{availability.orders ? count : '—'}</span></div>
                  <div className="h-2 rounded-full bg-slate-50"><div className="h-2 rounded-full bg-[#1d5bff]" style={{ width: `${data.orders.length ? count / data.orders.length * 100 : 0}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="panel-pad">
            <h2 className="text-xl font-semibold">Staff coverage</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {['BUSINESS_OWNER', 'WASHER', 'DRIVER'].map((role) => (
                <div key={role} className="rounded-md bg-slate-50 p-3">
                  <p className="text-2xl font-semibold">{availability.staff ? data.staff.filter((item) => item.systemRole === role).length : '—'}</p>
                  <p className="font-bold text-slate-500">{role.replaceAll('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, detail }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{title}</p>
      <p className="metric-value">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function Status({ value }) {
  const tone = value === 'READY_FOR_COLLECTION' ? 'bg-emerald-100 text-emerald-800' : value?.startsWith('IN_') ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800';
  return <span className={`badge ${tone}`}>{statusLabel(value)}</span>;
}
