import { Link, Outlet } from 'react-router-dom';

export default function CustomerLayout() {
  return (
    <div className="site-shell">
      <header className="public-nav">
        <div className="section-wrap flex min-h-12 flex-wrap items-center justify-between gap-3 py-2">
          <Link to="/" className="brand-link">
            <span className="brand-mark">CC</span>
            <span className="brand-name">CleanCloud</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/customer/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/customer/place-order" className="nav-link">Place order</Link>
            <Link to="/customer/profile" className="nav-link">Profile</Link>
          </nav>
        </div>
      </header>
      <main className="section-wrap py-8">
        <Outlet />
      </main>
    </div>
  );
}
