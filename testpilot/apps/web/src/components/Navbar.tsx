import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLink = (to: string, label: string) => {
    const active = pathname === to || (to === '/dashboard' && pathname.startsWith('/runs'));
    return (
      <Link
        to={to}
        className={`text-sm transition-colors ${
          active ? 'text-zinc-50 font-medium' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="border-b border-white/[0.06] bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <span className="text-zinc-950 text-xs font-black">T</span>
          </div>
          <span className="text-sm font-semibold text-zinc-100">TestPilot</span>
        </Link>

        <div className="flex items-center gap-6">
          {navLink('/', 'Home')}
          {user && navLink('/dashboard', 'Runs')}

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-white/[0.08]">
              <span className="text-xs text-zinc-500 max-w-[140px] truncate">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
