import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from 'date-fns';

export function getWeekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 0 }); // Sunday
}

export function getWeekEnd(date = new Date()) {
  return endOfWeek(date, { weekStartsOn: 0 }); // Saturday
}

export function formatWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = addWeeks(start, 1);
  end.setDate(end.getDate() - 1); // Saturday (end of Sun–Sat week)
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

// All Sunday-Saturday weeks that overlap with the given year
export function weekOptionsForYear(year) {
  const options = [];
  const janFirst = new Date(year, 0, 1);
  const decLast  = new Date(year, 11, 31);

  // Find Sunday on or before Jan 1
  let sunday = new Date(janFirst);
  sunday.setDate(sunday.getDate() - sunday.getDay());

  while (sunday <= decLast) {
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() + 6);
    const dateStr = format(sunday, 'yyyy-MM-dd');
    options.push({ value: dateStr, label: formatWeekLabel(dateStr) });
    sunday = new Date(sunday);
    sunday.setDate(sunday.getDate() + 7);
  }
  return options;
}

// All 12 months for a given year
export function monthOptionsForYear(year) {
  return Array.from({ length: 12 }, (_, i) => {
    const d     = new Date(year, i, 1);
    const value = `${year}-${String(i + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });
}
