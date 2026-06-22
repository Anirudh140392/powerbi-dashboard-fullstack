import { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import LoginPage from './components/LoginPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import { MLControlCenter } from './pages/MLControlCenter'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Legacy /settings URL → redirect into the new Rules tab so existing
  // bookmarks and email deep-links don't 404 after Phase 1 nav restructure.
  useEffect(() => {
    if (isAuthenticated && window.location.pathname === '/settings') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'rules');
      window.history.replaceState(null, '', `/?${params.toString()}`);
    }
  }, [isAuthenticated]);

  // Public route — reachable without authentication. Lands here from the
  // password-reset email link.
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          Loading Session..
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  // Hidden admin route interceptors
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
