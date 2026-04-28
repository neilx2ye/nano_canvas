import { useState, useCallback, useRef, useEffect } from "react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import { FabricImage, type Canvas } from "fabric";
import { SketchOverlay, SketchPromptInput } from "../Sketch";
import { ImageAnnotationModal } from "./ImageAnnotationModal";
import { useCanvasContext, useConfigContext, useTokenContext } from "../../contexts";
import { downloadNodeImage, fileToBase64, validateImageFile } from "../../utils";
import type { CanvasNode, CanvasNodeVersion } from "../../types";

interface CanvasToolbarProps {
  fabricCanvasRef: RefObject<Canvas | null>;
  className?: string;
}

export function CanvasToolbar({ fabricCanvasRef, className }: CanvasToolbarProps) {
  const {
    nodes,
    selectedNodeId,
    addNode,
    addVersion,
    removeNode,
    selectNode,
    setAnnotation,
  } = useCanvasContext();
  const { config } = useConfigContext();
  const { recordUsage } = useTokenContext();

  const confirmClearRef = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSketch, setShowSketch] = useState(false);
  const [sketchStep, setSketchStep] = useState<"draw" | "prompt">("draw");
  const [maskData, setMaskData] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [annotationState, setAnnotationState] = useState({
    visible: false,
    nodeId: null as string | null,
    currentAnnotation: "",
  });

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const sketchMode = config.maskMode ? "mask" : "inpaint";
  const canUseSketch = Boolean(selectedNodeId) && (!config.maskMode || config.model === "nano-banana");

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;

    removeNode(selectedNodeId);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const target = canvas.getObjects().find(
        (object): object is FabricImage =>
          object instanceof FabricImage &&
          (object as FabricImage & { id?: string }).id === selectedNodeId,
      );
      if (target) {
        canvas.remove(target);
        canvas.renderAll();
      }
    }
  }, [selectedNodeId, removeNode, fabricCanvasRef]);

  const handleDownload = useCallback(() => {
    if (selectedNode) {
      downloadNodeImage(selectedNode.imageData, selectedNode.prompt);
    }
  }, [selectedNode]);

  const handleClear = useCallback(() => {
    if (confirmClearRef.current) {
      nodes.forEach((node) => removeNode(node.id));
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.getObjects().forEach((object) => canvas.remove(object));
        canvas.renderAll();
      }
      confirmClearRef.current = false;
      selectNode(null);
      return;
    }

    confirmClearRef.current = true;
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    confirmTimeoutRef.current = setTimeout(() => {
      confirmClearRef.current = false;
    }, 2000);
  }, [nodes, removeNode, fabricCanvasRef, selectNode]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const createUploadedNode = useCallback((file: File, imageData: string, index: number): CanvasNode => {
    const versionId = crypto.randomUUID();
    const annotation = file.name.replace(/\.[^.]+$/, "");

    return {
      id: crypto.randomUUID(),
      imageData,
      position: { x: 120 + index * 36, y: 120 + index * 36 },
      scale: 1,
      rotation: 0,
      createdAt: new Date(),
      prompt: "",
      model: "uploaded",
      tokenUsed: 0,
      annotation,
      activeVersionId: versionId,
      versions: [
        {
          id: versionId,
          imageData,
          createdAt: new Date(),
          prompt: "",
          model: "uploaded",
          tokenUsed: 0,
        },
      ],
    };
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      setUploadError(null);

      try {
        const createdNodes: CanvasNode[] = [];

        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const validation = validateImageFile(file);
          if (!validation.valid) {
            setUploadError(`${file.name}: ${validation.error || "Invalid image"}`);
            continue;
          }

          const imageData = await fileToBase64(file);
          const node = createUploadedNode(file, imageData, index);
          createdNodes.push(node);
          addNode(node);
        }

        const lastNode = createdNodes[createdNodes.length - 1];
        if (lastNode) {
          selectNode(lastNode.id);
        }

        if (createdNodes.length === 1) {
          setAnnotationState({
            visible: true,
            nodeId: createdNodes[0].id,
            currentAnnotation: createdNodes[0].annotation || "",
          });
        }
      } finally {
        event.target.value = "";
      }
    },
    [addNode, createUploadedNode, selectNode],
  );

  const handleAnnotate = useCallback(() => {
    if (!selectedNode) return;
    setAnnotationState({
      visible: true,
      nodeId: selectedNode.id,
      currentAnnotation: selectedNode.annotation || "",
    });
  }, [selectedNode]);

  const handleAnnotationSave = useCallback(
    (annotation: string) => {
      if (annotationState.nodeId) {
        setAnnotation(annotationState.nodeId, annotation);
      }
      setAnnotationState({ visible: false, nodeId: null, currentAnnotation: "" });
    },
    [annotationState.nodeId, setAnnotation],
  );

  const handleSketchComplete = useCallback((generatedMask: string) => {
    setMaskData(generatedMask);
    setSketchStep("prompt");
  }, []);

  const handleSketchCancel = useCallback(() => {
    setShowSketch(false);
    setSketchStep("draw");
    setMaskData(null);
  }, []);

  const handleInpaintSubmit = useCallback(
    (resultImageData: string, tokenUsed: number, prompt: string) => {
      if (!selectedNodeId) return;

      const version: CanvasNodeVersion = {
        id: crypto.randomUUID(),
        imageData: resultImageData,
        createdAt: new Date(),
        prompt,
        model: config.model,
        tokenUsed,
      };

      addVersion(selectedNodeId, version, true);
      recordUsage(tokenUsed);
      handleSketchCancel();
    },
    [addVersion, config.model, handleSketchCancel, recordUsage, selectedNodeId],
  );

  const handleInpaintCancel = useCallback(() => {
    setSketchStep("draw");
    setMaskData(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Delete" && event.code !== "Backspace") return;
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }
      handleDelete();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDelete]);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const ToolbarButton = ({
    onClick,
    disabled,
    children,
    variant = "default",
  }: {
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
    variant?: "default" | "primary";
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 text-sm font-sans font-normal rounded-pill border transition-colors
        ${variant === "primary"
          ? "bg-black text-white border-black hover:bg-gray-800"
          : disabled
            ? "bg-snow text-silver border-light-gray cursor-not-allowed opacity-50"
            : "bg-white text-near-black border-border-light hover:border-light-gray cursor-pointer"
        }
      `}
    >
      {children}
    </button>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={className}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 100,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <ToolbarButton onClick={handleUpload} variant="primary">
          Upload
        </ToolbarButton>

        <ToolbarButton onClick={handleAnnotate} disabled={!selectedNodeId}>
          Annotate
        </ToolbarButton>

        <ToolbarButton onClick={handleDelete} disabled={!selectedNodeId}>
          Delete
        </ToolbarButton>

        <ToolbarButton onClick={handleDownload} disabled={!selectedNode}>
          Download
        </ToolbarButton>

        <ToolbarButton onClick={() => setShowSketch(true)} disabled={!canUseSketch}>
          {config.maskMode ? "Mask" : "Sketch"}
        </ToolbarButton>

        <ToolbarButton onClick={handleClear} disabled={nodes.length === 0}>
          {confirmClearRef.current ? "Confirm Clear" : "Clear"}
        </ToolbarButton>
      </div>

      {uploadError && (
        <div className="absolute top-16 left-4 z-50 px-3 py-2 rounded-container border border-border-light bg-white text-xs font-sans text-stone shadow-lg">
          {uploadError}
        </div>
      )}

      {showSketch && selectedNode && sketchStep === "draw" && (
        <SketchOverlay
          originalImageData={selectedNode.imageData}
          mode={sketchMode}
          onComplete={handleSketchComplete}
          onCancel={handleSketchCancel}
        />
      )}

      {showSketch && selectedNode && sketchStep === "prompt" && maskData && (
        <SketchPromptInput
          maskData={maskData}
          originalImageData={selectedNode.imageData}
          model={config.model}
          mode={sketchMode}
          aspectRatio={config.aspectRatio}
          onSubmit={handleInpaintSubmit}
          onCancel={handleInpaintCancel}
        />
      )}

      {annotationState.visible && (
        <ImageAnnotationModal
          initialAnnotation={annotationState.currentAnnotation}
          onSave={handleAnnotationSave}
          onCancel={() => setAnnotationState({ visible: false, nodeId: null, currentAnnotation: "" })}
        />
      )}
    </>
  );
}

export default CanvasToolbar;
