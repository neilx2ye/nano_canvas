import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CanvasNode, CanvasNodeVersion, GenerationConfig } from '../types';
import { buildImageFilename, dataUrlToBlob } from '../utils';
import { useCanvasContext } from './CanvasContext';
import { useConfigContext } from './ConfigContext';

type FileSystemPermissionMode = 'read' | 'readwrite';
type ArchiveOperation = 'generate' | 'regenerate' | 'edit' | 'sketch' | 'mask' | 'upload' | 'snapshot';

interface FileSystemPermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

interface FileSystemWritableFileStreamLike {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
}

interface FileSystemDirectoryHandleLike {
  name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandleLike>;
  queryPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandleLike>;
}

interface ArchiveImageRequest {
  imageData: string;
  prompt: string;
  nodeId: string;
  versionId: string;
  operation: ArchiveOperation;
  model: string;
  tokenUsed: number;
  createdAt?: Date;
}

interface ArchiveAssetRecord {
  versionId: string;
  nodeId: string;
  fileName: string;
  filePath: string;
  prompt: string;
  model: string;
  tokenUsed: number;
  operation: ArchiveOperation;
  createdAt: string;
  savedAt?: string;
  status: 'pending' | 'saved';
}

interface ArchiveEventRecord extends ArchiveAssetRecord {
  id: string;
}

interface SerializedCanvasNodeVersion {
  id: string;
  createdAt: string;
  prompt: string;
  model: string;
  tokenUsed: number;
  imageFile: string | null;
  archiveOperation: ArchiveOperation | null;
}

interface SerializedCanvasNode {
  id: string;
  annotation: string;
  position: CanvasNode['position'];
  scale: number;
  rotation: number;
  createdAt: string;
  prompt: string;
  model: string;
  tokenUsed: number;
  activeVersionId: string | null;
  connectedFrom: string | null;
  connectedTo: string[];
  versions: SerializedCanvasNodeVersion[];
}

interface ProjectConfigDocument {
  schemaVersion: 1;
  project: {
    name: string;
    updatedAt: string;
    configFile: string;
    imageDirectory: string;
  };
  generationConfig: GenerationConfig;
  canvas: {
    selectedNodeId: string | null;
    nodes: SerializedCanvasNode[];
    connections: Array<{ fromId: string; toId: string }>;
  };
  generationRecords: Array<{
    id: string;
    operation: ArchiveOperation;
    nodeId: string;
    versionId: string;
    imageFile: string;
    prompt: string;
    model: string;
    tokenUsed: number;
    createdAt: string;
    savedAt: string | null;
  }>;
}

export interface ProjectArchiveContextValue {
  projectName: string | null;
  isSupported: boolean;
  isReady: boolean;
  saving: boolean;
  configFileName: string;
  lastSavedLabel: string | null;
  error: string | null;
  selectProjectDirectory: () => Promise<void>;
  clearProjectDirectory: () => void;
  archiveGeneratedImage: (request: ArchiveImageRequest) => Promise<void>;
}

const DB_NAME = 'nano_canvas_project_archive';
const STORE_NAME = 'settings';
const DIRECTORY_KEY = 'projectDirectoryHandle';
const CONFIG_FILE_NAME = 'nano_canvas_project.json';
const IMAGE_DIRECTORY_NAME = 'images';

const ProjectArchiveContext = createContext<ProjectArchiveContextValue | null>(null);

function getDirectoryPicker(): WindowWithDirectoryPicker['showDirectoryPicker'] {
  return (window as WindowWithDirectoryPicker).showDirectoryPicker;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredDirectoryHandle(): Promise<FileSystemDirectoryHandleLike | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(DIRECTORY_KEY);

    request.onsuccess = () => {
      database.close();
      resolve((request.result as FileSystemDirectoryHandleLike | undefined) || null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function storeDirectoryHandle(handle: FileSystemDirectoryHandleLike): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);

    request.onsuccess = () => {
      database.close();
      resolve();
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function removeStoredDirectoryHandle(): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).delete(DIRECTORY_KEY);

    request.onsuccess = () => {
      database.close();
      resolve();
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function ensureWritePermission(handle: FileSystemDirectoryHandleLike): Promise<boolean> {
  const descriptor: FileSystemPermissionDescriptor = { mode: 'readwrite' };

  if (!handle.queryPermission || !handle.requestPermission) {
    return true;
  }

  if ((await handle.queryPermission(descriptor)) === 'granted') {
    return true;
  }

  return (await handle.requestPermission(descriptor)) === 'granted';
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

function buildNodeSignature(nodes: CanvasNode[], selectedNodeId: string | null): string {
  return JSON.stringify({
    selectedNodeId,
    nodes: nodes.map((node) => ({
      id: node.id,
      annotation: node.annotation || '',
      position: node.position,
      scale: node.scale,
      rotation: node.rotation,
      activeVersionId: node.activeVersionId || null,
      connectedFrom: node.connectedFrom || null,
      connectedTo: node.connectedTo || [],
      versions: getNodeVersions(node).map((version) => ({
        id: version.id,
        createdAt: toIsoString(version.createdAt),
        prompt: version.prompt,
        model: version.model,
        tokenUsed: version.tokenUsed,
      })),
    })),
  });
}

export function ProjectArchiveProvider({ children }: { children: React.ReactNode }) {
  const { nodes, selectedNodeId } = useCanvasContext();
  const { config } = useConfigContext();

  const projectHandleRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const assetsRef = useRef<Record<string, ArchiveAssetRecord>>({});
  const generationRecordsRef = useRef<ArchiveEventRecord[]>([]);
  const latestNodesRef = useRef(nodes);
  const latestSelectedNodeIdRef = useRef(selectedNodeId);
  const latestConfigRef = useRef(config);
  const previousNodeSignatureRef = useRef<string | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOperationsRef = useRef(0);

  const [projectName, setProjectName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSupported = Boolean(getDirectoryPicker() && window.indexedDB);

  latestNodesRef.current = nodes;
  latestSelectedNodeIdRef.current = selectedNodeId;
  latestConfigRef.current = config;

  const startOperation = useCallback(() => {
    activeOperationsRef.current += 1;
    setSaving(true);

    return () => {
      activeOperationsRef.current = Math.max(0, activeOperationsRef.current - 1);
      if (activeOperationsRef.current === 0) {
        setSaving(false);
      }
    };
  }, []);

  const getImageDirectory = useCallback(async (projectHandle: FileSystemDirectoryHandleLike) => {
    return projectHandle.getDirectoryHandle(IMAGE_DIRECTORY_NAME, { create: true });
  }, []);

  const writeTextFile = useCallback(
    async (directoryHandle: FileSystemDirectoryHandleLike, fileName: string, content: string) => {
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    },
    [],
  );

  const writeImageFile = useCallback(
    async (
      projectHandle: FileSystemDirectoryHandleLike,
      fileName: string,
      imageData: string,
    ) => {
      const imageDirectory = await getImageDirectory(projectHandle);
      const fileHandle = await imageDirectory.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(dataUrlToBlob(imageData));
      await writable.close();
    },
    [getImageDirectory],
  );

  const buildProjectConfigDocument = useCallback((): ProjectConfigDocument | null => {
    if (!projectHandleRef.current) return null;

    const assetRecords = assetsRef.current;
    const currentNodes = latestNodesRef.current;
    const connections = currentNodes.flatMap((node) =>
      (node.connectedTo || []).map((targetId) => ({
        fromId: node.id,
        toId: targetId,
      })),
    );

    return {
      schemaVersion: 1,
      project: {
        name: projectHandleRef.current.name,
        updatedAt: new Date().toISOString(),
        configFile: CONFIG_FILE_NAME,
        imageDirectory: IMAGE_DIRECTORY_NAME,
      },
      generationConfig: latestConfigRef.current,
      canvas: {
        selectedNodeId: latestSelectedNodeIdRef.current,
        nodes: currentNodes.map((node): SerializedCanvasNode => ({
          id: node.id,
          annotation: node.annotation || '',
          position: node.position,
          scale: node.scale,
          rotation: node.rotation,
          createdAt: toIsoString(node.createdAt),
          prompt: node.prompt,
          model: node.model,
          tokenUsed: node.tokenUsed,
          activeVersionId: node.activeVersionId || null,
          connectedFrom: node.connectedFrom || null,
          connectedTo: node.connectedTo || [],
          versions: getNodeVersions(node).map((version): SerializedCanvasNodeVersion => {
            const asset = assetRecords[version.id];
            const savedAsset = asset?.status === 'saved' ? asset : null;

            return {
              id: version.id,
              createdAt: toIsoString(version.createdAt),
              prompt: version.prompt,
              model: version.model,
              tokenUsed: version.tokenUsed,
              imageFile: savedAsset?.filePath || null,
              archiveOperation: savedAsset?.operation || null,
            };
          }),
        })),
        connections,
      },
      generationRecords: generationRecordsRef.current
        .filter((record) => record.status === 'saved')
        .map((record) => ({
          id: record.id,
          operation: record.operation,
          nodeId: record.nodeId,
          versionId: record.versionId,
          imageFile: record.filePath,
          prompt: record.prompt,
          model: record.model,
          tokenUsed: record.tokenUsed,
          createdAt: record.createdAt,
          savedAt: record.savedAt || null,
        })),
    };
  }, []);

  const writeProjectConfig = useCallback(async () => {
    const projectHandle = projectHandleRef.current;
    if (!projectHandle) return;

    const hasPermission = await ensureWritePermission(projectHandle);
    if (!hasPermission) {
      setError('Write permission was not granted for this project folder.');
      return;
    }

    const endOperation = startOperation();

    try {
      const document = buildProjectConfigDocument();
      if (!document) return;

      await getImageDirectory(projectHandle);
      await writeTextFile(
        projectHandle,
        CONFIG_FILE_NAME,
        `${JSON.stringify(document, null, 2)}\n`,
      );
      setLastSavedLabel(CONFIG_FILE_NAME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write project config.');
    } finally {
      endOperation();
    }
  }, [buildProjectConfigDocument, getImageDirectory, startOperation, writeTextFile]);

  const scheduleProjectConfigWrite = useCallback(() => {
    if (!projectHandleRef.current) return;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = setTimeout(() => {
      writeTimerRef.current = null;
      void writeProjectConfig();
    }, 250);
  }, [writeProjectConfig]);

  const archiveImage = useCallback(
    async (request: ArchiveImageRequest) => {
      const projectHandle = projectHandleRef.current;
      if (!projectHandle) return;

      const createdAt = request.createdAt || new Date();
      const fileName = buildImageFilename(
        request.imageData,
        request.prompt,
        createdAt,
        request.operation,
      );
      const filePath = `${IMAGE_DIRECTORY_NAME}/${fileName}`;
      const asset: ArchiveAssetRecord = {
        versionId: request.versionId,
        nodeId: request.nodeId,
        fileName,
        filePath,
        prompt: request.prompt,
        model: request.model,
        tokenUsed: request.tokenUsed,
        operation: request.operation,
        createdAt: toIsoString(createdAt),
        status: 'pending',
      };

      assetsRef.current = {
        ...assetsRef.current,
        [request.versionId]: asset,
      };

      if (!generationRecordsRef.current.some((record) => record.versionId === request.versionId)) {
        generationRecordsRef.current = [
          ...generationRecordsRef.current,
          {
            ...asset,
            id: crypto.randomUUID(),
          },
        ];
      }

      const endOperation = startOperation();
      setError(null);
      scheduleProjectConfigWrite();

      try {
        const hasPermission = await ensureWritePermission(projectHandle);
        if (!hasPermission) {
          throw new Error('Write permission was not granted for this project folder.');
        }

        await writeImageFile(projectHandle, fileName, request.imageData);
        const savedAsset: ArchiveAssetRecord = {
          ...asset,
          status: 'saved',
          savedAt: new Date().toISOString(),
        };

        assetsRef.current = {
          ...assetsRef.current,
          [request.versionId]: savedAsset,
        };
        generationRecordsRef.current = generationRecordsRef.current.map((record) =>
          record.versionId === request.versionId
            ? { ...record, status: 'saved', savedAt: savedAsset.savedAt }
            : record,
        );
        setLastSavedLabel(filePath);
        scheduleProjectConfigWrite();
      } catch (err) {
        const nextAssets = { ...assetsRef.current };
        delete nextAssets[request.versionId];
        assetsRef.current = nextAssets;
        generationRecordsRef.current = generationRecordsRef.current.filter(
          (record) => record.versionId !== request.versionId,
        );
        setError(err instanceof Error ? err.message : 'Could not archive generated image.');
        scheduleProjectConfigWrite();
      } finally {
        endOperation();
      }
    },
    [scheduleProjectConfigWrite, startOperation, writeImageFile],
  );

  const archiveGeneratedImage = useCallback(
    async (request: ArchiveImageRequest) => {
      await archiveImage(request);
    },
    [archiveImage],
  );

  const ensureMissingNodeImagesArchived = useCallback(async () => {
    const projectHandle = projectHandleRef.current;
    if (!projectHandle) return;

    for (const node of latestNodesRef.current) {
      for (const version of getNodeVersions(node)) {
        if (assetsRef.current[version.id]) continue;

        await archiveImage({
          imageData: version.imageData,
          prompt: version.prompt || node.annotation || 'image',
          nodeId: node.id,
          versionId: version.id,
          operation: node.model === 'uploaded' ? 'upload' : 'snapshot',
          model: version.model,
          tokenUsed: version.tokenUsed,
          createdAt: version.createdAt,
        });
      }
    }
  }, [archiveImage]);

  useEffect(() => {
    let active = true;

    if (!isSupported) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    readStoredDirectoryHandle()
      .then((handle) => {
        if (!active || !handle) return;
        projectHandleRef.current = handle;
        setProjectName(handle.name);
      })
      .catch(() => {
        if (active) {
          setError('Could not restore the project folder.');
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [isSupported]);

  useEffect(() => {
    const signature = buildNodeSignature(nodes, selectedNodeId);

    if (previousNodeSignatureRef.current === null) {
      previousNodeSignatureRef.current = signature;
      return;
    }

    if (previousNodeSignatureRef.current === signature) return;
    previousNodeSignatureRef.current = signature;

    if (!projectHandleRef.current) return;

    void ensureMissingNodeImagesArchived().then(() => {
      scheduleProjectConfigWrite();
    });
  }, [ensureMissingNodeImagesArchived, nodes, scheduleProjectConfigWrite, selectedNodeId]);

  useEffect(() => {
    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, []);

  const selectProjectDirectory = useCallback(async () => {
    const showDirectoryPicker = getDirectoryPicker();
    if (!showDirectoryPicker) {
      setError('Project folders are not supported in this browser.');
      return;
    }

    setError(null);

    try {
      const handle = await showDirectoryPicker({ mode: 'readwrite' });
      const hasPermission = await ensureWritePermission(handle);

      if (!hasPermission) {
        setError('Write permission was not granted for this project folder.');
        return;
      }

      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
      assetsRef.current = {};
      generationRecordsRef.current = [];
      projectHandleRef.current = handle;
      setProjectName(handle.name);
      setLastSavedLabel(null);
      await storeDirectoryHandle(handle);
      await ensureMissingNodeImagesArchived();
      scheduleProjectConfigWrite();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not select project folder.');
    }
  }, [ensureMissingNodeImagesArchived, scheduleProjectConfigWrite]);

  const clearProjectDirectory = useCallback(() => {
    projectHandleRef.current = null;
    assetsRef.current = {};
    generationRecordsRef.current = [];
    setProjectName(null);
    setLastSavedLabel(null);
    setError(null);
    void removeStoredDirectoryHandle().catch(() => {
      setError('Could not clear the stored project folder.');
    });
  }, []);

  const contextValue = useMemo<ProjectArchiveContextValue>(
    () => ({
      projectName,
      isSupported,
      isReady,
      saving,
      configFileName: CONFIG_FILE_NAME,
      lastSavedLabel,
      error,
      selectProjectDirectory,
      clearProjectDirectory,
      archiveGeneratedImage,
    }),
    [
      archiveGeneratedImage,
      clearProjectDirectory,
      error,
      isReady,
      isSupported,
      lastSavedLabel,
      projectName,
      saving,
      selectProjectDirectory,
    ],
  );

  return (
    <ProjectArchiveContext.Provider value={contextValue}>
      {children}
    </ProjectArchiveContext.Provider>
  );
}

export function useProjectArchiveContext(): ProjectArchiveContextValue {
  const context = useContext(ProjectArchiveContext);
  if (!context) {
    throw new Error('useProjectArchiveContext must be used within a ProjectArchiveProvider');
  }
  return context;
}

export { ProjectArchiveContext };
