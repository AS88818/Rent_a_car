import jsPDF from 'jspdf';
import { Booking, Vehicle, VehicleCategory } from '../types/database';
import { getMonthName, getCategoryColor, CalendarWeek } from './calendar-utils';

export interface PDFExportOptions {
  month: number;
  year: number;
  categories: VehicleCategory[];
  selectedCategories: string[];
  vehicles: Vehicle[];
  bookings: Booking[];
  calendarWeeks: CalendarWeek[];
  companyName?: string;
  branchName?: string;
}

export function exportCalendarToPDF(options: PDFExportOptions) {
  const {
    month,
    year,
    categories,
    selectedCategories,
    vehicles,
    bookings,
    calendarWeeks,
    companyName = 'RENT A CAR IN KENYA',
    branchName = ''
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(18);
  doc.text(companyName, margin, margin + 10);

  if (branchName) {
    doc.setFontSize(12);
    doc.text(branchName, margin, margin + 16);
  }

  doc.setFontSize(16);
  const monthYear = `${getMonthName(month)} ${year}`;
  const monthYearWidth = doc.getTextWidth(monthYear);
  doc.text(monthYear, pageWidth - margin - monthYearWidth, margin + 10);

  const exportDate = new Date().toLocaleDateString();
  doc.setFontSize(10);
  const exportDateText = `Exported: ${exportDate}`;
  const exportDateWidth = doc.getTextWidth(exportDateText);
  doc.text(exportDateText, pageWidth - margin - exportDateWidth, margin + 16);

  let yPos = margin + 25;

  doc.setFontSize(11);
  doc.text('Selected Categories:', margin, yPos);
  yPos += 5;

  const filteredCategories = categories.filter(c => selectedCategories.includes(c.id));
  filteredCategories.forEach((category, idx) => {
    const color = getCategoryColor(category.category_name, idx);
    const rgbColor = hexToRgb(getHexFromTailwind(color.dot));
    if (rgbColor) {
      doc.setFillColor(rgbColor.r, rgbColor.g, rgbColor.b);
      doc.circle(margin + 2, yPos - 1, 1.5, 'F');
    }

    doc.setFontSize(10);
    doc.text(category.category_name, margin + 6, yPos);
    yPos += 5;
  });

  yPos += 3;

  const cellWidth = contentWidth / 7;
  const cellHeight = (pageHeight - yPos - margin - 20) / calendarWeeks.length;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, contentWidth, 8, 'F');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  dayNames.forEach((day, i) => {
    const x = margin + (i * cellWidth) + (cellWidth / 2);
    doc.text(day, x, yPos + 5, { align: 'center' });
  });
  doc.setFont(undefined, 'normal');

  yPos += 8;

  const startY = yPos;

  calendarWeeks.forEach((week, weekIdx) => {
    const rowY = startY + (weekIdx * cellHeight);

    week.days.forEach((day, dayIdx) => {
      const x = margin + (dayIdx * cellWidth);

      doc.setDrawColor(200, 200, 200);
      doc.rect(x, rowY, cellWidth, cellHeight);

      if (!day.isCurrentMonth) {
        doc.setFillColor(250, 250, 250);
        doc.rect(x, rowY, cellWidth, cellHeight, 'F');
      }

      doc.setFontSize(9);
      doc.setFont(undefined, day.isToday ? 'bold' : 'normal');
      const textColor = day.isToday ? [0, 0, 255] : day.isCurrentMonth ? [0, 0, 0] : [150, 150, 150];
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(String(day.dayOfMonth), x + 2, rowY + 4);

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      if (day.isCurrentMonth) {
        const dayBookings = getBookingsForDay(day, bookings, vehicles, selectedCategories);

        let bookingY = rowY + 8;
        const maxBookings = Math.floor((cellHeight - 10) / 5);
        const visibleBookings = dayBookings.slice(0, maxBookings);

        visibleBookings.forEach(booking => {
          const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
          const category = categories.find(c => c.id === vehicle?.category_id);
          const categoryIdx = categories.findIndex(c => c.id === vehicle?.category_id);
          const color = getCategoryColor(category?.category_name || '', categoryIdx);

          const rgbColor = hexToRgb(getHexFromTailwind(color.bg));
          if (rgbColor) {
            doc.setFillColor(rgbColor.r, rgbColor.g, rgbColor.b);
            doc.rect(x + 1, bookingY - 3, cellWidth - 2, 4, 'F');
          }

          const borderColor = hexToRgb(getHexFromTailwind(color.border));
          if (borderColor) {
            doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
            doc.setLineWidth(0.5);
            doc.line(x + 1, bookingY - 3, x + 1, bookingY + 1);
          }

          doc.setFontSize(7);
          const regNumber = vehicle?.reg_number || '';
          doc.text(regNumber, x + 2, bookingY, { maxWidth: cellWidth - 3 });

          bookingY += 5;
        });

        if (dayBookings.length > maxBookings) {
          doc.setFontSize(6);
          doc.setTextColor(100, 100, 100);
          doc.text(`+${dayBookings.length - maxBookings} more`, x + 2, bookingY);
          doc.setTextColor(0, 0, 0);
        }
      }
    });
  });

  yPos = startY + (calendarWeeks.length * cellHeight) + 5;

  doc.setFontSize(9);
  doc.text('Legend:', margin, yPos);
  yPos += 5;

  const legendCols = 4;
  const legendColWidth = contentWidth / legendCols;
  let legendIdx = 0;

  filteredCategories.forEach((category, idx) => {
    const col = legendIdx % legendCols;
    const row = Math.floor(legendIdx / legendCols);
    const x = margin + (col * legendColWidth);
    const y = yPos + (row * 5);

    const color = getCategoryColor(category.category_name, idx);
    const rgbColor = hexToRgb(getHexFromTailwind(color.dot));
    if (rgbColor) {
      doc.setFillColor(rgbColor.r, rgbColor.g, rgbColor.b);
      doc.rect(x, y - 2.5, 3, 3, 'F');
    }

    doc.setFontSize(8);
    doc.text(category.category_name, x + 5, y);
    legendIdx++;
  });

  const fileName = `calendar-${getMonthName(month)}-${year}.pdf`;
  doc.save(fileName);
}

function getBookingsForDay(
  day: { dateString: string; isCurrentMonth: boolean },
  bookings: Booking[],
  vehicles: Vehicle[],
  selectedCategories: string[]
) {
  if (!day.isCurrentMonth) return [];

  return bookings.filter(b => {
    if (b.status === 'Cancelled') return false;

    const vehicle = vehicles.find(v => v.id === b.vehicle_id);
    if (!vehicle || !selectedCategories.includes(vehicle.category_id)) return false;

    const startDate = new Date(b.start_datetime).toISOString().split('T')[0];
    const endDate = new Date(b.end_datetime).toISOString().split('T')[0];

    return day.dateString >= startDate && day.dateString <= endDate;
  });
}

function getHexFromTailwind(className: string): string {
  const colorMap: { [key: string]: string } = {
    'bg-blue-100': '#dbeafe',
    'bg-blue-500': '#3b82f6',
    'bg-green-100': '#dcfce7',
    'bg-green-500': '#22c55e',
    'bg-amber-100': '#fef3c7',
    'bg-amber-500': '#f59e0b',
    'bg-rose-100': '#ffe4e6',
    'bg-rose-500': '#f43f5e',
    'bg-cyan-100': '#cffafe',
    'bg-cyan-500': '#06b6d4',
    'bg-orange-100': '#ffedd5',
    'bg-orange-500': '#f97316',
    'bg-teal-100': '#ccfbf1',
    'bg-teal-500': '#14b8a6',
    'bg-pink-100': '#fce7f3',
    'bg-pink-500': '#ec4899',
    'bg-lime-100': '#ecfccb',
    'bg-lime-500': '#84cc16',
    'bg-sky-100': '#e0f2fe',
    'bg-sky-500': '#0ea5e9',
    'bg-violet-100': '#ede9fe',
    'bg-violet-500': '#8b5cf6',
    'bg-fuchsia-100': '#fae8ff',
    'bg-fuchsia-500': '#d946ef',
    'bg-emerald-100': '#d1fae5',
    'bg-emerald-500': '#10b981',
    'bg-slate-100': '#f1f5f9',
    'bg-slate-500': '#64748b',
    'bg-red-100': '#fee2e2',
    'bg-red-500': '#ef4444',
    'bg-yellow-100': '#fef9c3',
    'bg-yellow-500': '#eab308',
    'border-blue-500': '#3b82f6',
    'border-green-500': '#22c55e',
    'border-amber-500': '#f59e0b',
    'border-rose-500': '#f43f5e',
    'border-cyan-500': '#06b6d4',
    'border-orange-500': '#f97316',
    'border-teal-500': '#14b8a6',
    'border-pink-500': '#ec4899',
    'border-lime-500': '#84cc16',
    'border-sky-500': '#0ea5e9',
    'border-violet-500': '#8b5cf6',
    'border-fuchsia-500': '#d946ef',
    'border-emerald-500': '#10b981',
    'border-slate-500': '#64748b',
    'border-red-500': '#ef4444',
    'border-yellow-500': '#eab308'
  };

  return colorMap[className] || '#000000';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}
