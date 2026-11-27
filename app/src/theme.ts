export const C = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#EEF2FF',
  accent: '#14B8A6',
  accentLight: '#ECFDF5',
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E8EAF0',
  success: '#059669',
  successLight: '#ECFDF5',
  warn: '#D97706',
  warnLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  shadow: '#1E1B4B',
};

export const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', {
  minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
})}`;

export const timeAgo = (iso: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const durationLabel = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours % 24 === 0) return `${hours / 24} day${hours / 24 > 1 ? 's' : ''}`;
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

export const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: C.primary, bg: C.primaryLight },
  matched: { label: 'Matched', color: C.warn, bg: C.warnLight },
  cancelled: { label: 'Cancelled', color: C.muted, bg: '#F3F4F6' },
  accepted: { label: 'Awaiting payment', color: C.warn, bg: C.warnLight },
  active: { label: 'In use', color: C.accent, bg: C.accentLight },
  return_paid: { label: 'Awaiting return', color: C.primary, bg: C.primaryLight },
  completed: { label: 'Completed', color: C.success, bg: C.successLight },
  pending: { label: 'Pending', color: C.warn, bg: C.warnLight },
  declined: { label: 'Declined', color: C.faint, bg: '#F3F4F6' },
};
