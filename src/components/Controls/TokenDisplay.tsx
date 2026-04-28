import React from 'react';
import { useConfigContext, useTokenContext } from '../../contexts';
import { formatTokenCount } from '../../utils';

const MODEL_LABELS: Record<string, string> = {
  'nano-banana': 'Nano Banana',
  'nano-banana-2': 'Nano Banana 2',
  'nano-banana-pro': 'Nano Banana Pro',
};

export const TokenDisplay: React.FC = () => {
  const { config } = useConfigContext();
  const { usage } = useTokenContext();
  const modelLabel = MODEL_LABELS[config.model] || config.model;

  return (
    <div className="bg-snow rounded-container px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-sans text-stone uppercase">This Run</span>
            <span className="text-lg font-display font-medium text-black">
              {formatTokenCount(usage.current)}
            </span>
          </div>
          <div className="w-px h-8 bg-light-gray" />
          <div className="flex flex-col">
            <span className="text-xs font-sans text-stone uppercase">Total</span>
            <span className="text-lg font-display font-medium text-mid-gray">
              {formatTokenCount(usage.total)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-sans text-stone uppercase">Model</span>
          <span className="text-sm font-sans text-near-black">{modelLabel}</span>
        </div>
      </div>
    </div>
  );
};
