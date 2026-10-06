import { hasRole, readUser } from '../lib/api';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/login' }) {
    const user = readUser();
    if (!user) return <Navigate to={redirectTo} replace />;
    if (user.mustChangePassword) return <Navigate to="/staff-login" replace />;
    if (!hasRole(user, allowedRoles)) return <Navigate to="/" replace />;
    return children;
}
