import { useState } from 'react';
import type { CanvasNode, ModelType } from '../../types';
import { MODEL_OPTIONS } from '../../constants/geminiImageModels';

export interface ImageNodeMenuProps {
  node: CanvasNode;
  position: { x: number; y: number };
  defaultModel: ModelType;
  connectingFromId: string | null;
  regenerating: boolean;
  onClose: () => void;
  onAnnotate: () => void;
  onStartConnection: () => void;
  onCompleteConnection: () => void;
  onCancelConnection: () => void;
  onRemoveConnections: () => void;
  onRegenerate: (model: ModelType, prompt: string) => Promise<void>;
  onSelectVersion: (versionId: string) => void;
  onDelete: () => void;
}

export function ImageNodeMenu({
  node,
  position,
  defaultModel,
  connectingFromId,
  regenerating,
  onClose,
  onAnnotate,
  onStartConnection,
  onCompleteConnection,
  onCancelConnection,
  onRemoveConnections,
  onRegenerate,
  onSelectVersion,
  onDelete,
}: ImageNodeMenuProps) {
  const [model, setModel] = useState<ModelType>(defaultModel);
  const initialPrompt = node.model === 'uploaded' || node.prompt.startsWith('Uploaded:')
    ? ''
    : node.prompt;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);

  const versions = node.versions && node.versions.length > 0
    ? node.versions
    : [
        {
          id: node.activeVersionId || `${node.id}-initial`,
          imageData: node.imageData,
          createdAt: node.createdAt,
          prompt: node.prompt,
          model: node.model,
          tokenUsed: node.tokenUsed,
        },
      ];
  const activeVersionId = node.activeVersionId || versions[versions.length - 1]?.id;
  const isConnectingFromThisNode = connectingFromId === node.id;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setError(null);
    try {
      await onRegenerate(model, prompt.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="fixed z-50 bg-white rounded-container shadow-xl border border-border-light p-3 w-[320px]"
        style={{
          left: Math.min(position.x, window.innerWidth - 340),
          top: Math.min(position.y, window.innerHeight - 520),
        }}
      >
        <div className="flex items-start gap-3 pb-3 border-b border-border-light">
          <div className="w-14 h-14 rounded-container overflow-hidden bg-light-gray shrink-0">
            <img src={node.imageData} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-sans font-medium text-near-black truncate">
              {node.annotation || 'Canvas image'}
            </div>
            <div className="text-xs font-sans text-silver mt-1 truncate">{node.model}</div>
          </div>
        </div>

        <div className="py-3 border-b border-border-light flex flex-col gap-2">
          <button
            onClick={() => {
              onAnnotate();
              onClose();
            }}
            className="w-full px-3 py-2 text-sm font-sans text-left text-near-black rounded-container hover:bg-snow transition-colors"
          >
            Add / Edit Annotation
          </button>

          {!connectingFromId && (
            <button
              onClick={onStartConnection}
              className="w-full px-3 py-2 text-sm font-sans text-left text-near-black rounded-container hover:bg-snow transition-colors"
            >
              Start Connection From Here
            </button>
          )}

          {connectingFromId && !isConnectingFromThisNode && (
            <button
              onClick={onCompleteConnection}
              className="w-full px-3 py-2 text-sm font-sans text-left text-near-black rounded-container hover:bg-snow transition-colors"
            >
              Connect After Selected Start
            </button>
          )}

          {connectingFromId && (
            <button
              onClick={onCancelConnection}
              className="w-full px-3 py-2 text-sm font-sans text-left text-stone rounded-container hover:bg-snow transition-colors"
            >
              Cancel Connection
            </button>
          )}

          {(node.connectedFrom || (node.connectedTo && node.connectedTo.length > 0)) && (
            <button
              onClick={onRemoveConnections}
              className="w-full px-3 py-2 text-sm font-sans text-left text-stone rounded-container hover:bg-snow transition-colors"
            >
              Remove This Image's Connections
            </button>
          )}
        </div>

        {versions.length > 1 && (
          <div className="py-3 border-b border-border-light">
            <label className="text-xs font-sans text-stone block mb-2">Visible Version</label>
            <select
              value={activeVersionId}
              onChange={(event) => onSelectVersion(event.target.value)}
              className="w-full px-3 py-2 text-sm font-sans bg-white border border-border-light rounded-container focus:outline-none focus:border-black"
            >
              {versions.map((version, index) => (
                <option key={version.id} value={version.id}>
                  Version {index + 1} - {version.model}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="py-3 border-b border-border-light flex flex-col gap-3">
          <div>
            <label className="text-xs font-sans text-stone block mb-2">Regenerate Model</label>
            <div className="grid grid-cols-1 gap-1.5">
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setModel(option.key)}
                  className={`
                    px-3 py-2 text-xs font-sans rounded-container border text-left transition-colors
                    ${model === option.key
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-near-black border-border-light hover:border-light-gray'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-sans text-stone block mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm font-sans bg-snow border border-light-gray rounded-container text-near-black placeholder:text-silver focus:outline-none focus:border-black resize-none"
              placeholder="Describe the next version..."
            />
          </div>

          {error && (
            <div className="px-3 py-2 text-xs font-sans bg-snow border border-light-gray rounded-container text-near-black">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={regenerating || !prompt.trim()}
            className="w-full px-4 py-2.5 text-sm font-sans font-medium bg-black text-white rounded-container hover:bg-near-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {regenerating ? 'Generating...' : 'Generate New Version'}
          </button>
        </div>

        <button
          onClick={onDelete}
          className="w-full mt-3 px-3 py-2 text-sm font-sans text-left text-red-500 rounded-container hover:bg-red-50 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </>
  );
}
