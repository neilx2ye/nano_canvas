import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToBase64 } from "../../utils";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface ImageMeta {
  width: number;
  height: number;
}

export interface EditOverlaySubmitPayload {
  cropImageData: string;
  note: string;
}

export interface EditOverlayProps {
  originalImageData: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (payload: EditOverlaySubmitPayload) => Promise<void> | void;
  onCancel: () => void;
}

const MIN_SELECTION_SIZE = 8;
const DEFAULT_SELECTION_SCREEN_SIZE = 120;
const MAX_ZOOM_MULTIPLIER = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSelection(startX: number, startY: number, endX: number, endY: number): SelectionRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

function clampSelection(selection: SelectionRect, image: ImageMeta): SelectionRect {
  const width = clamp(selection.width, MIN_SELECTION_SIZE, image.width);
  const height = clamp(selection.height, MIN_SELECTION_SIZE, image.height);
  return {
    x: clamp(selection.x, 0, image.width - width),
    y: clamp(selection.y, 0, image.height - height),
    width,
    height,
  };
}

function imageToCanvasPoint(x: number, y: number, transform: ViewTransform) {
  return {
    x: transform.offsetX + x * transform.scale,
    y: transform.offsetY + y * transform.scale,
  };
}

function canvasToImagePoint(x: number, y: number, transform: ViewTransform, image: ImageMeta) {
  return {
    x: clamp((x - transform.offsetX) / transform.scale, 0, image.width),
    y: clamp((y - transform.offsetY) / transform.scale, 0, image.height),
  };
}

function clampTransform(transform: ViewTransform, image: ImageMeta, canvas: HTMLCanvasElement): ViewTransform {
  const drawnWidth = image.width * transform.scale;
  const drawnHeight = image.height * transform.scale;
  const centerX = (canvas.width - drawnWidth) / 2;
  const centerY = (canvas.height - drawnHeight) / 2;

  return {
    scale: transform.scale,
    offsetX:
      drawnWidth <= canvas.width
        ? centerX
        : clamp(transform.offsetX, canvas.width - drawnWidth, 0),
    offsetY:
      drawnHeight <= canvas.height
        ? centerY
        : clamp(transform.offsetY, canvas.height - drawnHeight, 0),
  };
}

export function EditOverlay({
  originalImageData,
  loading = false,
  error,
  onSubmit,
  onCancel,
}: EditOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const minScaleRef = useRef(1);
  const dragRef = useRef<
    | { mode: "select"; start: { x: number; y: number } }
    | { mode: "pan"; startX: number; startY: number; transform: ViewTransform }
    | null
  >(null);

  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [note, setNote] = useState("");

  const getCanvasCoords = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, canvas.width),
      y: clamp(event.clientY - rect.top, 0, canvas.height),
    };
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageMeta) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      transform.offsetX,
      transform.offsetY,
      imageMeta.width * transform.scale,
      imageMeta.height * transform.scale,
    );

    if (selection) {
      const topLeft = imageToCanvasPoint(selection.x, selection.y, transform);
      const width = selection.width * transform.scale;
      const height = selection.height * transform.scale;

      ctx.save();
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.fillRect(topLeft.x, topLeft.y, width, height);
      ctx.strokeRect(topLeft.x, topLeft.y, width, height);
      ctx.restore();
    }
  }, [imageMeta, selection, transform]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = Math.min(window.innerWidth - 460, 760);
      const maxHeight = Math.min(window.innerHeight - 260, 560);
      canvas.width = Math.max(360, maxWidth);
      canvas.height = Math.max(320, maxHeight);
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;

      const meta = { width: image.width, height: image.height };
      const fitScale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.78;
      minScaleRef.current = fitScale;
      const nextTransform = clampTransform(
        {
          scale: fitScale,
          offsetX: (canvas.width - image.width * fitScale) / 2,
          offsetY: (canvas.height - image.height * fitScale) / 2,
        },
        meta,
        canvas,
      );

      setImageMeta(meta);
      setTransform(nextTransform);
      setImageLoaded(true);
    };
    image.src = originalImageData;
  }, [originalImageData]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const createDefaultSelection = useCallback((canvasPoint: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageMeta) return null;

    const imagePoint = canvasToImagePoint(canvasPoint.x, canvasPoint.y, transform, imageMeta);
    const size = DEFAULT_SELECTION_SCREEN_SIZE / transform.scale;
    return clampSelection(
      {
        x: imagePoint.x - size / 2,
        y: imagePoint.y - size / 2,
        width: size,
        height: size,
      },
      imageMeta,
    );
  }, [imageMeta, transform]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageMeta) return;

    event.preventDefault();
    const point = getCanvasCoords(event);
    const imagePoint = canvasToImagePoint(point.x, point.y, transform, imageMeta);
    const zoomFactor = event.deltaY < 0 ? 1.14 : 0.88;
    const nextScale = clamp(
      transform.scale * zoomFactor,
      minScaleRef.current * 0.7,
      minScaleRef.current * MAX_ZOOM_MULTIPLIER,
    );
    const nextTransform = clampTransform(
      {
        scale: nextScale,
        offsetX: point.x - imagePoint.x * nextScale,
        offsetY: point.y - imagePoint.y * nextScale,
      },
      imageMeta,
      canvas,
    );

    setTransform(nextTransform);
  }, [getCanvasCoords, imageMeta, transform]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageMeta) return;

    const canvasPoint = getCanvasCoords(event);
    if (event.button === 1 || event.button === 2 || event.altKey) {
      event.preventDefault();
      dragRef.current = {
        mode: "pan",
        startX: event.clientX,
        startY: event.clientY,
        transform,
      };
      return;
    }

    if (event.button !== 0) return;
    const imagePoint = canvasToImagePoint(canvasPoint.x, canvasPoint.y, transform, imageMeta);
    dragRef.current = { mode: "select", start: imagePoint };
    setSelection({ x: imagePoint.x, y: imagePoint.y, width: 0, height: 0 });
  }, [getCanvasCoords, imageMeta, transform]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageMeta || !dragRef.current) return;

    if (dragRef.current.mode === "pan") {
      const nextTransform = clampTransform(
        {
          ...dragRef.current.transform,
          offsetX: dragRef.current.transform.offsetX + event.clientX - dragRef.current.startX,
          offsetY: dragRef.current.transform.offsetY + event.clientY - dragRef.current.startY,
        },
        imageMeta,
        canvas,
      );
      setTransform(nextTransform);
      return;
    }

    const canvasPoint = getCanvasCoords(event);
    const imagePoint = canvasToImagePoint(canvasPoint.x, canvasPoint.y, transform, imageMeta);
    setSelection(clampSelection(normalizeSelection(dragRef.current.start.x, dragRef.current.start.y, imagePoint.x, imagePoint.y), imageMeta));
  }, [getCanvasCoords, imageMeta, transform]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageMeta || !dragRef.current) return;

    if (dragRef.current.mode === "pan") {
      dragRef.current = null;
      return;
    }

    const canvasPoint = getCanvasCoords(event);
    const imagePoint = canvasToImagePoint(canvasPoint.x, canvasPoint.y, transform, imageMeta);
    const nextSelection = normalizeSelection(dragRef.current.start.x, dragRef.current.start.y, imagePoint.x, imagePoint.y);
    dragRef.current = null;

    if (nextSelection.width >= MIN_SELECTION_SIZE && nextSelection.height >= MIN_SELECTION_SIZE) {
      setSelection(clampSelection(nextSelection, imageMeta));
      return;
    }

    setSelection(createDefaultSelection(canvasPoint));
  }, [createDefaultSelection, getCanvasCoords, imageMeta, transform]);

  const createCropImage = useCallback(() => {
    const image = imageRef.current;
    if (!image || !selection) return null;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, Math.round(selection.width));
    outputCanvas.height = Math.max(1, Math.round(selection.height));

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(
      image,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );

    return canvasToBase64(outputCanvas);
  }, [selection]);

  const handleSubmit = useCallback(async () => {
    const cropImageData = createCropImage();
    if (!cropImageData || !note.trim()) return;

    await onSubmit({
      cropImageData,
      note: note.trim(),
    });
  }, [createCropImage, note, onSubmit]);

  const canSubmit =
    Boolean(selection && selection.width >= MIN_SELECTION_SIZE && selection.height >= MIN_SELECTION_SIZE) &&
    Boolean(note.trim()) &&
    !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="mx-4 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-container bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border-light px-5 py-4">
          <div>
            <h2 className="text-lg font-display font-medium text-near-black">Edit Region</h2>
            <p className="mt-1 text-xs font-sans text-silver">Zoom in, frame an area, then describe the change.</p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-pill border border-border-light px-4 py-2 text-sm font-sans text-near-black hover:bg-snow disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
          <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-container bg-snow">
            <canvas
              ref={canvasRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onContextMenu={(event) => event.preventDefault()}
              onMouseLeave={() => {
                dragRef.current = null;
              }}
              className="cursor-crosshair rounded-container"
              style={{ display: imageLoaded ? "block" : "none" }}
            />
            {!imageLoaded && (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone border-t-transparent" />
            )}
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[320px]">
            <label className="text-sm font-sans text-stone">Modification Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={8}
              disabled={loading}
              placeholder="Describe only what should change inside the selected box..."
              className="w-full resize-none rounded-container border border-light-gray bg-snow px-4 py-3 text-sm font-sans text-near-black placeholder:text-silver focus:border-black focus:outline-none disabled:bg-light-gray"
            />
            <div className="rounded-container border border-border-light bg-white px-3 py-2 text-xs font-sans leading-relaxed text-silver">
              The request sends the original image plus the cropped selected area. Your note describes how that crop should change.
            </div>
            {error && (
              <div className="rounded-container border border-light-gray bg-snow px-3 py-2 text-sm font-sans text-near-black">
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-auto flex items-center justify-center rounded-container bg-black px-5 py-3 text-sm font-sans font-medium text-white transition-colors hover:bg-near-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Edit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
