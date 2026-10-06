import { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { hasRole, readUser, clearCredentials } from './lib/api';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage, { ProjectPage } from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerPortalPage from './pages/CustomerPortalPage';
import CustomerManagementPage from './pages/staff/CustomerManagementPage';
import OrderManagementPage from './pages/staff/OrderManagementPage';
import GarmentTrackingPage from './pages/staff/GarmentTrackingPage';
import PaymentManagementPage from './pages/staff/PaymentManagementPage';
import DeliveryDispatchPage from './pages/staff/DeliveryDispatchPage';
import StaffManagementPage from './pages/admin/StaffManagementPage';
import OperationsOverviewPage from './pages/staff/OperationsOverviewPage';

const navigation = [
    ['/staff/overview', 'Overview', ['ADMIN', 'CUSTOMER_MANAGER', 'ORDER_MANAGER', 'GARMENT_MANAGER', 'STAFF_MANAGER', 'PAYMENT_MANAGER', 'DELIVERY_MANAGER'], OperationsOverviewPage],
    ['/staff/customers', 'Customers', ['ADMIN', 'CUSTOMER_MANAGER'], CustomerManagementPage],
    ['/staff/orders', 'Orders', ['ADMIN', 'ORDER_MANAGER'], OrderManagementPage],
    ['/staff/garments', 'Garments', ['ADMIN', 'GARMENT_MANAGER'], GarmentTrackingPage],
    ['/staff/payments', 'Payments', ['ADMIN', 'PAYMENT_MANAGER'], PaymentManagementPage],
    ['/staff/delivery', 'Delivery', ['ADMIN', 'DELIVERY_MANAGER'], DeliveryDispatchPage],
    ['/staff/team', 'Staff', ['ADMIN', 'STAFF_MANAGER'], StaffManagementPage],
];

const navIcons = {
  Overview: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Customers: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Orders: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  Garments: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  Payments: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  Delivery: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  Staff: (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
};

function Dashboard() {
    const user = readUser();
    const navigate = useNavigate();
    const location = useLocation();
    const links = navigation.filter(([, , roles]) => hasRole(user, roles));
    const signOut = () => {
        localStorage.removeItem('cleancloud_user');
        clearCredentials();
        navigate('/staff-login');
    };
    const canvasClass = location.pathname.includes('/customers')
        ? 'canvas-customers'
        : location.pathname.includes('/orders')
          ? 'canvas-orders'
          : location.pathname.includes('/garments')
            ? 'canvas-garments'
            : location.pathname.includes('/payments')
              ? 'canvas-payments'
              : location.pathname.includes('/delivery')
                ? 'canvas-delivery'
                : location.pathname.includes('/team')
                  ? 'canvas-staff'
                  : 'canvas-overview';

    return (
        <div className="dashboard-shell workspace-theme">
            <aside className="dashboard-sidebar">
                <div className="dashboard-sidebar-inner">
                    <Link to="/" className="dashboard-brand">
                        <span className="brand-mark">CC</span>
                        <span>
                            <span className="block text-base font-semibold">CleanCloud</span>
                            <span className="block text-xs text-slate-400">Staff workspace</span>
                        </span>
                    </Link>
                    <p className="sidebar-label">WORKSPACE</p>
                    <nav className="flex flex-1 flex-col gap-1" aria-label="Staff workspace">
                        {links.map(([path, label]) => (
                            <NavLink
                                key={path}
                                to={path}
                                className={({ isActive }) =>
                                    isActive ? 'dashboard-nav-link dashboard-nav-link-active' : 'dashboard-nav-link'
                                }
                            >
                                {navIcons[label]}
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="mt-4 border-t border-white/10 pt-4 lg:mt-auto">
                        <p className="text-xs text-slate-500">Signed in as</p>
                        <p className="mt-1 truncate text-sm font-medium text-white">{user?.username}</p>
                        <p className="mt-1 text-xs font-medium text-sky-300">
                            {user?.role?.replaceAll('_', ' ')}
                        </p>
                        <button
                            onClick={signOut}
                            className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-sky-400/40 hover:bg-white/10 hover:text-white"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </aside>
            <main className={`dash-canvas min-w-0 ${canvasClass}`}>
                <header className="staff-topbar"><div className="workspace-breadcrumb">Workspace <span aria-hidden="true">/</span><strong>{links.find(([path]) => location.pathname === path)?.[1] || 'Overview'}</strong></div><div className="staff-topbar-account"><span className="staff-role-badge">{user?.role?.replaceAll('_', ' ')}</span><span className="workspace-avatar small-avatar">{(user?.fullName || user?.username || 'S').slice(0,1).toUpperCase()}</span><button type="button" className="workspace-signout" onClick={signOut}>Sign out</button></div></header>
                <Routes>
                    {navigation.map(([path, , roles, Page]) => (
                        <Route
                            key={path}
                            path={path.replace('/staff/', '')}
                            element={
                                <ProtectedRoute allowedRoles={roles}>
                                    <Page />
                                </ProtectedRoute>
                            }
                        />
                    ))}
                    <Route
                        path="*"
                        element={<Navigate to={links[0]?.[0].replace('/staff/', '') || '/login'} replace />}
                    />
                </Routes>
            </main>
        </div>
    );
}

function BubbleCursor() {
    const cursor = useRef(null);
    useEffect(() => {
        const media = window.matchMedia('(hover: hover) and (pointer: fine)');
        const element = cursor.current;
        const hide = () => { document.body.classList.remove('bubble-cursor-active'); element?.classList.remove('is-visible'); };
        const move = (event) => {
            if (!media.matches || event.pointerType !== 'mouse' || !element) { hide(); return; }
            element.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
            element.classList.toggle('is-interactive', Boolean(event.target.closest('a,button,summary,input,textarea,select,[role="button"]')));
            element.classList.add('is-visible');
            document.body.classList.add('bubble-cursor-active');
        };
        const down = () => element?.classList.add('is-pressed');
        const up = () => element?.classList.remove('is-pressed');
        const leave = (event) => { if (!event.relatedTarget) hide(); };
        const visibility = () => { if (document.hidden) hide(); };
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerdown', down);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointerout', leave);
        window.addEventListener('blur', hide);
        document.addEventListener('visibilitychange', visibility);
        media.addEventListener('change', hide);
        return () => {
            hide();
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerdown', down);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointerout', leave);
            window.removeEventListener('blur', hide);
            document.removeEventListener('visibilitychange', visibility);
            media.removeEventListener('change', hide);
        };
    }, []);
    return <div ref={cursor} className="bubble-cursor" aria-hidden="true"><span className="cursor-ring"/><span className="cursor-dot"/></div>;
}

function PublicPagePosition() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (pathname === '/' || pathname === '/project') {
            document.title = pathname === '/project' ? 'Our project | CleanCloud' : 'CleanCloud Laundry Services';
            const target = hash && document.getElementById(hash.slice(1));
            if (target) target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            else window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [pathname, hash]);
    return null;
}

export default function App() {
    return (
        <Router>
            <PublicPagePosition />
            <BubbleCursor />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/project" element={<ProjectPage />} />
                <Route path="/services" element={<Navigate to="/#services" replace />} />
                <Route path="/how-it-works" element={<Navigate to="/#how" replace />} />
                <Route path="/login" element={<LoginPage key="customer" initialMode="customer" />} />
                <Route path="/staff-login" element={<LoginPage key="staff" initialMode="staff" />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                    path="/portal"
                    element={
                        <ProtectedRoute allowedRoles={['CUSTOMER']}>
                            <CustomerPortalPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/staff/*"
                    element={
                        <ProtectedRoute
                            allowedRoles={[
                                'ADMIN',
                                'CUSTOMER_MANAGER',
                                'ORDER_MANAGER',
                                'GARMENT_MANAGER',
                                'STAFF_MANAGER',
                                'PAYMENT_MANAGER',
                                'DELIVERY_MANAGER',
                            ]}
                            redirectTo="/staff-login"
                        >
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}
