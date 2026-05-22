export default function StatusBadge({ status }) {
  const map = {
    'Completed': 'status-completed',
    'In Progress': 'status-in-progress',
    'Not Started': 'status-not-started',
    'Blocked': 'status-blocked',
  };
  return <span className={map[status] || 'status-not-started'}>{status}</span>;
}
