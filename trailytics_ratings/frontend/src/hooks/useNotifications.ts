/**
 * Notifications hook — polls /api/notifications every 60s and exposes a
 * markRead / markAllRead / dismiss API. Only fetches when the user is
 * authenticated; goes quiet on the login screen.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '../types/automation';
import { authenticatedFetch } from '../utils/auth';

const API_BASE = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';
const POLL_MS = 60_000;

interface State {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
}

export function useNotifications(enabled: boolean) {
    const [state, setState] = useState<State>({ notifications: [], unreadCount: 0, loading: true });
    const lastFetchRef = useRef(0);

    const fetchNow = useCallback(async () => {
        if (!enabled) return;
        // Throttle: don't fetch more than once per 5s even if multiple callers ask.
        if (Date.now() - lastFetchRef.current < 5000 && state.notifications.length > 0) return;
        lastFetchRef.current = Date.now();
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/notifications?limit=20`);
            if (!r.ok) return;
            const payload = await r.json();
            setState({
                notifications: payload.notifications || [],
                unreadCount: payload.unreadCount || 0,
                loading: false,
            });
        } catch {
            setState((s) => ({ ...s, loading: false }));
        }
    }, [enabled, state.notifications.length]);

    useEffect(() => {
        if (!enabled) { setState({ notifications: [], unreadCount: 0, loading: false }); return; }
        fetchNow();
        const id = setInterval(fetchNow, POLL_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    const markRead = useCallback(async (id: string) => {
        // Optimistic flip
        setState((s) => ({
            ...s,
            notifications: s.notifications.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n),
            unreadCount: Math.max(0, s.unreadCount - 1),
        }));
        await authenticatedFetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' });
    }, []);

    const markAllRead = useCallback(async () => {
        setState((s) => ({
            ...s,
            notifications: s.notifications.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }),
            unreadCount: 0,
        }));
        await authenticatedFetch(`${API_BASE}/api/notifications/mark-all-read`, { method: 'POST' });
    }, []);

    const dismiss = useCallback(async (id: string) => {
        setState((s) => ({
            ...s,
            notifications: s.notifications.filter(n => n.id !== id),
        }));
        await authenticatedFetch(`${API_BASE}/api/notifications/${id}/dismiss`, { method: 'POST' });
    }, []);

    return { ...state, markRead, markAllRead, dismiss, refresh: fetchNow };
}
