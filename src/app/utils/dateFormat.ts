import { DateFormat } from '../types';

export function formatDate(dateStr: string | undefined, format: DateFormat): string {
  if (!dateStr) return '';

  // Parse common date formats (YYYY, YYYY-MM-DD, DD.MM.YYYY, etc.)
  let year = '', month = '', day = '';

  if (/^\d{4}$/.test(dateStr)) {
    // Just year
    year = dateStr;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // YYYY-MM-DD
    [year, month, day] = dateStr.split('-');
  } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    // DD.MM.YYYY
    [day, month, year] = dateStr.split('.');
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    // MM/DD/YYYY
    [month, day, year] = dateStr.split('/');
  } else {
    // Return as-is if format not recognized
    return dateStr;
  }


  // If only year, return year
  if (!day && !month) {
    return year;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = month ? monthNames[parseInt(month) - 1] : '';

  switch (format) {
    case 'DD.MM.YYYY':
      return [day, month, year].filter(Boolean).join('.');
    case 'MM/DD/YYYY':
      return [month, day, year].filter(Boolean).join('/');
    case 'YYYY-MM-DD':
      return [year, month, day].filter(Boolean).join('-');
    case 'DD MMM YYYY':
      return [day, monthName, year].filter(Boolean).join(' ');
    default:
      return dateStr;
  }
}

