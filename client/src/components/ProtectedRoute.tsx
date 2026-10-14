// Wrap a page in this to make it logged-in only. Logged-out visitors go to /login.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  if (checking) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
