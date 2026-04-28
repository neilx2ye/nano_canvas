import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  return (
    <div
      className={`${sizeMap[size]} border-2 border-current border-t-transparent rounded-full animate-spin`}
    />
  );
};
