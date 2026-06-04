import type { SampleStatus } from '../../types';

const statusConfig: Record<SampleStatus, { bg: string; text: string; dot: string }> = {
  'ONGOING': {
    bg: 'bg-warning-500/10',
    text: 'text-warning-600',
    dot: 'bg-warning-500',
  },
  'PENDING RELEASE': {
    bg: 'bg-primary-500/10',
    text: 'text-primary-600',
    dot: 'bg-primary-500',
  },
  'RELEASED': {
    bg: 'bg-success-500/10',
    text: 'text-success-600',
    dot: 'bg-success-500',
  },
  'COMPLETED': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  '': {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    dot: 'bg-gray-400',
  },
};

export default function StatusBadge({ status }: { status: SampleStatus | string }) {
  const config = statusConfig[status as SampleStatus] || { bg: 'bg-gray-500/10', text: 'text-gray-500', dot: 'bg-gray-500' };
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${config.bg} ${config.text}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
