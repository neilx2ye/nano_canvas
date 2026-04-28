import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buildImageFilename, dataUrlToBlob } from '../utils';

type FileSystemPermissionMode = 'read' | 'readwrite';

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

interface SaveGeneratedImageOptions {
  createdAt?: Date;
  prefix?: string;
}

export interface AutoSaveContextValue {
  directoryName: string | null;
  isSupported: boolean;
  isReady: boolean;
  saving: boolean;
  lastSavedFileName: string | null;
  error: string | null;
  selectDirectory: () => Promise<void>;
  clearDirectory: () => void;
  saveGeneratedImage: (
    imageData: string,
    prompt: string,
    options?: SaveGeneratedImageOptions,
  ) => Promise<void>;
}

const DB_NAME = 'nano_canvas_auto_save';
const STORE_NAME = 'settings';
const DIRECTORY_KEY = 'directoryHandle';

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null);

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

export function AutoSaveProvider({ children }: { children: React.ReactNode }) {
  const directoryHandleRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastSavedFileName, setLastSavedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSupported = Boolean(getDirectoryPicker() && window.indexedDB);

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
        directoryHandleRef.current = handle;
        setDirectoryName(handle.name);
      })
      .catch(() => {
        if (active) {
          setError('Could not restore the auto-save folder.');
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

  const selectDirectory = useCallback(async () => {
    const showDirectoryPicker = getDirectoryPicker();
    if (!showDirectoryPicker) {
      setError('Folder selection is not supported in this browser.');
      return;
    }

    setError(null);

    try {
      const handle = await showDirectoryPicker({ mode: 'readwrite' });
      const hasPermission = await ensureWritePermission(handle);

      if (!hasPermission) {
        setError('Write permission was not granted for this folder.');
        return;
      }

      directoryHandleRef.current = handle;
      setDirectoryName(handle.name);
      setLastSavedFileName(null);
      await storeDirectoryHandle(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not select folder.');
    }
  }, []);

  const clearDirectory = useCallback(() => {
    directoryHandleRef.current = null;
    setDirectoryName(null);
    setLastSavedFileName(null);
    setError(null);
    void removeStoredDirectoryHandle().catch(() => {
      setError('Could not clear the stored folder.');
    });
  }, []);

  const saveGeneratedImage = useCallback(
    async (imageData: string, prompt: string, options?: SaveGeneratedImageOptions) => {
      const directoryHandle = directoryHandleRef.current;
      if (!directoryHandle) return;

      setSaving(true);
      setError(null);

      try {
        const hasPermission = await ensureWritePermission(directoryHandle);
        if (!hasPermission) {
          setError('Write permission was not granted for this folder.');
          return;
        }

        const filename = buildImageFilename(
          imageData,
          prompt,
          options?.createdAt,
          options?.prefix,
        );
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(dataUrlToBlob(imageData));
        await writable.close();
        setLastSavedFileName(filename);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save generated image.');
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const contextValue = useMemo<AutoSaveContextValue>(
    () => ({
      directoryName,
      isSupported,
      isReady,
      saving,
      lastSavedFileName,
      error,
      selectDirectory,
      clearDirectory,
      saveGeneratedImage,
    }),
    [
      clearDirectory,
      directoryName,
      error,
      isReady,
      isSupported,
      lastSavedFileName,
      saveGeneratedImage,
      saving,
      selectDirectory,
    ],
  );

  return (
    <AutoSaveContext.Provider value={contextValue}>
      {children}
    </AutoSaveContext.Provider>
  );
}

export function useAutoSaveContext(): AutoSaveContextValue {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error('useAutoSaveContext must be used within an AutoSaveProvider');
  }
  return context;
}

export { AutoSaveContext };
