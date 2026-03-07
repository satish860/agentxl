import { RefreshCw } from "lucide-react";

/** Shown when the server is running but no auth is configured. Polls for changes. */
export function AuthRequired() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
        <span className="text-amber-600 text-xl">🔑</span>
      </div>
      <p className="text-sm text-gray-700 font-medium mb-2">
        Authentication required
      </p>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">
        Run{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
          agentxl login
        </code>{" "}
        in your terminal to set up credentials.
      </p>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <RefreshCw size={12} className="animate-spin" />
        Waiting for credentials…
      </div>
    </div>
  );
}
