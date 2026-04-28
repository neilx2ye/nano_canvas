import React, { useState, useEffect, useRef } from 'react';

export interface ImageAnnotationModalProps {
  initialAnnotation: string;
  onSave: (annotation: string) => void;
  onCancel: () => void;
}

export function ImageAnnotationModal({
  initialAnnotation,
  onSave,
  onCancel,
}: ImageAnnotationModalProps) {
  const [annotation, setAnnotation] = useState(initialAnnotation);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    onSave(annotation.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-sans font-semibold text-near-black mb-4">
          Image Annotation
        </h2>

        <textarea
          ref={textareaRef}
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add notes, descriptions, or metadata for this image..."
          className="w-full h-32 px-4 py-3 text-sm font-sans bg-white border border-border-light rounded-lg text-near-black placeholder:text-silver focus:outline-none focus:border-black resize-none"
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-sans text-near-black border border-border-light rounded-pill hover:bg-light-gray transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-sans text-white bg-black rounded-pill hover:bg-gray-800 transition-colors"
          >
            Save
          </button>
        </div>

        <p className="text-xs font-sans text-silver mt-3">
          Press ⌘/Ctrl + Enter to save, Escape to cancel
        </p>
      </div>
    </div>
  );
}
