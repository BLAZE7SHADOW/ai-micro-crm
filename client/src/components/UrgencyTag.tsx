import { Tag } from 'antd';
import type { Urgency } from '../types';

// Single source of truth for the urgency -> presentation mapping.
const CONFIG: Record<Urgency, { color: string; label: string }> = {
  high: { color: 'red', label: 'Needs attention' },
  medium: { color: 'orange', label: 'Worth a look' },
  low: { color: 'default', label: 'Low priority' },
  none: { color: 'default', label: 'All good' },
};

export const URGENCY_ORDER: Urgency[] = ['high', 'medium', 'low', 'none'];

export function UrgencyTag({ urgency }: { urgency: Urgency }) {
  const { color, label } = CONFIG[urgency];
  return <Tag className="urgency-tag" color={color}>{label}</Tag>;
}
