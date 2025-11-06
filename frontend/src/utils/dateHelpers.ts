/**
 * Date Utility Functions
 * Extracted from Tasks.tsx during refactoring
 * 
 * These functions provide consistent date formatting and comparisons
 * across all time-tracking features (Daily, Weekly, Monthly, Yearly)
 */

/**
 * Format a Date object for HTML input[type="date"] value
 * @param date - Date to format
 * @returns String in 'YYYY-MM-DD' format
 * @example formatDateForInput(new Date('2025-11-05')) // '2025-11-05'
 */
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date is today
 * @param date - Date to check
 * @returns true if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

/**
 * Check if a date is in the future (after today)
 * @param date - Date to check
 * @returns true if date is in the future
 */
export const isFutureDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
};

/**
 * Get the Monday of the week containing the given date
 * @param date - Any date in the desired week
 * @returns Date object set to Monday of that week
 * @example getWeekStart(new Date('2025-11-05')) // Monday of that week
 */
export const getWeekStart = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get the first day of the month containing the given date
 * @param date - Any date in the desired month
 * @returns Date object set to the 1st of that month
 */
export const getMonthStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Get the first day of the year containing the given date
 * @param date - Any date in the desired year
 * @returns Date object set to January 1st of that year
 */
export const getYearStart = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1); // Month 0 = January
};

/**
 * Get the number of days in a specific month
 * @param year - Year
 * @param month - Month (0-11, where 0=January)
 * @returns Number of days (28-31)
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Add months to a date
 * @param date - Starting date
 * @param months - Number of months to add (can be negative)
 * @returns New Date object
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Add years to a date
 * @param date - Starting date
 * @param years - Number of years to add (can be negative)
 * @returns New Date object
 */
export const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

/**
 * Format date for display (e.g., "Nov 5, 2025")
 * @param date - Date to format
 * @returns Formatted string
 */
export const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format date range for display (e.g., "Nov 4 - Nov 10, 2025")
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns Formatted string
 */
export const formatDateRange = (startDate: Date, endDate: Date): string => {
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`;
  } else if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${startDate.getFullYear()}`;
  } else {
    return `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
  }
};

/**
 * Get array of dates for a week (7 days starting from Monday)
 * @param weekStart - Monday of the week
 * @returns Array of 7 Date objects
 */
export const getWeekDays = (weekStart: Date): Date[] => {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
};

/**
 * Get day name for a date
 * @param date - Date
 * @returns Day name (e.g., "Monday")
 */
export const getDayName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

/**
 * Get short day name for a date
 * @param date - Date
 * @returns Short day name (e.g., "Mon")
 */
export const getShortDayName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

/**
 * Get month name
 * @param monthIndex - Month index (0-11)
 * @returns Month name (e.g., "January")
 */
export const getMonthName = (monthIndex: number): string => {
  return new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' });
};

/**
 * Get short month name
 * @param monthIndex - Month index (0-11)
 * @returns Short month name (e.g., "Jan")
 */
export const getShortMonthName = (monthIndex: number): string => {
  return new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
};

/**
 * Check if two dates are the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Parse date string to Date object (handles YYYY-MM-DD format)
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object or null if invalid
 */
export const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  return isNaN(date.getTime()) ? null : date;
};
