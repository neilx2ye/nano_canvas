import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { Canvas, FabricImage, Point, type TPointerEventInfo, type TPointerEvent } from 'fabric';
import { useCanvasContext, useConfigContext, useTokenContext } from '../../contexts';
import { ImageNodeMenu } from './ImageNodeMenu';
import { ImageAnnotationModal } from './ImageAnnotationModal';
import {
  generateImageWithThinking,
  generateImage,
  hasApiKey,
  isThinkingSupported,
} from '../../services/nanoBananaApi';
import {
  buildPromptWithReferences,
  canvasNodesToPromptReferences,
  getOrderedNodeChain,
  type PromptReference,
} from '../../utils';
import { sanitizeGenerationConfig } from '../../constants/geminiImageModels';
import type { CanvasNodeVersion, ModelType } from '../../types';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const NODE_SIZE = 256;

interface InfiniteCanvasProps {
  className?: string;
  onNodeSelect?: (nodeId: string | null) => void;
}

export interface InfiniteCanvasHandle {
  getFabricCanvas: () => Canvas | null;
}

type NodePosition = { x: number; y: number; width: number; height: number };
type CanvasPoint = { x: number; y: number };

function getNodeCenter(position: NodePosition): CanvasPoint {
  return {
    x: position.x + position.width / 2,
    y: position.y + position.height / 2,
  };
}

function getRectEdgePoint(position: NodePosition, toward: CanvasPoint): CanvasPoint {
  const center = getNodeCenter(position);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (dx === 0 && dy === 0) return center;

  const halfWidth = Math.max(position.width / 2, 1);
  const halfHeight = Math.max(position.height / 2, 1);
  const scale = Math.min(
    Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY,
    Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

export const InfiniteCanvas = forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>(
  ({ className, onNodeSelect }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);
    const isPanningRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const clickStartRef = useRef<{ x: number; y: number; targetId: string | null } | null>(null);
    const hasDraggedRef = useRef(false);
    const nodePositionRef = useRef<Map<string, NodePosition>>(new Map());
    const overlayFrameRef = useRef<number | null>(null);
    const loadingNodeIdsRef = useRef<Set<string>>(new Set());

    const {
      nodes,
      connectingFromId,
      selectNode,
      updateNode,
      removeNode,
      addVersion,
      selectVersion,
      setAnnotation,
      startConnection,
      completeConnection,
      cancelConnection,
      removeAllConnections,
      getNodeById,
    } = useCanvasContext();

    const { config } = useConfigContext();
    const { recordUsage } = useTokenContext();

    const [menuState, setMenuState] = useState({
      visible: false,
      nodeId: null as string | null,
      position: { x: 0, y: 0 },
    });
    const [annotationState, setAnnotationState] = useState({
      visible: false,
      nodeId: null as string | null,
      currentAnnotation: '',
    });
    const [regeneratingNodeId, setRegeneratingNodeId] = useState<string | null>(null);
    const [, setOverlayRevision] = useState(0);

    useImperativeHandle(ref, () => ({
      getFabricCanvas: () => fabricCanvasRef.current,
    }));

    const closeMenu = useCallback(() => {
      setMenuState({ visible: false, nodeId: null, position: { x: 0, y: 0 } });
    }, []);

    const updateOverlayTransform = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (canvas && overlayRef.current) {
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        overlayRef.current.style.transform = `translate(${vpt[4]}px, ${vpt[5]}px) scale(${vpt[0]})`;
        overlayRef.current.style.transformOrigin = '0 0';
      }
    }, []);

    const scheduleOverlayRefresh = useCallback(() => {
      if (overlayFrameRef.current !== null) return;
      overlayFrameRef.current = window.requestAnimationFrame(() => {
        overlayFrameRef.current = null;
        setOverlayRevision((revision) => revision + 1);
      });
    }, []);

    const refreshNodePosition = useCallback((nodeId: string, object: FabricImage) => {
      nodePositionRef.current.set(nodeId, {
        x: object.left || 0,
        y: object.top || 0,
        width: (object.width || NODE_SIZE) * (object.scaleX || 1),
        height: (object.height || NODE_SIZE) * (object.scaleY || 1),
      });
      scheduleOverlayRefresh();
    }, [scheduleOverlayRefresh]);

    useEffect(() => {
      if (!canvasRef.current || fabricCanvasRef.current) return;

      const container = containerRef.current;
      const width = container?.clientWidth || window.innerWidth;
      const height = container?.clientHeight || window.innerHeight;

      const canvas = new Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
      });

      fabricCanvasRef.current = canvas;
      updateOverlayTransform();

      const handleResize = () => {
        const newWidth = container?.clientWidth || window.innerWidth;
        const newHeight = container?.clientHeight || window.innerHeight;
        canvas.setWidth(newWidth);
        canvas.setHeight(newHeight);
        canvas.renderAll();
        updateOverlayTransform();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        if (overlayFrameRef.current !== null) {
          window.cancelAnimationFrame(overlayFrameRef.current);
          overlayFrameRef.current = null;
        }
        window.removeEventListener('resize', handleResize);
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    }, [updateOverlayTransform]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const existingObjects = canvas.getObjects();
      const existingById = new Map<string, FabricImage>();
      existingObjects.forEach((object) => {
        if (object instanceof FabricImage) {
          const id = (object as FabricImage & { id?: string }).id;
          if (id) {
            const existing = existingById.get(id);
            if (existing) {
              canvas.remove(existing);
            }
            existingById.set(id, object);
          }
        }
      });

      const neededIds = new Set(nodes.map((node) => node.id));

      nodes.forEach((node) => {
        const existing = existingById.get(node.id);
        const existingImageData = existing
          ? (existing as FabricImage & { imageData?: string }).imageData
          : undefined;

        if (existing && existingImageData === node.imageData) {
          existing.set({
            left: node.position.x,
            top: node.position.y,
            scaleX: node.scale,
            scaleY: node.scale,
            angle: node.rotation,
          });
          existing.setCoords();
          refreshNodePosition(node.id, existing);
          return;
        }

        if (existing) {
          canvas.remove(existing);
          nodePositionRef.current.delete(node.id);
        }

        if (loadingNodeIdsRef.current.has(node.id)) {
          return;
        }

        loadingNodeIdsRef.current.add(node.id);
        FabricImage.fromURL(node.imageData, { crossOrigin: 'anonymous' }).then((image) => {
          loadingNodeIdsRef.current.delete(node.id);
          const activeCanvas = fabricCanvasRef.current;
          if (!image || !activeCanvas) return;

          const stillNeeded = nodes.some((currentNode) => currentNode.id === node.id);
          const existingSameNode = activeCanvas.getObjects().find(
            (object) =>
              object instanceof FabricImage &&
              (object as FabricImage & { id?: string }).id === node.id,
          );
          if (!stillNeeded || existingSameNode) {
            return;
          }

          const fitScale =
            image.width && image.height
              ? Math.min(NODE_SIZE / image.width, NODE_SIZE / image.height, 1)
              : 1;
          const scale = node.scale === 1 ? fitScale : node.scale;

          image.set({
            left: node.position.x,
            top: node.position.y,
            scaleX: scale,
            scaleY: scale,
            angle: node.rotation,
            hasControls: true,
            hasBorders: true,
            selectable: true,
            objectCaching: false,
            noScaleCache: true,
          });

          (image as FabricImage & { id: string; imageData: string }).id = node.id;
          (image as FabricImage & { id: string; imageData: string }).imageData = node.imageData;

          activeCanvas.add(image);
          refreshNodePosition(node.id, image);
          activeCanvas.requestRenderAll();

          if (scale !== node.scale) {
            updateNode(node.id, { scale });
          }
        }).catch(() => {
          loadingNodeIdsRef.current.delete(node.id);
        });
      });

      canvas.getObjects().forEach((object) => {
        if (object instanceof FabricImage) {
          const id = (object as FabricImage & { id?: string }).id;
          if (id && !neededIds.has(id)) {
            canvas.remove(object);
            nodePositionRef.current.delete(id);
            loadingNodeIdsRef.current.delete(id);
          }
        }
      });

      canvas.renderAll();
    }, [nodes, refreshNodePosition, updateNode]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handleSelection = () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject instanceof FabricImage) {
          const id = (activeObject as FabricImage & { id?: string }).id;
          if (id) {
            selectNode(id);
            onNodeSelect?.(id);
          }
        }
      };

      const handleSelectionCleared = () => {
        selectNode(null);
        onNodeSelect?.(null);
      };

      canvas.on('selection:created', handleSelection);
      canvas.on('selection:updated', handleSelection);
      canvas.on('selection:cleared', handleSelectionCleared);

      return () => {
        canvas.off('selection:created', handleSelection);
        canvas.off('selection:updated', handleSelection);
        canvas.off('selection:cleared', handleSelectionCleared);
      };
    }, [selectNode, onNodeSelect]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handleObjectMoving = (event: { target?: unknown }) => {
        const target = event.target;
        if (target && target instanceof FabricImage) {
          const id = (target as FabricImage & { id?: string }).id;
          if (id) {
            target.setCoords();
            refreshNodePosition(id, target);
          }
        }
        canvas.clearContext(canvas.contextTop);
        canvas.requestRenderAll();
        updateOverlayTransform();
      };

      const handleObjectModified = (event: { target?: unknown }) => {
        const target = event.target;
        if (target && target instanceof FabricImage) {
          const id = (target as FabricImage & { id?: string }).id;
          if (id) {
            refreshNodePosition(id, target);
            updateNode(id, {
              position: { x: target.left || 0, y: target.top || 0 },
              scale: target.scaleX || 1,
              rotation: target.angle || 0,
            });
          }
        }
        canvas.clearContext(canvas.contextTop);
        canvas.requestRenderAll();
        updateOverlayTransform();
      };

      canvas.on('object:moving', handleObjectMoving);
      canvas.on('object:modified', handleObjectModified);

      return () => {
        canvas.off('object:moving', handleObjectMoving);
        canvas.off('object:modified', handleObjectModified);
      };
    }, [refreshNodePosition, updateNode, updateOverlayTransform]);

    const openMenuForObject = useCallback((nodeId: string, x: number, y: number) => {
      selectNode(nodeId);
      onNodeSelect?.(nodeId);

      setMenuState({
        visible: true,
        nodeId,
        position: { x, y },
      });
    }, [selectNode, onNodeSelect]);

    const selectOrConnectNode = useCallback((nodeId: string) => {
      selectNode(nodeId);
      onNodeSelect?.(nodeId);

      if (connectingFromId && connectingFromId !== nodeId) {
        completeConnection(nodeId);
        closeMenu();
      }
    }, [closeMenu, completeConnection, connectingFromId, selectNode, onNodeSelect]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handleContextMenu = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.canvas-container')) return;

        event.preventDefault();
        const pointer = canvas.getPointer(event);

        for (const object of canvas.getObjects()) {
          if (object instanceof FabricImage && object.containsPoint(pointer)) {
            const id = (object as FabricImage & { id?: string }).id;
            if (id) openMenuForObject(id, event.clientX, event.clientY);
            return;
          }
        }
      };

      window.addEventListener('contextmenu', handleContextMenu);
      return () => {
        window.removeEventListener('contextmenu', handleContextMenu);
      };
    }, [openMenuForObject]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handleWheel = (eventInfo: TPointerEventInfo<WheelEvent>) => {
        const event = eventInfo.e;
        event.preventDefault();
        event.stopPropagation();

        let zoom = canvas.getZoom();
        zoom *= 0.999 ** event.deltaY;
        zoom = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zoom));

        const pointer = canvas.getPointer(event as unknown as PointerEvent);
        canvas.zoomToPoint(new Point(pointer.x, pointer.y), zoom);
        updateOverlayTransform();
      };

      canvas.on('mouse:wheel', handleWheel);

      return () => {
        canvas.off('mouse:wheel', handleWheel);
      };
    }, [updateOverlayTransform]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      let spacePressed = false;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.code === 'Space' && !spacePressed) {
          spacePressed = true;
          canvas.defaultCursor = 'grab';
          canvas.selection = false;
        }
        if (event.code === 'Escape' && menuState.visible) {
          closeMenu();
        }
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        if (event.code === 'Space') {
          spacePressed = false;
          canvas.defaultCursor = 'default';
          canvas.selection = true;
          isPanningRef.current = false;
          canvas.renderAll();
        }
      };

      const handleMouseDown = (eventInfo: TPointerEventInfo<TPointerEvent>) => {
        const event = eventInfo.e as MouseEvent;
        const target = eventInfo.target;
        const targetId = target instanceof FabricImage
          ? (target as FabricImage & { id?: string }).id || null
          : null;

        clickStartRef.current = { x: event.clientX, y: event.clientY, targetId };
        hasDraggedRef.current = false;

        const isBoardRightDrag = event.button === 2 && !targetId;

        if (spacePressed || event.button === 1 || isBoardRightDrag) {
          event.preventDefault();
          isPanningRef.current = true;
          canvas.defaultCursor = 'grabbing';
          lastPosRef.current = { x: event.clientX, y: event.clientY };
          canvas.selection = false;
          closeMenu();
        }
      };

      const handleMouseMove = (eventInfo: TPointerEventInfo<TPointerEvent>) => {
        const event = eventInfo.e as MouseEvent;
        const start = clickStartRef.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
          hasDraggedRef.current = true;
        }

        if (isPanningRef.current) {
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] += event.clientX - lastPosRef.current.x;
            vpt[5] += event.clientY - lastPosRef.current.y;
            canvas.requestRenderAll();
            updateOverlayTransform();
            lastPosRef.current = { x: event.clientX, y: event.clientY };
          }
        }
      };

      const handleMouseUp = (eventInfo: TPointerEventInfo<TPointerEvent>) => {
        const event = eventInfo.e as MouseEvent;
        const wasPanning = isPanningRef.current;

        if (isPanningRef.current) {
          isPanningRef.current = false;
          if (!spacePressed) {
            canvas.defaultCursor = 'default';
            canvas.selection = true;
          } else {
            canvas.defaultCursor = 'grab';
          }
        }

        const start = clickStartRef.current;
        if (!wasPanning && !hasDraggedRef.current && event.button === 0 && start?.targetId) {
          selectOrConnectNode(start.targetId);
        }
        clickStartRef.current = null;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [closeMenu, menuState.visible, selectOrConnectNode, updateOverlayTransform]);

    const handleMenuAnnotate = useCallback(() => {
      const node = menuState.nodeId ? getNodeById(menuState.nodeId) : null;
      if (!node) return;

      setAnnotationState({
        visible: true,
        nodeId: node.id,
        currentAnnotation: node.annotation || '',
      });
    }, [menuState.nodeId, getNodeById]);

    const handleMenuRegenerate = useCallback(
      async (model: ModelType, prompt: string) => {
        const node = menuState.nodeId ? getNodeById(menuState.nodeId) : null;
        if (!node) return;
        if (!hasApiKey()) {
          throw new Error('Please configure your API key first');
        }

        setRegeneratingNodeId(node.id);
        try {
          const chainNodes = getOrderedNodeChain(nodes, node.id);
          const references: PromptReference[] = canvasNodesToPromptReferences(
            chainNodes.length > 0 ? chainNodes : [node],
          );

          if (config.refImage) {
            references.push({
              imageData: config.refImage,
              label: `Image ${references.length + 1}`,
              annotation: 'Manual reference image from the sidebar.',
            });
          }

          const requestConfig = sanitizeGenerationConfig({ ...config, model, prompt });
          const contextualPrompt = buildPromptWithReferences(prompt, references);
          const refImages = references.map((reference) => reference.imageData);
          const useThinking =
            isThinkingSupported(requestConfig.model) &&
            requestConfig.thinkingLevel &&
            requestConfig.thinkingLevel !== 'off';

          const response = useThinking
            ? await generateImageWithThinking({
                model: requestConfig.model,
                prompt: contextualPrompt,
                aspect_ratio: requestConfig.aspectRatio,
                image_size: requestConfig.imageSize,
                width: requestConfig.width,
                height: requestConfig.height,
                ref_images: refImages,
                thinkingLevel: requestConfig.thinkingLevel !== 'off'
                  ? requestConfig.thinkingLevel
                  : undefined,
                thinkingBudget: requestConfig.thinkingBudget,
              })
            : await generateImage({
                model: requestConfig.model,
                prompt: contextualPrompt,
                aspect_ratio: requestConfig.aspectRatio,
                image_size: requestConfig.imageSize,
                width: requestConfig.width,
                height: requestConfig.height,
                ref_images: refImages,
              });

          const version: CanvasNodeVersion = {
            id: crypto.randomUUID(),
            imageData: response.image,
            createdAt: new Date(),
            prompt,
            model,
            tokenUsed: response.token_used,
          };

          addVersion(node.id, version, true);
          recordUsage(response.token_used);
        } finally {
          setRegeneratingNodeId(null);
        }
      },
      [addVersion, config, getNodeById, menuState.nodeId, nodes, recordUsage],
    );

    const handleMenuDelete = useCallback(() => {
      if (!menuState.nodeId) return;

      const canvas = fabricCanvasRef.current;
      if (canvas) {
        const target = canvas.getObjects().find(
          (object) =>
            object instanceof FabricImage &&
            (object as FabricImage & { id?: string }).id === menuState.nodeId,
        );
        if (target) {
          canvas.remove(target);
          canvas.renderAll();
        }
      }

      removeNode(menuState.nodeId);
      closeMenu();
    }, [closeMenu, menuState.nodeId, removeNode]);

    const handleAnnotationSave = useCallback(
      (newAnnotation: string) => {
        if (annotationState.nodeId) {
          setAnnotation(annotationState.nodeId, newAnnotation);
        }
        setAnnotationState({ visible: false, nodeId: null, currentAnnotation: '' });
      },
      [annotationState.nodeId, setAnnotation],
    );

    const renderConnections = () => (
      <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
        {nodes.flatMap((node) =>
          (node.connectedTo || []).map((targetId) => {
            const from = nodePositionRef.current.get(node.id);
            const to = nodePositionRef.current.get(targetId);
            if (!from || !to) return null;

            const fromCenter = getNodeCenter(from);
            const toCenter = getNodeCenter(to);
            const fromAnchor = getRectEdgePoint(from, toCenter);
            const toAnchor = getRectEdgePoint(to, fromCenter);
            const path = `M ${fromAnchor.x} ${fromAnchor.y} L ${toAnchor.x} ${toAnchor.y}`;

            return (
              <g key={`${node.id}-${targetId}`}>
                <path
                  d={path}
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray="6 6"
                />
                <circle
                  cx={fromAnchor.x}
                  cy={fromAnchor.y}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                />
                <circle
                  cx={toAnchor.x}
                  cy={toAnchor.y}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                />
              </g>
            );
          }),
        )}
      </svg>
    );

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <canvas ref={canvasRef} />

        <div
          ref={overlayRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        >
          {renderConnections()}

          {nodes.map((node) => {
            const pos = nodePositionRef.current.get(node.id);
            if (!pos) return null;
            const label = node.annotation || node.prompt || 'Image node';
            const isConnectionStart = connectingFromId === node.id;

            return (
              <div
                key={node.id}
                className="absolute pointer-events-none"
                style={{
                  left: pos.x,
                  top: pos.y + pos.height + 8,
                  width: Math.max(pos.width, 128),
                }}
              >
                <div className="inline-flex max-w-full items-center gap-2 rounded-container border border-border-light bg-white/95 px-3 py-1.5 shadow-sm">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      isConnectionStart ? 'bg-black ring-4 ring-black/15' : 'bg-stone'
                    }`}
                  />
                  <span className="truncate text-xs font-sans text-near-black">{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {connectingFromId && (
          <div className="absolute bottom-6 right-6 z-50 bg-white text-near-black px-4 py-2 rounded-container border border-border-light shadow-lg text-sm font-sans flex items-center gap-3">
            <span>Click another image node to connect</span>
            <button onClick={cancelConnection} className="underline hover:no-underline">
              Cancel
            </button>
          </div>
        )}

        {menuState.visible && menuState.nodeId && getNodeById(menuState.nodeId) && (
          <ImageNodeMenu
            key={menuState.nodeId}
            node={getNodeById(menuState.nodeId)!}
            position={menuState.position}
            defaultModel={config.model}
            connectingFromId={connectingFromId}
            regenerating={regeneratingNodeId === menuState.nodeId}
            onClose={closeMenu}
            onAnnotate={() => {
              handleMenuAnnotate();
            }}
            onStartConnection={() => {
              startConnection(menuState.nodeId!);
              closeMenu();
            }}
            onCompleteConnection={() => {
              completeConnection(menuState.nodeId!);
              closeMenu();
            }}
            onCancelConnection={() => {
              cancelConnection();
              closeMenu();
            }}
            onRemoveConnections={() => {
              removeAllConnections(menuState.nodeId!);
              closeMenu();
            }}
            onRegenerate={handleMenuRegenerate}
            onSelectVersion={(versionId) => selectVersion(menuState.nodeId!, versionId)}
            onDelete={handleMenuDelete}
          />
        )}

        {annotationState.visible && (
          <ImageAnnotationModal
            initialAnnotation={annotationState.currentAnnotation}
            onSave={handleAnnotationSave}
            onCancel={() => setAnnotationState({ visible: false, nodeId: null, currentAnnotation: '' })}
          />
        )}
      </div>
    );
  },
);

InfiniteCanvas.displayName = 'InfiniteCanvas';

export default InfiniteCanvas;
