import React, { createContext, useCallback, useContext, useReducer, useMemo} from 'react';
import type { CanvasNode, CanvasNodeVersion } from '../types';

interface CanvasState {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  connectingFromId: string | null;
}

type CanvasAction =
  | { type: 'ADD_NODE'; payload: CanvasNode }
  | { type: 'RESTORE_STATE'; payload: { nodes: CanvasNode[]; selectedNodeId: string | null } }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<CanvasNode> } }
  | { type: 'UPDATE_NODES'; payload: Array<{ id: string; updates: Partial<CanvasNode> }> }
  | { type: 'REMOVE_NODE'; payload: string }
  | { type: 'REMOVE_NODES'; payload: string[] }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'SELECT_NODES'; payload: string[] }
  | { type: 'ADD_VERSION'; payload: { nodeId: string; version: CanvasNodeVersion; activate?: boolean } }
  | { type: 'SELECT_VERSION'; payload: { nodeId: string; versionId: string } }
  | { type: 'SET_ANNOTATION'; payload: { nodeId: string; annotation: string } }
  | { type: 'START_CONNECTION'; payload: string }
  | { type: 'COMPLETE_CONNECTION'; payload: { toId: string; keepConnecting?: boolean } }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'REMOVE_CONNECTION'; payload: { fromId: string; toId: string } }
  | { type: 'REMOVE_ALL_CONNECTIONS'; payload: string };

export interface CanvasContextValue {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  connectingFromId: string | null;
  addNode: (node: CanvasNode) => void;
  restoreState: (nodes: CanvasNode[], selectedNodeId: string | null) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  updateNodes: (updates: Array<{ id: string; updates: Partial<CanvasNode> }>) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  selectNode: (id: string | null) => void;
  selectNodes: (ids: string[]) => void;
  addVersion: (nodeId: string, version: CanvasNodeVersion, activate?: boolean) => void;
  selectVersion: (nodeId: string, versionId: string) => void;
  setAnnotation: (nodeId: string, annotation: string) => void;
  startConnection: (nodeId: string) => void;
  completeConnection: (nodeId: string, options?: { keepConnecting?: boolean }) => void;
  cancelConnection: () => void;
  removeConnection: (fromId: string, toId: string) => void;
  removeAllConnections: (nodeId: string) => void;
  getNodeById: (id: string) => CanvasNode | undefined;
  getConnectedNodes: (nodeId: string) => { from: CanvasNode | undefined; to: CanvasNode[] };
}

function getNodeVersions(node: CanvasNode): CanvasNodeVersion[] {
  if (node.versions && node.versions.length > 0) {
    return node.versions;
  }

  return [
    {
      id: node.activeVersionId || `${node.id}-initial`,
      imageData: node.imageData,
      createdAt: node.createdAt,
      prompt: node.prompt,
      model: node.model,
      tokenUsed: node.tokenUsed,
    },
  ];
}

function dedupeNodeIds(ids: string[], nodes: CanvasNode[]): string[] {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const selectedIds: string[] = [];

  ids.forEach((id) => {
    if (!validNodeIds.has(id) || selectedIds.includes(id)) return;
    selectedIds.push(id);
  });

  return selectedIds;
}

function removeNodeIds(state: CanvasState, nodeIds: string[]): CanvasState {
  const removedNodeIds = new Set(nodeIds);
  if (removedNodeIds.size === 0) return state;

  const nodes = state.nodes
    .filter((node) => !removedNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      connectedTo: node.connectedTo?.filter((id) => !removedNodeIds.has(id)),
      connectedFrom: node.connectedFrom && removedNodeIds.has(node.connectedFrom)
        ? undefined
        : node.connectedFrom,
    }));
  const selectedNodeIds = state.selectedNodeIds.filter((id) => !removedNodeIds.has(id));
  const selectedNodeId = state.selectedNodeId && !removedNodeIds.has(state.selectedNodeId)
    ? state.selectedNodeId
    : selectedNodeIds[0] || null;

  return {
    ...state,
    nodes,
    selectedNodeId,
    selectedNodeIds,
    connectingFromId: state.connectingFromId && removedNodeIds.has(state.connectingFromId)
      ? null
      : state.connectingFromId,
  };
}

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'ADD_NODE':
      return {
        ...state,
        nodes: [...state.nodes, action.payload],
        selectedNodeId: action.payload.id,
        selectedNodeIds: [action.payload.id],
      };

    case 'RESTORE_STATE': {
      const selectedNodeIds = dedupeNodeIds(
        action.payload.selectedNodeId ? [action.payload.selectedNodeId] : [],
        action.payload.nodes,
      );

      return {
        nodes: action.payload.nodes,
        selectedNodeId: selectedNodeIds[0] || null,
        selectedNodeIds,
        connectingFromId: null,
      };
    }

    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.id
            ? { ...node, ...action.payload.updates }
            : node
        ),
      };

    case 'UPDATE_NODES': {
      const updatesById = new Map(
        action.payload.map(({ id, updates }) => [id, updates]),
      );
      if (updatesById.size === 0) return state;

      return {
        ...state,
        nodes: state.nodes.map((node) => {
          const updates = updatesById.get(node.id);
          return updates ? { ...node, ...updates } : node;
        }),
      };
    }

    case 'REMOVE_NODE':
      return removeNodeIds(state, [action.payload]);

    case 'REMOVE_NODES':
      return removeNodeIds(state, action.payload);

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.payload,
        selectedNodeIds: action.payload ? [action.payload] : [],
      };

    case 'SELECT_NODES': {
      const selectedNodeIds = dedupeNodeIds(action.payload, state.nodes);
      return {
        ...state,
        selectedNodeId: selectedNodeIds[0] || null,
        selectedNodeIds,
      };
    }

    case 'ADD_VERSION':
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.nodeId
            ? (() => {
                const versions = getNodeVersions(node);
                const nextVersions = versions.some((version) => version.id === action.payload.version.id)
                  ? versions
                  : [...versions, action.payload.version];

                if (!action.payload.activate) {
                  return { ...node, versions: nextVersions };
                }

                return {
                  ...node,
                  imageData: action.payload.version.imageData,
                  prompt: action.payload.version.prompt,
                  model: action.payload.version.model,
                  tokenUsed: action.payload.version.tokenUsed,
                  versions: nextVersions,
                  activeVersionId: action.payload.version.id,
                };
              })()
            : node
        ),
      };

    case 'SELECT_VERSION':
      return {
        ...state,
        nodes: state.nodes.map((node) => {
          if (node.id !== action.payload.nodeId) return node;
          const versions = getNodeVersions(node);
          const selectedVersion = versions.find((version) => version.id === action.payload.versionId);
          if (!selectedVersion) return { ...node, versions };

          return {
            ...node,
            imageData: selectedVersion.imageData,
            prompt: selectedVersion.prompt,
            model: selectedVersion.model,
            tokenUsed: selectedVersion.tokenUsed,
            versions,
            activeVersionId: selectedVersion.id,
          };
        }),
      };

    case 'SET_ANNOTATION':
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.nodeId
            ? { ...node, annotation: action.payload.annotation }
            : node
        ),
      };

    case 'START_CONNECTION':
      return {
        ...state,
        connectingFromId: action.payload,
      };

    case 'COMPLETE_CONNECTION': {
      const fromId = state.connectingFromId;
      const { toId, keepConnecting } = action.payload;
      if (!fromId || fromId === toId) {
        return { ...state, connectingFromId: keepConnecting && fromId ? fromId : null };
      }
      const target = state.nodes.find((node) => node.id === toId);
      const previousFromId = target?.connectedFrom;
      return {
        ...state,
        connectingFromId: keepConnecting ? fromId : null,
        nodes: state.nodes.map((node) => {
          if (node.id === toId) {
            return {
              ...node,
              connectedFrom: fromId,
            };
          }
          if (node.id === fromId) {
            const connectedTo = (node.connectedTo || []).filter((id) => id !== toId);
            return {
              ...node,
              connectedTo: [...connectedTo, toId],
            };
          }
          if (previousFromId && node.id === previousFromId) {
            return {
              ...node,
              connectedTo: node.connectedTo?.filter((id) => id !== toId),
            };
          }
          return node;
        }),
      };
    }

    case 'CANCEL_CONNECTION':
      return {
        ...state,
        connectingFromId: null,
      };

    case 'REMOVE_CONNECTION': {
      const { fromId, toId } = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((node) => {
          if (node.id === toId) {
            return {
              ...node,
              connectedFrom: node.connectedFrom === fromId ? undefined : node.connectedFrom,
              connectedTo: node.connectedTo?.filter((id) => id !== fromId),
            };
          }
          if (node.id === fromId) {
            return {
              ...node,
              connectedTo: node.connectedTo?.filter((id) => id !== toId),
            };
          }
          return node;
        }),
      };
    }

    case 'REMOVE_ALL_CONNECTIONS': {
      const nodeId = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              connectedFrom: undefined,
              connectedTo: [],
            };
          }
          return {
            ...node,
            connectedTo: node.connectedTo?.filter((id) => id !== nodeId),
            connectedFrom: node.connectedFrom === nodeId ? undefined : node.connectedFrom,
          };
        }),
      };
    }

    default:
      return state;
  }
}

const initialState: CanvasState = {
  nodes: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  connectingFromId: null,
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

interface CanvasProviderProps {
  children: React.ReactNode;
}

function CanvasProvider({ children }: CanvasProviderProps) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  const restoreState = useCallback((nodes: CanvasNode[], selectedNodeId: string | null) => {
    dispatch({ type: 'RESTORE_STATE', payload: { nodes, selectedNodeId } });
  }, []);

  const contextValue = useMemo<CanvasContextValue>(
    () => ({
      nodes: state.nodes,
      selectedNodeId: state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds,
      connectingFromId: state.connectingFromId,
      addNode: (node: CanvasNode) => dispatch({ type: 'ADD_NODE', payload: node }),
      restoreState,
      updateNode: (id: string, updates: Partial<CanvasNode>) =>
        dispatch({ type: 'UPDATE_NODE', payload: { id, updates } }),
      updateNodes: (updates: Array<{ id: string; updates: Partial<CanvasNode> }>) =>
        dispatch({ type: 'UPDATE_NODES', payload: updates }),
      removeNode: (id: string) => dispatch({ type: 'REMOVE_NODE', payload: id }),
      removeNodes: (ids: string[]) => dispatch({ type: 'REMOVE_NODES', payload: ids }),
      selectNode: (id: string | null) => dispatch({ type: 'SELECT_NODE', payload: id }),
      selectNodes: (ids: string[]) => dispatch({ type: 'SELECT_NODES', payload: ids }),
      addVersion: (nodeId: string, version: CanvasNodeVersion, activate?: boolean) =>
        dispatch({ type: 'ADD_VERSION', payload: { nodeId, version, activate } }),
      selectVersion: (nodeId: string, versionId: string) =>
        dispatch({ type: 'SELECT_VERSION', payload: { nodeId, versionId } }),
      setAnnotation: (nodeId: string, annotation: string) =>
        dispatch({ type: 'SET_ANNOTATION', payload: { nodeId, annotation } }),
      startConnection: (nodeId: string) =>
        dispatch({ type: 'START_CONNECTION', payload: nodeId }),
      completeConnection: (nodeId: string, options?: { keepConnecting?: boolean }) =>
        dispatch({
          type: 'COMPLETE_CONNECTION',
          payload: { toId: nodeId, keepConnecting: options?.keepConnecting },
        }),
      cancelConnection: () => dispatch({ type: 'CANCEL_CONNECTION' }),
      removeConnection: (fromId: string, toId: string) =>
        dispatch({ type: 'REMOVE_CONNECTION', payload: { fromId, toId } }),
      removeAllConnections: (nodeId: string) =>
        dispatch({ type: 'REMOVE_ALL_CONNECTIONS', payload: nodeId }),
      getNodeById: (id: string) => state.nodes.find((node) => node.id === id),
      getConnectedNodes: (nodeId: string) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        return {
          from: node?.connectedFrom ? state.nodes.find((n) => n.id === node.connectedFrom) : undefined,
          to: (node?.connectedTo || []).map((id) => state.nodes.find((n) => n.id === id)!).filter(Boolean),
        };
      },
    }),
    [restoreState, state.nodes, state.selectedNodeId, state.selectedNodeIds, state.connectingFromId]
  );

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
}

function useCanvasContext(): CanvasContextValue {
  const context = useContext(CanvasContext);
  if (context === null) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
}

export { CanvasContext, CanvasProvider, useCanvasContext };
