import React from 'react';
import { useConfigContext } from '../../contexts';
import { MODEL_OPTIONS, getModelSpec } from '../../constants/geminiImageModels';

export const ModelSelector: React.FC = () => {
  const { config, updateConfig } = useConfigContext();
  const selectedSpec = getModelSpec(config.model);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-sans font-normal text-stone">Model</label>
      <div className="flex flex-col gap-2">
        {MODEL_OPTIONS.map((model) => (
          <button
            key={model.key}
            onClick={() => updateConfig({ model: model.key })}
            className={`
              px-4 py-3 text-sm font-sans font-normal rounded-container
              border transition-colors text-left
              ${config.model === model.key
                ? 'bg-black text-white border-black'
                : 'bg-white text-near-black border-border-light hover:border-light-gray'
              }
            `}
          >
            <span className="block font-medium">{model.label}</span>
            <span className={`block text-xs mt-1 ${config.model === model.key ? 'text-white/70' : 'text-silver'}`}>
              {model.modelId}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-container border border-border-light bg-white p-3">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="px-2 py-1 rounded-pill bg-snow text-xs font-sans text-stone">
            {selectedSpec.status}
          </span>
          <span className="px-2 py-1 rounded-pill bg-snow text-xs font-sans text-stone">
            {selectedSpec.tier}
          </span>
          <span className="px-2 py-1 rounded-pill bg-snow text-xs font-sans text-stone">
            refs &lt;= {selectedSpec.maxReferenceImages}
          </span>
        </div>
        <p className="text-xs font-sans text-stone leading-relaxed">{selectedSpec.summary}</p>
        <div className="mt-2 text-xs font-sans text-silver leading-relaxed">
          {selectedSpec.aspectRatios.length} ratios -{' '}
          {selectedSpec.imageSizes.length > 0
            ? `sizes ${selectedSpec.imageSizes.join(', ')}`
            : selectedSpec.nativeSizeLabel}
        </div>
      </div>
    </div>
  );
};
