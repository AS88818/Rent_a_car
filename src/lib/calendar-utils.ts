export interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfMonth: number;
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export function getMonthCalendar(year: number, month: number): CalendarWeek[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const weeks: CalendarWeek[] = [];
  let currentDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (currentDate <= lastDay || weeks.length < 6) {
    const week: CalendarWeek = { days: [] };

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      const dateString = date.toISOString().split('T')[0];
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.getTime() === today.getTime();

      week.days.push({
        date,
        dateString,
        isCurrentMonth,
        isToday,
        dayOfMonth: date.getDate()
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    weeks.push(week);

    if (weeks.length === 6 || (currentDate > lastDay && currentDate.getDay() === 0)) {
      break;
    }
  }

  return weeks;
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
}

export function getDateRangeForPeriod(period: string): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      return { start: new Date(today), end: new Date(today) };

    case 'this_week': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }

    case 'next_week': {
      const start = new Date(today);
      start.setDate(start.getDate() + (7 - start.getDay()));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }

    case 'next_2_weeks': {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 13);
      return { start, end };
    }

    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end };
    }

    case 'next_month': {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { start, end };
    }

    default:
      return { start: today, end: today };
  }
}

export function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const dateTime = date.getTime();
  return dateTime >= start.getTime() && dateTime <= end.getTime();
}

export function getCategoryColor(categoryName: string, index: number): string {
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900', dot: 'bg-blue-500' },
    { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900', dot: 'bg-green-500' },
    { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900', dot: 'bg-amber-500' },
    { bg: 'bg-rose-100', border: 'border-rose-500', text: 'text-rose-900', dot: 'bg-rose-500' },
    { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-900', dot: 'bg-cyan-500' },
    { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900', dot: 'bg-orange-500' },
    { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900', dot: 'bg-teal-500' },
    { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900', dot: 'bg-pink-500' },
    { bg: 'bg-lime-100', border: 'border-lime-500', text: 'text-lime-900', dot: 'bg-lime-500' },
    { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-900', dot: 'bg-sky-500' },
    { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-900', dot: 'bg-violet-500' },
    { bg: 'bg-fuchsia-100', border: 'border-fuchsia-500', text: 'text-fuchsia-900', dot: 'bg-fuchsia-500' },
    { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-900', dot: 'bg-emerald-500' },
    { bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-900', dot: 'bg-slate-500' },
    { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900', dot: 'bg-red-500' },
    { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900', dot: 'bg-yellow-500' },
  ];

  return colors[index % colors.length];
}

export function getBookingStatusStyle(status: string): string {
  switch (status) {
    case 'Active':
      return 'border-solid';
    case 'Draft':
      return 'border-dashed';
    case 'Advance Payment Not Paid':
      return 'border-dotted';
    default:
      return 'border-solid';
  }
}
