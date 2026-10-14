// Keeps track of who is logged in and shares it with every page through useAuth().
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, getToken, request, saveToken, type AuthResponse, type User } from '../lib/api';

interface AuthState {
  user: User | null;
  checking: boolean; // true while we check a saved token on page load
  signup(name: string, email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(getToken() !== null);

  // On page load: if a token was saved earlier, ask the server who it belongs to.
  useEffect(() => {
    if (!getToken()) return;
    request<{ user: User }>('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => clearToken()) // expired or invalid token
      .finally(() => setChecking(false));
  }, []);

  function finishLogin(data: AuthResponse) {
    saveToken(data.token);
    setUser(data.user);
  }

  const value: AuthState = {
    user,
    checking,
    async signup(name, email, password) {
      finishLogin(await request<AuthResponse>('/api/auth/signup', 'POST', { name, email, password }));
    },
    async login(email, password) {
      finishLogin(await request<AuthResponse>('/api/auth/login', 'POST', { email, password }));
    },
    logout() {
      clearToken();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
