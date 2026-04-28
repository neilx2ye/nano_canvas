/**
 * SketchPromptInput Component - Ollama Style
 */

import { useState, useCallback } from "react";
import { maskImage } from "../../services/nanoBananaApi";
import type { AspectRatio, ModelType } from "../../types";

export interface SketchPromptInputProps {
  maskData: string;
  originalImageData: string;
  model: ModelType;
  mode?: 'inpaint' | 'mask';
  aspectRatio?: AspectRatio;
  onSubmit: (resultImageData: string, tokenUsed: number, prompt: string) => void;
  onCancel: () => void;
}

export function SketchPromptInput({
  maskData,
  originalImageData,
  model,
  mode = 'inpaint',
  aspectRatio,
  onSubmit,
  onCancel,
}: SketchPromptInputProps) {
  const [prompt, setPrompt] = useState(
    mode === 'mask'
      ? 'Create a clean cutout of the painted subject. Remove the unpainted area and preserve the subject edges.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await maskImage({
        original_image: originalImageData,
        mask: maskData,
        prompt: prompt,
        model: model,
        aspect_ratio: aspectRatio,
      });

      onSubmit(response.image, response.token_used, prompt.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mask processing failed");
    } finally {
      setLoading(false);
    }
  }, [prompt, originalImageData, maskData, model, aspectRatio, onSubmit]);

  const title = mode === 'mask' ? 'Create Cutout' : 'Describe Changes';
  const label = mode === 'mask' ? 'What should be cut out?' : 'What changes do you want?';
  const placeholder = mode === 'mask'
    ? 'Describe the subject to extract...'
    : 'Describe the changes you want to make...';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg w-full mx-4 bg-white rounded-container p-6">
        <h2 className="text-xl font-display font-medium text-near-black">{title}</h2>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-sans text-stone uppercase">Original</span>
            <div className="w-40 h-40 rounded-container overflow-hidden bg-light-gray">
              <img src={originalImageData} alt="Original" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-sans text-stone uppercase">Mask</span>
            <div className="w-40 h-40 rounded-container overflow-hidden bg-light-gray">
              <img src={maskData} alt="Mask" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="w-full">
          <label className="text-sm font-sans text-stone mb-2 block">{label}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={3}
            disabled={loading}
            className="w-full px-4 py-3 text-sm font-sans bg-snow border border-light-gray rounded-container text-near-black placeholder:text-silver focus:outline-none focus:border-black resize-none disabled:bg-light-gray"
          />
        </div>

        {error && (
          <div className="w-full px-4 py-3 text-sm font-sans bg-snow border border-light-gray rounded-container text-near-black">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 text-sm font-sans font-normal bg-white text-near-black rounded-pill border border-light-gray hover:bg-snow transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="px-6 py-3 text-sm font-sans font-medium bg-black text-white rounded-pill hover:bg-near-black transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              "Apply Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
