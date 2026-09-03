"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FileView, Workspace } from "@/lib/types";

interface FilesContextValue {
  /** Active Locker workspace tab. Persists across navigation; defaults to private. */
  lockerTab: Workspace;
  setLockerTab: (workspace: Workspace) => void;
  /** File currently shown in the detail modal, or null. */
  openedFile: FileView | null;
  /** Open the detail modal and switch the Locker tab to that file's workspace (readme §4). */
  openFile: (file: FileView) => void;
  closeFile: () => void;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export function FilesProvider({ children }: { children: ReactNode }) {
  const [lockerTab, setLockerTab] = useState<Workspace>("private");
  const [openedFile, setOpenedFile] = useState<FileView | null>(null);

  const openFile = useCallback((file: FileView) => {
    setLockerTab(file.workspace);
    setOpenedFile(file);
  }, []);

  const closeFile = useCallback(() => setOpenedFile(null), []);

  const value = useMemo<FilesContextValue>(
    () => ({ lockerTab, setLockerTab, openedFile, openFile, closeFile }),
    [lockerTab, openedFile, openFile, closeFile],
  );

  return (
    <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
  );
}

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error("useFiles must be used within <FilesProvider>");
  return ctx;
}

/** Non-throwing read of the active Locker workspace, for shell chrome. */
export function useLockerTab(): Workspace {
  return useContext(FilesContext)?.lockerTab ?? "private";
}
