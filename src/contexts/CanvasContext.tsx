import React, { createContext, useContext, useReducer, useMemo} from 'react';
import type { CanvasNode, CanvasNodeVersion } from '../types';

interface CanvasState {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  connectingFromId: string | null;
}

type CanvasAction =
  | { type: 'ADD_NODE'; payload: CanvasNode }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<CanvasNode> } }
  | { type: 'REMOVE_NODE'; payload: string }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'ADD_VERSION'; payload: { nodeId: string; version: CanvasNodeVersion; activate?: boolean } }
  | { type: 'SELECT_VERSION'; payload: { nodeId: string; versionId: string } }
  | { type: 'SET_ANNOTATION'; payload: { nodeId: string; annotation: string } }
  | { type: 'START_CONNECTION'; payload: string }
  | { type: 'COMPLETE_CONNECTION'; payload: string }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'REMOVE_CONNECTION'; payload: { fromId: string; toId: string } }
  | { type: 'REMOVE_ALL_CONNECTIONS'; payload: string };

export interface CanvasContextValue {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  connectingFromId: string | null;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  addVersion: (nodeId: string, version: CanvasNodeVersion, activate?: boolean) => void;
  selectVersion: (nodeId: string, versionId: string) => void;
  setAnnotation: (nodeId: string, annotation: string) => void;
  startConnection: (nodeId: string) => void;
  completeConnection: (nodeId: string) => void;
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

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'ADD_NODE':
      return {
        ...state,
        nodes: [...state.nodes, action.payload],
        selectedNodeId: action.payload.id,
      };

    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.id
            ? { ...node, ...action.payload.updates }
            : node
        ),
      };

    case 'REMOVE_NODE': {
      const nodeId = action.payload;
      return {
        ...state,
        nodes: state.nodes
          .filter((node) => node.id !== nodeId)
          .map((node) => ({
            ...node,
            connectedTo: node.connectedTo?.filter((id) => id !== nodeId),
            connectedFrom: node.connectedFrom === nodeId ? undefined : node.connectedFrom,
          })),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        connectingFromId: state.connectingFromId === nodeId ? null : state.connectingFromId,
      };
    }

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.payload,
      };

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
      const toId = action.payload;
      if (!fromId || fromId === toId) {
        return { ...state, connectingFromId: null };
      }
      const target = state.nodes.find((node) => node.id === toId);
      const previousFromId = target?.connectedFrom;
      return {
        ...state,
        connectingFromId: null,
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
  connectingFromId: null,
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

interface CanvasProviderProps {
  children: React.ReactNode;
}

function CanvasProvider({ children }: CanvasProviderProps) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);

  const contextValue = useMemo<CanvasContextValue>(
    () => ({
      nodes: state.nodes,
      selectedNodeId: state.selectedNodeId,
      connectingFromId: state.connectingFromId,
      addNode: (node: CanvasNode) => dispatch({ type: 'ADD_NODE', payload: node }),
      updateNode: (id: string, updates: Partial<CanvasNode>) =>
        dispatch({ type: 'UPDATE_NODE', payload: { id, updates } }),
      removeNode: (id: string) => dispatch({ type: 'REMOVE_NODE', payload: id }),
      selectNode: (id: string | null) => dispatch({ type: 'SELECT_NODE', payload: id }),
      addVersion: (nodeId: string, version: CanvasNodeVersion, activate?: boolean) =>
        dispatch({ type: 'ADD_VERSION', payload: { nodeId, version, activate } }),
      selectVersion: (nodeId: string, versionId: string) =>
        dispatch({ type: 'SELECT_VERSION', payload: { nodeId, versionId } }),
      setAnnotation: (nodeId: string, annotation: string) =>
        dispatch({ type: 'SET_ANNOTATION', payload: { nodeId, annotation } }),
      startConnection: (nodeId: string) =>
        dispatch({ type: 'START_CONNECTION', payload: nodeId }),
      completeConnection: (nodeId: string) =>
        dispatch({ type: 'COMPLETE_CONNECTION', payload: nodeId }),
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
    [state.nodes, state.selectedNodeId, state.connectingFromId]
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
