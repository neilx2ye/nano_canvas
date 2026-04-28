import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && (
        <label className="text-sm font-sans font-normal text-stone whitespace-nowrap">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          flex-1 min-w-0 px-4 py-2 text-sm font-sans font-normal
          bg-white border border-light-gray rounded-pill
          text-near-black
          focus:outline-none focus:ring-2 focus:ring-blue-500/50
          cursor-pointer
        "
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
