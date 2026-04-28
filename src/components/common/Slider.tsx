import React from 'react';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayValue?: string;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className={`text-sm font-sans font-normal whitespace-nowrap min-w-[80px] ${disabled ? 'text-silver' : 'text-stone'}`}>
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`flex-1 h-2 bg-light-gray rounded-pill appearance-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      <span className="text-sm font-sans font-normal text-mid-gray min-w-[50px] text-right">
        {displayValue || value}
      </span>
    </div>
  );
};
