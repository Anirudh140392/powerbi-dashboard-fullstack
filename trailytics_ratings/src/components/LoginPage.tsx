/**
 * LoginPage — Premium login screen for Rating Intelligence.
 *
 * State machine:
 *   password → (verify | enrol → backup) → done
 *
 * Glassmorphism preserved across every step; only the card body swaps.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GlobalLoader } from './GlobalLoader';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [error, setError] = useState('');
    const hasAttemptedAutoLogin = useRef(false);

    useEffect(() => {
        if (hasAttemptedAutoLogin.current) return;
        const params = new URLSearchParams(window.location.search);
        const autoEmail = params.get('autoLoginEmail');
        const autoPassword = params.get('autoLoginPassword');
        
        if (autoEmail && autoPassword) {
            hasAttemptedAutoLogin.current = true;
            
            // Clean up the URL to not leak credentials or retry if user reloads
            params.delete('autoLoginEmail');
            params.delete('autoLoginPassword');
            const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.replaceState(null, '', newUrl);

            performLogin(autoEmail, autoPassword);
        } else {
            setError('Please login via Digital Shelf.');
        }
    }, [login]);

    const performLogin = async (user: string, pass: string) => {
        setError('');
        const result = await login(user, pass);
        if (result.status === 'error') {
            setError(result.error || 'Authentication failed');
        }
        // If success, AuthContext sets the user and App routes to the dashboard
    };

    return (
        <>
            <GlobalLoader />
            {error && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-600 px-4 py-2 rounded-lg text-sm shadow-lg z-50">
                    Access Denied: {error}
                </div>
            )}
        </>
    );
};

export default LoginPage;
