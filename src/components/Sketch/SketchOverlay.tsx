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

const MIN_BRUSH_SIZE = 5;
const MAX_BRUSH_SIZE = 100;
const BRUSH_PREVIEW_OPACITY = 0.72;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const imageScaleRef = useRef(1);
  const brushSizeRef = useRef(initialBrushSize);
  const brushResizeRef = useRef<{
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);

  const [brushSize, setBrushSize] = useState(initialBrushSize);
  const [brushSizeHint, setBrushSizeHint] = useState<{
    x: number;
    y: number;
    size: number;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const configurePreviewContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(255, 255, 255, ${BRUSH_PREVIEW_OPACITY})`;
    ctx.lineWidth = brushSizeRef.current;
  }, []);

  const configureMaskContext = useCallback((ctx: CanvasRenderingContext2D) => {
    const scale = imageScaleRef.current || 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = brushSizeRef.current / scale;
  }, []);

  const fillMaskCanvas = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const maskContext = maskContextRef.current;
    if (!maskCanvas || !maskContext) return;

    maskContext.fillStyle = "#000000";
    maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    configureMaskContext(maskContext);
  }, [configureMaskContext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    contextRef.current = ctx;
    configurePreviewContext(ctx);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskCanvasRef.current = maskCanvas;
    maskContextRef.current = maskCanvas.getContext("2d");
    if (maskContextRef.current) {
      fillMaskCanvas();
    }
  }, [configurePreviewContext, fillMaskCanvas]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
    if (contextRef.current) {
      configurePreviewContext(contextRef.current);
    }
    if (maskContextRef.current) {
      configureMaskContext(maskContextRef.current);
    }
  }, [brushSize, configureMaskContext, configurePreviewContext]);

  useEffect(() => {
    const img = new Image();
    setImageLoaded(false);
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        const availableWidth = Math.max(containerWidth - 48, 280);
        const availableHeight = Math.max(containerHeight - 260, 240);

        const scale = Math.min(
          availableWidth / img.width,
          availableHeight / img.height,
          1
        );

        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        imageScaleRef.current = scale || 1;

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        if (maskCanvasRef.current && canvas) {
          maskCanvasRef.current.width = img.width;
          maskCanvasRef.current.height = img.height;
          maskContextRef.current = maskCanvasRef.current.getContext("2d");
          if (maskContextRef.current) {
            fillMaskCanvas();
          }
        }

        if (contextRef.current) {
          configurePreviewContext(contextRef.current);
          contextRef.current.drawImage(img, 0, 0, width, height);
        }
      }
    };
    img.src = originalImageData;
  }, [configurePreviewContext, fillMaskCanvas, originalImageData]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const toMaskCoords = useCallback((point: { x: number; y: number }) => {
    const scale = imageScaleRef.current || 1;
    return {
      x: point.x / scale,
      y: point.y / scale,
    };
  }, []);

  const drawBrushDot = useCallback((point: { x: number; y: number }) => {
    if (!contextRef.current || !maskContextRef.current) return;

    contextRef.current.beginPath();
    contextRef.current.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    contextRef.current.fillStyle = `rgba(255, 255, 255, ${BRUSH_PREVIEW_OPACITY})`;
    contextRef.current.fill();

    const maskPoint = toMaskCoords(point);
    const maskRadius = brushSize / 2 / (imageScaleRef.current || 1);
    maskContextRef.current.beginPath();
    maskContextRef.current.arc(maskPoint.x, maskPoint.y, maskRadius, 0, Math.PI * 2);
    maskContextRef.current.fillStyle = "#ffffff";
    maskContextRef.current.fill();
    configureMaskContext(maskContextRef.current);
  }, [brushSize, configureMaskContext, toMaskCoords]);

  const updateBrushSizeFromDrag = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!brushResizeRef.current) return;

    event.preventDefault();
    const deltaX = event.clientX - brushResizeRef.current.startX;
    const deltaY = event.clientY - brushResizeRef.current.startY;
    const nextBrushSize = clamp(
      Math.round(brushResizeRef.current.startSize + (deltaX - deltaY) / 2),
      MIN_BRUSH_SIZE,
      MAX_BRUSH_SIZE,
    );

    setBrushSize(nextBrushSize);
    setBrushSizeHint({
      x: event.clientX,
      y: event.clientY,
      size: nextBrushSize,
    });
  }, []);

  const stopBrushResize = useCallback(() => {
    brushResizeRef.current = null;
    setBrushSizeHint(null);
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      brushResizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startSize: brushSize,
      };
      setBrushSizeHint({
        x: e.clientX,
        y: e.clientY,
        size: brushSize,
      });
      return;
    }

    if (e.button !== 0) return;
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasCoords(e);
    drawBrushDot(lastPosRef.current);
  }, [brushSize, drawBrushDot, getCanvasCoords]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushResizeRef.current) {
      updateBrushSizeFromDrag(e);
      return;
    }

    if (!isDrawingRef.current || !contextRef.current || !maskContextRef.current) return;

    const currentPos = getCanvasCoords(e);
    const lastMaskPos = toMaskCoords(lastPosRef.current);
    const currentMaskPos = toMaskCoords(currentPos);

    contextRef.current.beginPath();
    contextRef.current.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    contextRef.current.lineTo(currentPos.x, currentPos.y);
    contextRef.current.stroke();

    maskContextRef.current.beginPath();
    maskContextRef.current.moveTo(lastMaskPos.x, lastMaskPos.y);
    maskContextRef.current.lineTo(currentMaskPos.x, currentMaskPos.y);
    maskContextRef.current.stroke();
    lastPosRef.current = currentPos;
  }, [getCanvasCoords, toMaskCoords, updateBrushSizeFromDrag]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    stopBrushResize();
  }, [stopBrushResize]);

  const handleComplete = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!maskCanvasRef.current) return;
    onComplete(canvasToBase64(maskCanvasRef.current));
  }, [onComplete]);

  const handleClear = useCallback(() => {
    if (!contextRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    configurePreviewContext(contextRef.current);
    contextRef.current.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    fillMaskCanvas();
  }, [configurePreviewContext, fillMaskCanvas]);

  const title = mode === 'mask' ? 'Mark Cutout Subject' : 'Mark Edit Area';
  const subtitle = mode === 'mask'
    ? 'Paint the subject to keep as a clean cutout'
    : 'Paint the area that should change';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div className="text-center shrink-0">
        <h2 className="text-2xl font-display font-medium text-white mb-2">{title}</h2>
        <p className="text-sm font-sans text-silver">{subtitle}</p>
      </div>

      <div className="flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
        <div className="relative max-h-full max-w-full bg-white rounded-container overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onContextMenu={(event) => event.preventDefault()}
            className="cursor-crosshair"
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          {!imageLoaded && (
            <div className="w-[512px] h-[512px] flex items-center justify-center bg-light-gray">
              <div className="w-8 h-8 border-2 border-stone border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {brushSizeHint && (
        <div
          className="pointer-events-none fixed z-[60] rounded-pill border border-white/15 bg-darkest/90 px-3 py-1.5 text-xs font-mono text-white shadow-xl"
          style={{
            left: brushSizeHint.x + 14,
            top: brushSizeHint.y + 14,
          }}
        >
          Brush {brushSizeHint.size}
        </div>
      )}

      <div className="flex w-full max-w-sm shrink-0 items-center justify-center rounded-container border border-white/15 bg-darkest/95 px-3 py-3 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="h-12 px-5 text-sm font-sans font-normal bg-white/8 text-white rounded-pill border border-white/15 hover:bg-white/14 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onCancel}
            className="h-12 px-5 text-sm font-sans font-normal bg-white/8 text-white rounded-pill border border-white/15 hover:bg-white/14 transition-colors"
          >
            Exit
          </button>
          <button
            onClick={handleComplete}
            className="h-12 px-6 text-sm font-sans font-medium bg-white text-black rounded-pill hover:bg-light-gray transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
