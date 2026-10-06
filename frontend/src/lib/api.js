import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env?.DEV ? '/api' : (typeof window === 'undefined' ? 'http://localhost:8080/api' : `${window.location.protocol}//${window.location.hostname}:8080/api`)),
    timeout: 15000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const credentials = getCredentials();
    if (credentials && config.url !== '/garments/services' && (!config.url?.startsWith('/auth/') || config.url === '/auth/password')) {
        config.headers.Authorization = `Basic ${credentials}`;
    }
    return config;
});

export function encodeCredentials(username, password) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`)));
}
export function decodeCredentials(value) {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
}
export function readUser() {
    try { return JSON.parse(localStorage.getItem('cleancloud_user') || 'null'); } catch { return null; }
}
export function getCredentials() {
    const current = sessionStorage.getItem('cleancloud_credentials');
    if (current) return current;
    // Move previous-version credentials out of persistent storage once.
    const previous = localStorage.getItem('cleancloud_credentials');
    if (previous) { sessionStorage.setItem('cleancloud_credentials', previous); localStorage.removeItem('cleancloud_credentials'); }
    return previous;
}
export function setCredentials(value) {
    sessionStorage.setItem('cleancloud_credentials', value);
    localStorage.removeItem('cleancloud_credentials');
}
export function clearCredentials() {
    sessionStorage.removeItem('cleancloud_credentials');
    localStorage.removeItem('cleancloud_credentials');
}
export function statusLabel(value) {
    const labels = { RECEIVED: 'Received', IN_WASHING: 'Washing', IN_DRY_CLEANING: 'Dry cleaning', IN_IRONING: 'Ironing', QUALITY_CHECKED: 'Quality checked', READY_FOR_COLLECTION: 'Ready for collection', OUT_FOR_DELIVERY: 'Out for delivery', COMPLETED: 'Completed', CANCELLED: 'Cancelled', PENDING: 'Pending', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid', VOID: 'Void', REQUESTED: 'Requested', APPROVED: 'Approved', PROCESSED: 'Processed', REJECTED: 'Rejected', SCHEDULED: 'Scheduled', PICKED_UP: 'Picked up', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered', FAILED: 'Failed' };
    return labels[value] || String(value || '').replaceAll('_', ' ').toLowerCase();
}
export function hasRole(user, allowed) {
    return (user?.roles || [user?.role]).some((role) => allowed.includes(role));
}
export function requestMessage(error, fallback = 'Unable to complete this action. Please try again.') {
    if (error.response?.status === 401) return 'Your sign-in is no longer valid. Please sign out and sign in again.';
    if (error.response?.status === 403) return 'Your account does not have permission for this action.';
    return error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The request timed out. Refresh to check whether it completed before retrying.' : fallback);
}
export function localDateTime(value = new Date()) {
    const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export default api;
