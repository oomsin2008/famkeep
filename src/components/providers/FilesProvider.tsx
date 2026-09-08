"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FileView, OwnershipFilter } from "@/lib/types";

interface FilesContextValue {
  /** Active Locker ownership tab. Persists across navigation; defaults to private. */
  lockerTab: OwnershipFilter;
  setLockerTab: (tab: OwnershipFilter) => void;
  /** File currently shown in the detail modal, or null. */
  openedFile: FileView | null;
  /** Open the detail modal and switch the Locker tab to that file's workspace (readme §4). */
  openFile: (file: FileView) => void;
  renameOpenedFile: (fileId: string, name: string) => void;
  closeFile: () => void;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export function FilesProvider({ children }: { children: ReactNode }) {
  const [lockerTab, setLockerTab] = useState<OwnershipFilter>("private");
  const [openedFile, setOpenedFile] = useState<FileView | null>(null);

  const openFile = useCallback((file: FileView) => {
    setLockerTab(file.workspace);
    setOpenedFile(file);
  }, []);

  const closeFile = useCallback(() => setOpenedFile(null), []);

  const renameOpenedFile = useCallback((fileId: string, name: string) => {
    setOpenedFile((current) =>
      current?.id === fileId ? { ...current, name } : current,
    );
  }, []);

  const value = useMemo<FilesContextValue>(
    () => ({
      lockerTab,
      setLockerTab,
      openedFile,
      openFile,
      renameOpenedFile,
      closeFile,
    }),
    [lockerTab, openedFile, openFile, renameOpenedFile, closeFile],
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

/** Non-throwing read of the active Locker tab, for shell chrome. */
export function useLockerTab(): OwnershipFilter {
  return useContext(FilesContext)?.lockerTab ?? "private";
}

/** Non-throwing read + setter for the Locker tab, for shell chrome. Null off-provider. */
export function useLockerTabControls():
  | Pick<FilesContextValue, "lockerTab" | "setLockerTab">
  | null {
  const ctx = useContext(FilesContext);
  return ctx ? { lockerTab: ctx.lockerTab, setLockerTab: ctx.setLockerTab } : null;
}
