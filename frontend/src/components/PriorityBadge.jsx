export default function PriorityBadge({ priority }) {
  const cls = {
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  }[priority] || 'badge-medium';
  return <span className={cls}>{priority}</span>;
}
