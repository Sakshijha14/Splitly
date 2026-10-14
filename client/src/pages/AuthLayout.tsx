// The shared frame around the Login and Signup forms.
import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">💸 Splitly</h1>
        <p className="mb-8 mt-1 text-slate-500">Split expenses with friends. Settle up in fewer payments.</p>
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </main>
  );
}
