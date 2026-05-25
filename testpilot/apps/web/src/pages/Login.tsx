import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) { setError(error); setLoading(false); return; }
      navigate('/dashboard');
    } else {
      const { error } = await signUp(email, password);
      if (error) { setError(error); setLoading(false); return; }
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-zinc-50 mb-1">
          {mode === 'signin' ? 'Sign in' : 'Create an account'}
        </h1>
        <p className="text-sm text-zinc-500 mb-8">
          {mode === 'signin' ? 'Welcome back.' : 'Start using TestPilot.'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-surface border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-700 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-surface border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-700 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors mt-2"
          >
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-zinc-500 text-center mt-6">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            className="text-zinc-300 hover:text-zinc-50 transition-colors"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
