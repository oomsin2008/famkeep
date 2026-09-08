"use client";

import type { ReactNode } from "react";
import { TasksProvider } from "./TasksProvider";
import { ToastProvider } from "./ToastProvider";
import { FilesProvider } from "./FilesProvider";
import { SettingsProvider } from "./SettingsProvider";
import { CurrentUserProvider } from "./CurrentUserProvider";
import { FileDetailModal } from "@/components/files/FileDetailModal";

/** Client-side app state for the UI-foundation phases (in-memory only). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CurrentUserProvider>
        <TasksProvider>
          <FilesProvider>
            <SettingsProvider>
              {children}
              <FileDetailModal />
            </SettingsProvider>
          </FilesProvider>
        </TasksProvider>
      </CurrentUserProvider>
    </ToastProvider>
  );
}
