// The shared frame around logged-in pages: the Splitly header with a log out button.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold">
          💸 Splitly
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{user?.name}</span>
          <button onClick={logout} className="hover:text-slate-900">
            Log out
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}
