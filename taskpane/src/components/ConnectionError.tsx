/** Shown when the app cannot connect to the AgentXL server on initial load. */
export function ConnectionError() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
        <span className="text-red-500 text-lg">!</span>
      </div>
      <p className="text-sm text-gray-700 font-medium mb-2">
        Can't connect to server
      </p>
      <p className="text-xs text-gray-500">
        Make sure{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded">
          agentxl start
        </code>{" "}
        is running in your terminal.
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
        Reconnecting…
      </div>
    </div>
  );
}
