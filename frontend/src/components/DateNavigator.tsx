/**
 * Date Navigator Component
 * 
 * Provides navigation controls for dates/weeks/months/years.
 * Used by Daily, Weekly, Monthly, and Yearly tabs.
 * 
 * Features:
 * - Previous/Next navigation buttons
 * - "Today" quick navigation
 * - Current period display
 * - Date picker integration
 */

import React from 'react';
import {
  formatDateForInput,
  formatDateDisplay,
  getWeekStart,
  getMonthStart,
  getYearStart,
  addDays,
  addMonths,
  addYears,
  isToday,
  getDayName,
  getMonthName,
} from '../utils/dateHelpers';

export type NavigationType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface DateNavigatorProps {
  /** Current selected date */
  selectedDate: Date;
  
  /** Callback when date changes */
  onDateChange: (date: Date) => void;
  
  /** Type of navigation (daily, weekly, monthly, yearly) */
  navigationType: NavigationType;
  
  /** Optional CSS classes */
  className?: string;
  
  /** Show date picker input */
  showDatePicker?: boolean;
}

/**
 * Date Navigator Component
 * Provides Previous/Next/Today navigation for different time periods
 */
const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  onDateChange,
  navigationType,
  className = '',
  showDatePicker = true,
}) => {
  /**
   * Get the start date for the current period
   */
  const getPeriodStart = (date: Date): Date => {
    switch (navigationType) {
      case 'weekly':
        return getWeekStart(date);
      case 'monthly':
        return getMonthStart(date);
      case 'yearly':
        return getYearStart(date);
      default:
        return date;
    }
  };

  /**
   * Navigate to previous period
   */
  const handlePrevious = () => {
    let newDate: Date;
    switch (navigationType) {
      case 'daily':
        newDate = addDays(selectedDate, -1);
        break;
      case 'weekly':
        newDate = addDays(selectedDate, -7);
        break;
      case 'monthly':
        newDate = addMonths(selectedDate, -1);
        break;
      case 'yearly':
        newDate = addYears(selectedDate, -1);
        break;
      default:
        newDate = selectedDate;
    }
    onDateChange(newDate);
  };

  /**
   * Navigate to next period
   */
  const handleNext = () => {
    let newDate: Date;
    switch (navigationType) {
      case 'daily':
        newDate = addDays(selectedDate, 1);
        break;
      case 'weekly':
        newDate = addDays(selectedDate, 7);
        break;
      case 'monthly':
        newDate = addMonths(selectedDate, 1);
        break;
      case 'yearly':
        newDate = addYears(selectedDate, 1);
        break;
      default:
        newDate = selectedDate;
    }
    onDateChange(newDate);
  };

  /**
   * Navigate to today
   */
  const handleToday = () => {
    onDateChange(new Date());
  };

  /**
   * Handle date picker change
   */
  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      onDateChange(newDate);
    }
  };

  /**
   * Get display text for current period
   */
  const getDisplayText = (): string => {
    switch (navigationType) {
      case 'daily':
        return formatDateDisplay(selectedDate);
      case 'weekly': {
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = addDays(weekStart, 6);
        return `${formatDateDisplay(weekStart)} - ${formatDateDisplay(weekEnd)}`;
      }
      case 'monthly':
        return `${getMonthName(selectedDate.getMonth())} ${selectedDate.getFullYear()}`;
      case 'yearly':
        return `${selectedDate.getFullYear()}`;
      default:
        return formatDateDisplay(selectedDate);
    }
  };

  /**
   * Check if "Today" button should be shown
   */
  const shouldShowTodayButton = (): boolean => {
    const today = new Date();
    switch (navigationType) {
      case 'daily':
        return !isToday(selectedDate);
      case 'weekly': {
        const currentWeekStart = getWeekStart(today);
        const selectedWeekStart = getWeekStart(selectedDate);
        return currentWeekStart.getTime() !== selectedWeekStart.getTime();
      }
      case 'monthly': {
        const currentMonth = getMonthStart(today);
        const selectedMonth = getMonthStart(selectedDate);
        return currentMonth.getTime() !== selectedMonth.getTime();
      }
      case 'yearly':
        return today.getFullYear() !== selectedDate.getFullYear();
      default:
        return false;
    }
  };

  return (
    <div className={`date-navigator ${className}`}>
      <div className="date-nav-controls">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className="btn btn-sm btn-outline-secondary"
          title={`Previous ${navigationType}`}
        >
          <i className="fas fa-chevron-left"></i>
          <span className="ms-1">Previous</span>
        </button>

        {/* Current Period Display */}
        <div className="date-display">
          <span className="current-period">{getDisplayText()}</span>
          {navigationType === 'daily' && (
            <span className="day-name ms-2 text-muted">
              ({getDayName(selectedDate)})
            </span>
          )}
        </div>

        {/* Today Button */}
        {shouldShowTodayButton() && (
          <button
            onClick={handleToday}
            className="btn btn-sm btn-primary"
            title="Go to today"
          >
            <i className="fas fa-calendar-day"></i>
            <span className="ms-1">Today</span>
          </button>
        )}

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="btn btn-sm btn-outline-secondary"
          title={`Next ${navigationType}`}
        >
          <span className="me-1">Next</span>
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>

      {/* Date Picker (optional) */}
      {showDatePicker && (
        <div className="date-picker-container mt-2">
          <input
            type="date"
            value={formatDateForInput(getPeriodStart(selectedDate))}
            onChange={handleDatePickerChange}
            className="form-control form-control-sm"
            title="Select date"
          />
        </div>
      )}
    </div>
  );
};

export default DateNavigator;
