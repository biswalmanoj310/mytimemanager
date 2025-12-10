import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface CustomDatePickerProps {
  selectedDate: Date | null;
  onChange: (date: Date | null) => void;
  dateFormat?: string;
  placeholderText?: string;
  minDate?: Date;
  maxDate?: Date;
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  selectedDate,
  onChange,
  dateFormat = 'MMM d, yyyy',
  placeholderText = 'Select date',
  minDate,
  maxDate,
  showIcon = true,
  className,
  style
}) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', ...style }}>
      {showIcon && <span style={{ fontSize: '16px' }}>📅</span>}
      <DatePicker
        selected={selectedDate}
        onChange={onChange}
        dateFormat={dateFormat}
        placeholderText={placeholderText}
        minDate={minDate}
        maxDate={maxDate}
        className={className}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        popperPlacement="bottom-start"
        customInput={
          <input
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        }
      />
    </div>
  );
};

export default CustomDatePicker;
