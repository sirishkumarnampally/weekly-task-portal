import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from 'date-fns';

export function getWeekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

export function getWeekEnd(date = new Date()) {
  return endOfWeek(date, { weekStartsOn: 1 }); // Sunday
}

export function formatWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = addWeeks(start, 1);
  end.setDate(end.getDate() - 2); // Friday
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function currentWeekStart() {
  return format(getWeekStart(), 'yyyy-MM-dd');
}

export function weekOptions(count = 8) {
  const options = [];
  let d = getWeekStart();
  for (let i = 0; i < count; i++) {
    const dateStr = format(d, 'yyyy-MM-dd');
    options.push({ value: dateStr, label: formatWeekLabel(dateStr) });
    d = subWeeks(d, 1);
  }
  return options;
}
