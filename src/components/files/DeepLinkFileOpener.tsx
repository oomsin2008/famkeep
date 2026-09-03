"use client";

import { useEffect, useRef } from "react";
import { useFiles } from "@/components/providers/FilesProvider";
import type { FileView } from "@/lib/types";

/**
 * Opens the app-level FileDetailModal for a file that was deep-linked at
 * /locker/files/[id] (e.g. from a LINE save reply). Runs once on mount; the
 * user closing the modal just reveals the full Locker underneath.
 */
export function DeepLinkFileOpener({ file }: { file: FileView }) {
  const { openFile } = useFiles();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openFile(file);
  }, [file, openFile]);

  return null;
}
