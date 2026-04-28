import { useState, useCallback, useRef, useEffect } from "react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import { FabricImage, type Canvas } from "fabric";
import { EditOverlay, SketchOverlay, SketchPromptInput, type EditOverlaySubmitPayload } from "../Sketch";
import { ImageAnnotationModal } from "./ImageAnnotationModal";
import {
  useCanvasContext,
  useConfigContext,
  useProjectArchiveContext,
  useTokenContext,
} from "../../contexts";
import {
  generateImage,
  generateImageWithThinking,
  hasApiKey,
  isMaskSupported,
  isThinkingSupported,
} from "../../services/nanoBananaApi";
import { downloadNodeImage, fileToBase64, validateImageFile } from "../../utils";
import type { CanvasNode, CanvasNodeVersion } from "../../types";

interface CanvasToolbarProps {
  fabricCanvasRef: RefObject<Canvas | null>;
  className?: string;
}

function getSelectedCanvasImageIds(canvas: Canvas | null): string[] {
  if (!canvas) return [];

  return canvas
    .getActiveObjects()
    .filter((object): object is FabricImage & { id: string } =>
      object instanceof FabricImage &&
      typeof (object as FabricImage & { id?: unknown }).id === "string",
    )
    .map((object) => object.id);
}

export function CanvasToolbar({ fabricCanvasRef, className }: CanvasToolbarProps) {
  const {
    nodes,
    selectedNodeIds,
    addNode,
    addVersion,
    removeNodes,
    selectNode,
    selectNodes,
    setAnnotation,
  } = useCanvasContext();
  const { config } = useConfigContext();
  const { recordUsage } = useTokenContext();
  const { archiveGeneratedImage } = useProjectArchiveContext();

  const confirmClearRef = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSketch, setShowSketch] = useState(false);
  const [sketchStep, setSketchStep] = useState<"draw" | "prompt">("draw");
  const [maskData, setMaskData] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [annotationState, setAnnotationState] = useState({
    visible: false,
    nodeId: null as string | null,
    currentAnnotation: "",
  });

  const selectedCount = selectedNodeIds.length;
  const selectedNode = selectedCount === 1
    ? nodes.find((node) => node.id === selectedNodeIds[0]) || null
    : null;
  const singleSelectedNodeId = selectedNode?.id || null;
  const sketchMode = config.maskMode ? "mask" : "inpaint";
  const supportsSketchModel = isMaskSupported(config.model);
  const canUseSketch = Boolean(singleSelectedNodeId) && supportsSketchModel;
  const sketchTitle = !singleSelectedNodeId
    ? "Select an image node first"
    : supportsSketchModel
      ? "Sketch edit uses Nano Banana mask/inpaint"
      : "Sketch requires Nano Banana / gemini-2.5-flash-image";
  const isFocusedOverlayOpen = showSketch || showEdit;

  const handleDelete = useCallback(() => {
    const canvasSelectedIds = getSelectedCanvasImageIds(fabricCanvasRef.current);
    const nodeIds = canvasSelectedIds.length > 0 ? canvasSelectedIds : selectedNodeIds;
    if (nodeIds.length === 0) return;

    const removedNodeIds = new Set(nodeIds);
    removeNodes(nodeIds);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.discardActiveObject();
      canvas.getObjects().forEach((object) => {
        if (
          object instanceof FabricImage &&
          removedNodeIds.has((object as FabricImage & { id?: string }).id || "")
        ) {
          canvas.remove(object);
        }
      });
      canvas.renderAll();
    }
    selectNodes([]);
  }, [fabricCanvasRef, removeNodes, selectedNodeIds, selectNodes]);

  const handleDownload = useCallback(() => {
    if (selectedNode) {
      downloadNodeImage(selectedNode.imageData, selectedNode.prompt);
    }
  }, [selectedNode]);

  const handleClear = useCallback(() => {
    if (confirmClearRef.current) {
      removeNodes(nodes.map((node) => node.id));
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.discardActiveObject();
        canvas.getObjects().forEach((object) => canvas.remove(object));
        canvas.renderAll();
      }
      confirmClearRef.current = false;
      selectNodes([]);
      return;
    }

    confirmClearRef.current = true;
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    confirmTimeoutRef.current = setTimeout(() => {
      confirmClearRef.current = false;
    }, 2000);
  }, [nodes, removeNodes, fabricCanvasRef, selectNodes]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const createUploadedNode = useCallback((file: File, imageData: string, index: number): CanvasNode => {
    const createdAt = new Date();
    const nodeId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const annotation = file.name.replace(/\.[^.]+$/, "");

    return {
      id: nodeId,
      imageData,
      position: { x: 120 + index * 36, y: 120 + index * 36 },
      scale: 1,
      rotation: 0,
      createdAt,
      prompt: "",
      model: "uploaded",
      tokenUsed: 0,
      annotation,
      activeVersionId: versionId,
      versions: [
        {
          id: versionId,
          imageData,
          createdAt,
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
          void archiveGeneratedImage({
            imageData,
            prompt: node.annotation || file.name,
            nodeId: node.id,
            versionId: node.activeVersionId || `${node.id}-initial`,
            operation: 'upload',
            model: 'uploaded',
            tokenUsed: 0,
            createdAt: node.createdAt,
          });
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
    [addNode, archiveGeneratedImage, createUploadedNode, selectNode],
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
      if (!singleSelectedNodeId) return;
      const createdAt = new Date();
      const versionId = crypto.randomUUID();

      const version: CanvasNodeVersion = {
        id: versionId,
        imageData: resultImageData,
        createdAt,
        prompt,
        model: config.model,
        tokenUsed,
      };

      addVersion(singleSelectedNodeId, version, true);
      void archiveGeneratedImage({
        imageData: resultImageData,
        prompt,
        nodeId: singleSelectedNodeId,
        versionId,
        operation: config.maskMode ? 'mask' : 'sketch',
        model: config.model,
        tokenUsed,
        createdAt,
      });
      recordUsage(tokenUsed);
      handleSketchCancel();
    },
    [
      addVersion,
      archiveGeneratedImage,
      config.maskMode,
      config.model,
      handleSketchCancel,
      recordUsage,
      singleSelectedNodeId,
    ],
  );

  const handleInpaintCancel = useCallback(() => {
    setSketchStep("draw");
    setMaskData(null);
  }, []);

  const handleEditSubmit = useCallback(
    async ({ cropImageData, note }: EditOverlaySubmitPayload) => {
      if (!selectedNode) return;
      if (!hasApiKey()) {
        setEditError("Please configure your API key first");
        return;
      }

      setEditLoading(true);
      setEditError(null);

      try {
        const prompt = [
          "Image 1 is the original image.",
          "Image 2 is a cropped region taken from Image 1. This crop is the exact area to edit.",
          `Modification note: ${note}`,
          "Apply the modification to the matching region in Image 1. Keep everything outside that region unchanged.",
        ].join("\n");
        const useThinking =
          isThinkingSupported(config.model) &&
          config.thinkingLevel &&
          config.thinkingLevel !== "off";

        const response = useThinking
          ? await generateImageWithThinking({
              model: config.model,
              prompt,
              aspect_ratio: config.aspectRatio,
              image_size: config.imageSize,
              width: config.width,
              height: config.height,
              ref_images: [selectedNode.imageData, cropImageData],
              thinkingLevel: config.thinkingLevel !== "off" ? config.thinkingLevel : undefined,
              thinkingBudget: config.thinkingBudget,
            })
          : await generateImage({
              model: config.model,
              prompt,
              aspect_ratio: config.aspectRatio,
              image_size: config.imageSize,
              width: config.width,
              height: config.height,
              ref_images: [selectedNode.imageData, cropImageData],
            });

        const createdAt = new Date();
        const versionPrompt = `Edit region: ${note}`;
        const versionId = crypto.randomUUID();
        const version: CanvasNodeVersion = {
          id: versionId,
          imageData: response.image,
          createdAt,
          prompt: versionPrompt,
          model: config.model,
          tokenUsed: response.token_used,
        };

        addVersion(selectedNode.id, version, true);
        void archiveGeneratedImage({
          imageData: response.image,
          prompt: versionPrompt,
          nodeId: selectedNode.id,
          versionId,
          operation: 'edit',
          model: config.model,
          tokenUsed: response.token_used,
          createdAt,
        });
        recordUsage(response.token_used);
        setShowEdit(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Edit generation failed");
      } finally {
        setEditLoading(false);
      }
    },
    [addVersion, archiveGeneratedImage, config, recordUsage, selectedNode],
  );

  useEffect(() => {
    if (showSketch && !supportsSketchModel) {
      handleSketchCancel();
    }
  }, [handleSketchCancel, showSketch, supportsSketchModel]);

  useEffect(() => {
    if (showSketch && !selectedNode) {
      handleSketchCancel();
    }
  }, [handleSketchCancel, selectedNode, showSketch]);

  useEffect(() => {
    if (showEdit && !selectedNode && !editLoading) {
      setShowEdit(false);
      setEditError(null);
    }
  }, [editLoading, selectedNode, showEdit]);

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
    title,
  }: {
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
    variant?: "default" | "primary";
    title?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
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

      {!isFocusedOverlayOpen && (
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

          <ToolbarButton onClick={handleAnnotate} disabled={!selectedNode}>
            Annotate
          </ToolbarButton>

          <ToolbarButton onClick={handleDelete} disabled={selectedCount === 0}>
            {selectedCount > 1 ? `Delete (${selectedCount})` : "Delete"}
          </ToolbarButton>

          <ToolbarButton onClick={handleDownload} disabled={!selectedNode}>
            Download
          </ToolbarButton>

          <ToolbarButton
            onClick={() => {
              setEditError(null);
              setShowEdit(true);
            }}
            disabled={!selectedNode}
            title={!selectedNode ? "Select an image node first" : "Circle a local area and describe the edit"}
          >
            Edit
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setShowSketch(true)}
            disabled={!canUseSketch}
            title={sketchTitle}
          >
            {config.maskMode ? "Mask" : "Sketch"}
          </ToolbarButton>

          <ToolbarButton onClick={handleClear} disabled={nodes.length === 0}>
            {confirmClearRef.current ? "Confirm Clear" : "Clear"}
          </ToolbarButton>
        </div>
      )}

      {uploadError && !isFocusedOverlayOpen && (
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

      {showEdit && selectedNode && (
        <EditOverlay
          originalImageData={selectedNode.imageData}
          loading={editLoading}
          error={editError}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            if (!editLoading) {
              setShowEdit(false);
              setEditError(null);
            }
          }}
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
