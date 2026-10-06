import { Link, Outlet } from 'react-router-dom';

export default function StaffDashboardLayout() {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-inner">
          <Link to="/" className="dashboard-brand">
            <span className="brand-mark">CC</span>
            <span>
              <span className="block text-base font-semibold">CleanCloud</span>
              <span className="block text-xs text-[#a1a1a6]">Staff workspace</span>
            </span>
          </Link>
          <nav className="space-y-1">
            <Link to="/staff/overview" className="dashboard-nav-link">Overview</Link>
            <Link to="/staff/customers" className="dashboard-nav-link">Customers</Link>
            <Link to="/staff/orders" className="dashboard-nav-link">Orders</Link>
            <Link to="/staff/garments" className="dashboard-nav-link">Garments</Link>
            <Link to="/staff/payments" className="dashboard-nav-link">Payments</Link>
            <Link to="/staff/delivery" className="dashboard-nav-link">Deliveries</Link>
            <Link to="/staff/team" className="dashboard-nav-link">Staff</Link>
          </nav>
        </div>
      </aside>
      <main className="dashboard-page">
        <Outlet />
      </main>
    </div>
  );
}
