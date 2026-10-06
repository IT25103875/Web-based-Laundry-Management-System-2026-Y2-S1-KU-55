import { Link, Outlet } from 'react-router-dom';

export default function AdminPanelLayout() {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-inner">
          <Link to="/" className="dashboard-brand">
            <span className="brand-mark">CC</span>
            <span>
              <span className="block text-base font-semibold">CleanCloud</span>
              <span className="block text-xs text-[#a1a1a6]">Admin workspace</span>
            </span>
          </Link>
          <nav className="space-y-1">
            <Link to="/admin/staff-directory" className="dashboard-nav-link">Staff management</Link>
            <Link to="/admin/revenue" className="dashboard-nav-link">Revenue reports</Link>
            <Link to="/admin/audit-logs" className="dashboard-nav-link">Audit logs</Link>
          </nav>
        </div>
      </aside>
      <main className="dashboard-page">
        <Outlet />
      </main>
    </div>
  );
}
