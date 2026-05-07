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
  const { status, connectionError, serverDown, markServerDown, refreshStatus } =
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
    useChatStream(workbookId, markServerDown);
  const [input, setInput] = useState("");
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [folderSkipped, setFolderSkipped] = useState(false);
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
    setFolderSkipped(false);
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
    return <AuthRequired onSaved={() => void refreshStatus()} />;
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
  const chatActive = isFolderLinked || folderSkipped;
  const showFolderLinkFlow =
    !workbookId || isLoadingFolderStatus || (!chatActive) || isEditingFolder;

  // ── Chat UI ─────────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0;
  const inputDisabled =
    serverDown ||
    !workbookId ||
    Boolean(workbookResolveError) ||
    Boolean(folderError) ||
    !chatActive ||
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
              onSkip={
                isEditingFolder
                  ? undefined
                  : () => {
                      setFolderSkipped(true);
                      setPickerError(null);
                    }
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-400">Preparing folder link…</div>
            </div>
          )
        ) : !hasMessages ? (
          isFolderLinked ? (
            <WelcomeScreen
              status={status}
              workbookId={workbookId}
              linkedFolderPath={folderStatus!.folderPath!}
              totalFiles={folderStatus!.totalFiles}
              supportedFiles={folderStatus!.supportedFiles}
              onQuickAction={handleQuickAction}
              onChangeFolder={() => setIsEditingFolder(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] font-medium text-gray-700">
                Chatting without a linked folder
              </p>
              <p className="text-[12px] leading-5 text-gray-500">
                AgentXL won't have access to source documents. You can link a folder
                anytime to enable grounded answers with citations.
              </p>
              <button
                onClick={() => {
                  setFolderSkipped(false);
                  setIsEditingFolder(true);
                }}
                className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-[12px] font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                Link a folder
              </button>
            </div>
          )
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
      {chatActive && !isEditingFolder && (
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
