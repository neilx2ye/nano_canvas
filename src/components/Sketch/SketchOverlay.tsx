/**
 * SketchOverlay Component - Ollama Style
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { canvasToBase64 } from "../../utils";

export interface SketchOverlayProps {
  originalImageData: string;
  brushSize?: number;
  onComplete: (maskData: string) => void;
  onCancel: () => void;
  mode?: 'inpaint' | 'mask';  // inpaint: white = redraw area, mask: white = keep area (cutout)
}

export function SketchOverlay({
  originalImageData,
  brushSize: initialBrushSize = 30,
  onComplete,
  onCancel,
  mode = 'inpaint',
}: SketchOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskContextRef = useRef<CanvasRenderingContext2D | null>(null);

  const [brushSize, setBrushSize] = useState(initialBrushSize);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    contextRef.current = ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = brushSize;

    // Create separate mask canvas for mask mode
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskCanvasRef.current = maskCanvas;
    maskContextRef.current = maskCanvas.getContext("2d");
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
    if (maskContextRef.current) {
      maskContextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        const scale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height,
          1
        );

        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        // Update mask canvas size
        if (maskCanvasRef.current && canvas) {
          maskCanvasRef.current.width = canvas.width;
          maskCanvasRef.current.height = canvas.height;
          maskContextRef.current = maskCanvasRef.current.getContext("2d");
          if (maskContextRef.current) {
            maskContextRef.current.fillStyle = "#000000";
            maskContextRef.current.fillRect(0, 0, canvas.width, canvas.height);
            maskContextRef.current.lineCap = "round";
            maskContextRef.current.lineJoin = "round";
            maskContextRef.current.strokeStyle = "#ffffff";
            maskContextRef.current.lineWidth = brushSize;
          }
        }

        if (contextRef.current) {
          contextRef.current.drawImage(img, 0, 0, width, height);
        }
      }
    };
    img.src = originalImageData;
  }, [originalImageData]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasCoords(e);
  }, [getCanvasCoords]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !contextRef.current || !maskContextRef.current) return;

    const currentPos = getCanvasCoords(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    contextRef.current.lineTo(currentPos.x, currentPos.y);
    contextRef.current.stroke();
    maskContextRef.current.beginPath();
    maskContextRef.current.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    maskContextRef.current.lineTo(currentPos.x, currentPos.y);
    maskContextRef.current.stroke();
    lastPosRef.current = currentPos;
  }, [getCanvasCoords]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const handleComplete = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!maskCanvasRef.current) return;
    onComplete(canvasToBase64(maskCanvasRef.current));
  }, [onComplete, mode]);

  const handleClear = useCallback(() => {
    if (!contextRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    contextRef.current.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    if (maskContextRef.current) {
      maskContextRef.current.fillStyle = "#000000";
      maskContextRef.current.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const title = mode === 'mask' ? 'Draw to Cutout' : 'Draw to Edit';
  const subtitle = mode === 'mask'
    ? 'Paint over the subject you want AI to cut out'
    : 'Paint over the area you want to modify';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div className="flex flex-col items-center gap-6 max-w-3xl w-full mx-4">
        <div className="text-center">
          <h2 className="text-2xl font-display font-medium text-white mb-2">{title}</h2>
          <p className="text-sm font-sans text-silver">{subtitle}</p>
        </div>

        <div className="relative bg-white rounded-container overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="cursor-crosshair"
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          {!imageLoaded && (
            <div className="w-[512px] h-[512px] flex items-center justify-center bg-light-gray">
              <div className="w-8 h-8 border-2 border-stone border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-sans text-silver">Brush Size</span>
            <input
              type="range"
              min={5}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-32 h-2 bg-light-gray rounded-pill appearance-none cursor-pointer"
            />
            <span className="text-sm font-sans text-white min-w-[40px]">{brushSize}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClear}
            className="px-6 py-3 text-sm font-sans font-normal bg-white text-near-black rounded-pill border border-light-gray hover:bg-snow transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 text-sm font-sans font-normal bg-white text-near-black rounded-pill border border-light-gray hover:bg-snow transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            className="px-6 py-3 text-sm font-sans font-medium bg-white text-black rounded-pill hover:bg-light-gray transition-colors"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
