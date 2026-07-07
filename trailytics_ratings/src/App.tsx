import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import LoginPage from './components/LoginPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import { MLControlCenter } from './pages/MLControlCenter'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function AppContent() {
  const { isAuthenticated, isLoading, ssoLogin } = useAuth();
  const [ssoAttempted, setSsoAttempted] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // ── SSO token exchange ──────────────────────────────────────────────────────
  // When this app is embedded in Digital Shelf, the DS frontend appends
  // ?ssoToken=<token> to the URL. We exchange it silently for a full ratings
  // session so the user never sees a login form.
  useEffect(() => {
    if (isLoading) return; // wait for the normal session refresh first

    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('ssoToken');

    if (!ssoToken || isAuthenticated) {
      setSsoAttempted(true);
      return;
    }

    // Strip the token from the URL immediately (before any redirect)
    params.delete('ssoToken');
    const newSearch = params.toString();
    window.history.replaceState(null, '', newSearch ? `?${newSearch}` : window.location.pathname);

    ssoLogin(ssoToken).then((result) => {
      if (!result.ok) {
        setSsoError(result.error);
      }
      setSsoAttempted(true);
    });
  }, [isLoading, isAuthenticated, ssoLogin]);

  // ── Public routes ───────────────────────────────────────────────────────────
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  // ── Loading states ──────────────────────────────────────────────────────────
  if (isLoading || (!ssoAttempted && new URLSearchParams(window.location.search).has('ssoToken'))) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {ssoError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-xl">
            SSO error: {ssoError}. Please log in manually.
          </div>
        )}
        <LoginPage />
      </>
    );
  }

  // ── Hidden admin route ──────────────────────────────────────────────────────
  if (window.location.pathname === '/ml-control') {
    return <MLControlCenter />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
