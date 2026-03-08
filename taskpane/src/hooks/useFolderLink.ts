import { useCallback, useEffect, useState } from "react";
import {
  getFolderStatus,
  selectFolder,
  type FolderStatus,
  type WorkbookIdentityInput,
} from "../lib/api";

export interface FolderLinkState {
  folderStatus: FolderStatus | null;
  folderError: string | null;
  isLoadingFolderStatus: boolean;
  isSavingFolder: boolean;
  saveFolderLink: (folderPath: string) => Promise<boolean>;
  refreshFolderStatus: () => Promise<void>;
}

export function useFolderLink(
  workbookId: string | null,
  workbookIdentityInput: WorkbookIdentityInput | null,
  enabled: boolean
): FolderLinkState {
  const [folderStatus, setFolderStatus] = useState<FolderStatus | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isLoadingFolderStatus, setIsLoadingFolderStatus] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  const refreshFolderStatus = useCallback(async () => {
    if (!enabled || !workbookId) {
      setFolderStatus(null);
      return;
    }

    setIsLoadingFolderStatus(true);
    try {
      const status = await getFolderStatus(workbookId);
      setFolderStatus(status);
      setFolderError(null);
    } catch (error) {
      setFolderError(
        error instanceof Error ? error.message : "Failed to load folder status"
      );
    } finally {
      setIsLoadingFolderStatus(false);
    }
  }, [enabled, workbookId]);

  useEffect(() => {
    if (!enabled || !workbookId) {
      setFolderStatus(null);
      setFolderError(null);
      return;
    }

    setFolderStatus(null);
    setFolderError(null);
    void refreshFolderStatus();
  }, [enabled, workbookId, refreshFolderStatus]);

  const saveFolderLink = useCallback(
    async (folderPath: string): Promise<boolean> => {
      if (!workbookId || !workbookIdentityInput) {
        setFolderError("Workbook identity is not ready yet");
        return false;
      }

      setIsSavingFolder(true);
      try {
        const status = await selectFolder(
          workbookId,
          folderPath,
          workbookIdentityInput
        );
        setFolderStatus(status);
        setFolderError(null);
        return true;
      } catch (error) {
        setFolderError(
          error instanceof Error ? error.message : "Failed to save folder link"
        );
        return false;
      } finally {
        setIsSavingFolder(false);
      }
    },
    [workbookId, workbookIdentityInput]
  );

  return {
    folderStatus,
    folderError,
    isLoadingFolderStatus,
    isSavingFolder,
    saveFolderLink,
    refreshFolderStatus,
  };
}
