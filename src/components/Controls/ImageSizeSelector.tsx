import React from 'react';
import { useConfigContext } from '../../contexts';
import {
  getDimensionsForAspectRatio,
  getModelSpec,
} from '../../constants/geminiImageModels';
import type { AspectRatio, ImageSize } from '../../types';

const SIZE_LABELS: Record<ImageSize, string> = {
  '512': '512 preview',
  '1K': '1K default',
  '2K': '2K',
  '4K': '4K',
};

export const ImageSizeSelector: React.FC = () => {
  const { config, updateConfig } = useConfigContext();
  const spec = getModelSpec(config.model);

  const updateAspectRatio = (aspectRatio: AspectRatio) => {
    const dimensions = getDimensionsForAspectRatio(aspectRatio, config.imageSize);
    updateConfig({ aspectRatio, ...dimensions });
  };

  const updateImageSize = (imageSize: ImageSize) => {
    const dimensions = getDimensionsForAspectRatio(config.aspectRatio, imageSize);
    updateConfig({ imageSize, ...dimensions });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-sans font-normal text-stone">Aspect Ratio</label>
        <div className="grid grid-cols-3 gap-2">
          {spec.aspectRatios.map((ratio) => (
            <button
              key={ratio}
              onClick={() => updateAspectRatio(ratio)}
              className={`
                h-9 px-2 text-sm font-sans font-normal rounded-container border transition-colors
                ${config.aspectRatio === ratio
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-near-black border-border-light hover:border-light-gray'
                }
              `}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-sans font-normal text-stone">Image Size</label>
        {spec.imageSizes.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {spec.imageSizes.map((size) => (
              <button
                key={size}
                onClick={() => updateImageSize(size)}
                className={`
                  h-10 px-3 text-sm font-sans font-normal rounded-container border transition-colors
                  ${config.imageSize === size
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-near-black border-border-light hover:border-light-gray'
                  }
                `}
              >
                {SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 rounded-container border border-border-light bg-white text-sm font-sans text-stone">
            {spec.nativeSizeLabel}; no imageSize parameter is sent.
          </div>
        )}
        <div className="text-xs font-sans text-silver">
          Request preview: {config.width} x {config.height}
        </div>
      </div>
    </div>
  );
};
