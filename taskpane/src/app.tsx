import { useEffect, useRef, useState, useCallback } from "react";
import { pickFolder } from "./lib/api";
import { useAgentStatus } from "./hooks/useAgentStatus";
import { useWorkbookIdentity } from "./hooks/useWorkbookIdentity";
import { useFolderLink } from "./hooks/useFolderLink";
import { useChatStream } from "./hooks/useChatStream";
import { ConnectionError } from "./components/ConnectionError";
import { AuthRequired } from "./components/AuthRequired";
import { FolderLinkScreen } from "./components/FolderLinkScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageBubble } from "./components/MessageBubble";
import { ChatInput } from "./components/ChatInput";

export function App() {
  const { status, connectionError, serverDown, markServerDown } =
    useAgentStatus();
  const {
    workbookId,
    workbookIdentityInput,
    workbookResolveError,
    isResolvingWorkbook,
  } = useWorkbookIdentity(Boolean(status?.authenticated));
  const {
    folderStatus,
    folderError,
    isLoadingFolderStatus,
    isSavingFolder,
    saveFolderLink,
  } = useFolderLink(
    workbookId,
    workbookIdentityInput,
    Boolean(status?.authenticated)
  );
  const { messages, isStreaming, sendMessage, stopStreaming } =
    useChatStream(markServerDown);
  const [input, setInput] = useState("");
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendMessage(trimmed);
      setInput("");
    },
    [sendMessage]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    []
  );

  const handleSaveFolder = useCallback(
    async (folderPath: string) => {
      setPickerError(null);
      const ok = await saveFolderLink(folderPath);
      if (ok) {
        setIsEditingFolder(false);
      }
    },
    [saveFolderLink]
  );

  const handlePickFolder = useCallback(async () => {
    setPickerError(null);
    setIsPickingFolder(true);
    try {
      const result = await pickFolder(folderStatus?.folderPath ?? null);
      return result.folderPath;
    } catch (error) {
      setPickerError(
        error instanceof Error
          ? error.message
          : "Could not open the folder picker. Paste the folder path manually instead."
      );
      return null;
    } finally {
      setIsPickingFolder(false);
    }
  }, [folderStatus?.folderPath]);

  useEffect(() => {
    setPickerError(null);
  }, [workbookId]);

  // ── Connection error (never connected) ──────────────────────────────────
  if (connectionError && !status) {
    return <ConnectionError />;
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">Connecting…</div>
      </div>
    );
  }

  // ── Not authenticated ───────────────────────────────────────────────────
  if (!status.authenticated) {
    return <AuthRequired />;
  }

  // ── Workbook identity state ─────────────────────────────────────────────
  if (isResolvingWorkbook && !workbookId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">Resolving workbook…</div>
      </div>
    );
  }

  const isFolderLinked = Boolean(folderStatus?.linked && folderStatus.folderPath);
  const showFolderLinkFlow = !workbookId || isLoadingFolderStatus || !isFolderLinked || isEditingFolder;

  // ── Chat UI ─────────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0;
  const inputDisabled =
    serverDown ||
    !workbookId ||
    Boolean(workbookResolveError) ||
    Boolean(folderError) ||
    !isFolderLinked ||
    isEditingFolder;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Server-down banner */}
      {serverDown && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Server disconnected — reconnecting…
        </div>
      )}

      {/* Workbook state banner */}
      {workbookResolveError && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-700">
          Could not resolve workbook identity. Reopen the taskpane or workbook and try again.
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {showFolderLinkFlow ? (
          workbookId ? (
            <FolderLinkScreen
              workbookId={workbookId}
              workbookName={workbookIdentityInput?.workbookName ?? null}
              currentFolderPath={folderStatus?.folderPath ?? null}
              isSaving={isSavingFolder || isLoadingFolderStatus}
              isPickingFolder={isPickingFolder}
              error={pickerError ?? folderError}
              onPickFolder={handlePickFolder}
              onSave={handleSaveFolder}
              onCancel={isFolderLinked ? () => setIsEditingFolder(false) : undefined}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-400">Preparing folder link…</div>
            </div>
          )
        ) : !hasMessages ? (
          <WelcomeScreen
            status={status}
            workbookId={workbookId}
            linkedFolderPath={folderStatus!.folderPath!}
            onQuickAction={handleQuickAction}
            onChangeFolder={() => setIsEditingFolder(true)}
          />
        ) : (
          <div className="p-4 space-y-4">
            {workbookId && (
              <div className="space-y-1 px-1">
                <div className="text-[11px] text-gray-400">Workbook ID: {workbookId}</div>
                {folderStatus?.folderPath && (
                  <div className="text-[11px] text-gray-400 break-all">
                    Linked folder: {folderStatus.folderPath}
                  </div>
                )}
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming indicator (before first assistant content) */}
            {isStreaming &&
              !messages.some(
                (m) =>
                  m.role === "assistant" &&
                  (m.content || m.thinking?.length)
              ) && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pl-1 animate-message-in">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span>Thinking…</span>
                </div>
              )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {isFolderLinked && !isEditingFolder && (
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          disabled={inputDisabled}
        />
      )}
    </div>
  );
}
