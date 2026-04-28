/**
 * Reference Image Upload Component - Ollama Style
 */

import React, { useRef } from 'react';
import { useConfigContext } from '../../contexts';
import { fileToBase64, validateImageFile } from '../../utils';

export const RefImageUpload: React.FC = () => {
  const { config, updateConfig } = useConfigContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      updateConfig({ refImage: base64 });
    } catch (err) {
      setError('Failed to process image');
    }
  };

  const handleRemove = () => {
    updateConfig({ refImage: undefined });
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-sans font-normal text-stone">Reference Image</label>
      
      {config.refImage ? (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-container overflow-hidden bg-light-gray">
            <img
              src={config.refImage}
              alt="Reference"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 text-sm font-sans text-stone border border-light-gray rounded-pill hover:border-border-light transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 px-4 py-3 bg-snow border border-dashed border-light-gray rounded-container cursor-pointer hover:border-border-light transition-colors">
          <svg className="w-4 h-4 text-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-sans text-stone">Upload image</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}

      {error && (
        <span className="text-xs font-sans text-stone">{error}</span>
      )}
    </div>
  );
};
