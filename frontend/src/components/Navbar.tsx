import { Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/upload', label: 'Upload' },
  { path: '/clean', label: 'Clean' },
  { path: '/overview', label: 'Overview' },
  { path: '/eda', label: 'EDA' },
  { path: '/correlation', label: 'Correlation' },
  { path: '/hypothesis', label: 'Hypothesis' },
  { path: '/anomaly', label: 'Anomaly' },
  { path: '/investigate', label: 'Investigate' },
  { path: '/profile', label: 'Profile' },
  { path: '/report', label: 'Report' },
];

export default function Navbar() {
  const { session } = useSession();
  const location = useLocation();
  const hasSession = !!session.sessionId;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1e3a5f] bg-[#060b14]/95 backdrop-blur-md">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff20] to-[#00ff8820] border border-[#00d4ff40] flex items-center justify-center group-hover:border-[#00d4ff] transition-all">
            <Shield className="w-4 h-4 text-[#00d4ff]" />
          </div>
          <span className="font-bold text-white tracking-wider text-sm">
            CYBER<span className="text-[#00d4ff]">SHIELD</span>
          </span>
        </Link>

        {/* Nav items */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            const disabled = item.path !== '/' && item.path !== '/upload' && !hasSession;
            return (
              <Link
                key={item.path}
                to={disabled ? '#' : item.path}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                  active
                    ? 'bg-[#00d4ff15] text-[#00d4ff] border border-[#00d4ff30]'
                    : disabled
                    ? 'text-[#334155] cursor-not-allowed'
                    : 'text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#111d30]'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Status indicator */}
        {hasSession && (
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] pulse-dot" />
            <span className="hidden md:block max-w-32 truncate">{session.filename}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
