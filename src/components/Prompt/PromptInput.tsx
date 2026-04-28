/**
 * Prompt Input Component - Ollama Style
 * v2: 支持 thinking 模式和多图参考
 */

import { useState, useCallback, type KeyboardEvent } from "react";
import {
  useConfigContext,
  useCanvasContext,
  useProjectArchiveContext,
  useTokenContext,
} from "../../contexts";
import { generateImage, generateImageWithThinking, hasApiKey, isThinkingSupported } from "../../services/nanoBananaApi";
import { Spinner } from "../common";
import type { CanvasNode, ThinkingStep } from "../../types";
import {
  buildPromptWithReferences,
  canvasNodesToPromptReferences,
  getOrderedNodeChain,
  type PromptReference,
} from "../../utils";

export function PromptInput() {
  const { config, updateConfig } = useConfigContext();
  const { nodes, addNode, selectedNodeId } = useCanvasContext();
  const { recordUsage } = useTokenContext();
  const { archiveGeneratedImage } = useProjectArchiveContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);

  const getGenerationReferences = useCallback((): PromptReference[] => {
    const references: PromptReference[] = [];

    const chainNodes = getOrderedNodeChain(nodes, selectedNodeId);
    references.push(...canvasNodesToPromptReferences(chainNodes));

    if (config.refImage) {
      references.push({
        imageData: config.refImage,
        label: `Image ${references.length + 1}`,
        annotation: 'Manual reference image from the sidebar.',
      });
    }

    return references;
  }, [config.refImage, nodes, selectedNodeId]);

  const handleGenerate = useCallback(async () => {
    if (!config.prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!hasApiKey()) {
      setError("Please configure your API key first");
      return;
    }

    setLoading(true);
    setError(null);
    setThinkingSteps([]);

    try {
      const references = getGenerationReferences();
      const contextualPrompt = buildPromptWithReferences(config.prompt, references);
      const refImages = references.map((reference) => reference.imageData);
      const useThinking = isThinkingSupported(config.model) && config.thinkingLevel && config.thinkingLevel !== 'off';

      let response;
      if (useThinking) {
        response = await generateImageWithThinking({
          model: config.model,
          prompt: contextualPrompt,
          aspect_ratio: config.aspectRatio,
          image_size: config.imageSize,
          width: config.width,
          height: config.height,
          ref_images: refImages,
          thinkingLevel: config.thinkingLevel !== 'off' ? config.thinkingLevel : undefined,
          thinkingBudget: config.thinkingBudget,
        });

        if (response.thinking_steps) {
          setThinkingSteps(response.thinking_steps);
        }
      } else {
        response = await generateImage({
          model: config.model,
          prompt: contextualPrompt,
          aspect_ratio: config.aspectRatio,
          image_size: config.imageSize,
          width: config.width,
          height: config.height,
          ref_images: refImages,
        });
      }

      const createdAt = new Date();
      const nodeId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const newNode: CanvasNode = {
        id: nodeId,
        imageData: response.image,
        position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
        scale: 1,
        rotation: 0,
        createdAt,
        prompt: config.prompt,
        model: config.model,
        tokenUsed: response.token_used,
        activeVersionId: versionId,
        versions: [
          {
            id: versionId,
            imageData: response.image,
            createdAt,
            prompt: config.prompt,
            model: config.model,
            tokenUsed: response.token_used,
          },
        ],
      };

      addNode(newNode);
      void archiveGeneratedImage({
        imageData: response.image,
        prompt: config.prompt,
        nodeId,
        versionId,
        operation: 'generate',
        model: config.model,
        tokenUsed: response.token_used,
        createdAt,
      });
      recordUsage(response.token_used);
      updateConfig({ prompt: "" });

      setTimeout(() => setThinkingSteps([]), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setThinkingSteps([]);
    } finally {
      setLoading(false);
    }
  }, [config, addNode, archiveGeneratedImage, recordUsage, updateConfig, getGenerationReferences]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-sans font-normal text-stone">
          Prompt
          {selectedNodeId && (
            <span className="ml-2 text-xs text-silver">(Connected mode - using {getGenerationReferences().length} reference image(s))</span>
          )}
        </label>
        <textarea
          value={config.prompt}
          onChange={(e) => updateConfig({ prompt: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedNodeId
              ? "Describe how this image relates to the connected images..."
              : "Describe the image you want to generate..."
          }
          rows={5}
          disabled={loading}
          className="w-full px-4 py-3 text-sm font-sans bg-white border border-light-gray rounded-container text-near-black placeholder:text-silver focus:outline-none focus:border-black resize-none disabled:bg-snow"
        />
      </div>

      {/* Thinking Steps 展示 */}
      {thinkingSteps.length > 0 && (
        <div className="p-3 bg-light-gray/50 rounded-lg border border-border-light">
          <div className="text-xs font-sans font-medium text-stone mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
            AI Reasoning
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {thinkingSteps.map((step, index) => (
              <div key={index} className="text-xs font-sans text-stone">
                {step.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm font-sans bg-snow border border-light-gray rounded-container text-near-black">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !config.prompt.trim() || !hasApiKey()}
        className="px-6 py-3 bg-black text-white text-sm font-sans font-medium rounded-pill hover:bg-near-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Spinner size="sm" /> : null}
        {loading
          ? isThinkingSupported(config.model)
            ? "Thinking..."
            : "Generating..."
          : "Generate Image"}
      </button>

      <span className="text-xs font-sans text-silver text-center">Press Ctrl+Enter to generate</span>
    </div>
  );
}
