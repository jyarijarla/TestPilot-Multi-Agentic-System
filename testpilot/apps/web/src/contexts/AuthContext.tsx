import { createContext, useContext, useEffect, useState } from 'react';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try { setUser(JSON.parse(stored) as AuthUser); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { token?: string; user?: AuthUser; error?: string };
    if (!res.ok) return { error: data.error ?? 'Login failed' };
    localStorage.setItem('token', data.token!);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user!);
    return { error: null };
  };

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { token?: string; user?: AuthUser; error?: string };
    if (!res.ok) return { error: data.error ?? 'Registration failed' };
    localStorage.setItem('token', data.token!);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user!);
    return { error: null };
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
