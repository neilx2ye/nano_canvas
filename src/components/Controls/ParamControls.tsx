import React from 'react';
import { useConfigContext } from '../../contexts';
import { getModelSpec } from '../../constants/geminiImageModels';
import type { ThinkingLevel } from '../../types';

type ConfigurableThinkingLevel = Exclude<ThinkingLevel, 'off'>;

export const ParamControls: React.FC = () => {
  const { config, updateConfig } = useConfigContext();
  const spec = getModelSpec(config.model);

  return (
    <div className="flex flex-col gap-4">
      {spec.thinkingMode === 'configurable' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-sans font-normal text-stone">
            Thinking Level
            <span className="ml-2 text-xs text-silver">(Gemini 3.1 Flash)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {spec.thinkingLevels.map((level: ConfigurableThinkingLevel) => (
              <button
                key={level}
                onClick={() => updateConfig({ thinkingLevel: level })}
                className={`
                  h-9 px-3 text-sm font-sans font-normal rounded-container
                  border transition-colors text-left
                  ${(config.thinkingLevel || 'low') === level
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-near-black border-border-light hover:border-light-gray'
                  }
                `}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {spec.thinkingMode === 'always' && (
        <div className="px-3 py-2 rounded-container border border-border-light bg-white">
          <div className="text-sm font-sans text-stone">Thinking is always on.</div>
          <div className="text-xs font-sans text-silver mt-1">No off mode is sent for Pro.</div>
        </div>
      )}

      {spec.thinkingMode === 'unsupported' && (
        <div className="px-3 py-2 rounded-container border border-border-light bg-white">
          <div className="text-sm font-sans text-stone">Thinking config is not supported.</div>
          <div className="text-xs font-sans text-silver mt-1">Requests omit thinkingConfig.</div>
        </div>
      )}

      {spec.supportsMask && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border-light">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.maskMode || false}
              onChange={(e) => updateConfig({ maskMode: e.target.checked })}
              className="w-4 h-4 rounded border-border-light text-black focus:ring-black"
            />
            <span className="text-sm font-sans font-normal text-stone">Mask Mode</span>
          </label>
          <span className="text-xs font-sans text-silver">
            Nano Banana only: draw a mask and ask AI to make a cutout.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1 pt-2 border-t border-border-light">
        {spec.requestNotes.map((note) => (
          <div key={note} className="text-xs font-sans text-silver leading-relaxed">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
};
