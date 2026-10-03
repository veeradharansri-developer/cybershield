import clsx from 'clsx';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'cyan' | 'green' | 'red' | 'amber' | 'default';
  icon?: ReactNode;
}

const colorMap = {
  cyan: 'text-[#00d4ff]',
  green: 'text-[#00ff88]',
  red: 'text-[#ff4444]',
  amber: 'text-[#f59e0b]',
  default: 'text-white',
};

export function StatCard({ label, value, sub, color = 'default', icon }: StatCardProps) {
  return (
    <div className="cyber-card p-5 flex flex-col gap-1 fade-in">
      <div className="flex items-start justify-between">
        <span className="text-xs text-[#64748b] uppercase tracking-wider">{label}</span>
        {icon && <div className="text-[#64748b]">{icon}</div>}
      </div>
      <span className={clsx('text-3xl font-bold', colorMap[color])}>{value}</span>
      {sub && <span className="text-xs text-[#64748b]">{sub}</span>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <div className="mb-8 fade-in">
      {badge && (
        <span className="badge-info text-xs px-2 py-0.5 rounded-full font-mono mb-2 inline-block">
          {badge}
        </span>
      )}
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-[#64748b] mt-1 text-sm">{subtitle}</p>}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Section({ title, children, className }: SectionProps) {
  return (
    <div className={clsx('cyber-card p-6', className)}>
      <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-[#1e3a5f] border-t-[#00d4ff] rounded-full animate-spin" />
    </div>
  );
}

interface AlertProps {
  type: 'info' | 'warning' | 'error' | 'success';
  children: ReactNode;
}

export function Alert({ type, children }: AlertProps) {
  const styles = {
    info: 'bg-[#00d4ff10] border-[#00d4ff30] text-[#00d4ff]',
    warning: 'bg-[#f59e0b10] border-[#f59e0b30] text-[#f59e0b]',
    error: 'bg-[#ff444410] border-[#ff444430] text-[#ff4444]',
    success: 'bg-[#00ff8810] border-[#00ff8830] text-[#00ff88]',
  };
  return (
    <div className={clsx('border rounded-lg p-3 text-sm', styles[type])}>
      {children}
    </div>
  );
}

interface BadgeProps {
  variant: 'anomaly' | 'normal' | 'info';
  children: ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', `badge-${variant}`)}>
      {children}
    </span>
  );
}
