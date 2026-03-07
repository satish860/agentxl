import { useEffect, useState } from "react";

type Status = {
  authenticated: boolean;
  provider: string | null;
  version: string;
};

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setError("Cannot connect to AgentXL server"));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      {/* Logo */}
      <div className="mb-6">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">AX</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">AgentXL</h1>
        <p className="text-sm text-gray-500 mt-1">AI assistant for Excel</p>
      </div>

      {/* Status */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 max-w-xs">
          {error}
        </div>
      )}

      {status && (
        <div className="space-y-3 max-w-xs w-full">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Server</span>
              <span className="text-emerald-600 font-medium">
                ● v{status.version}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Auth</span>
              {status.authenticated ? (
                <span className="text-emerald-600 font-medium">
                  ✓ {status.provider}
                </span>
              ) : (
                <span className="text-amber-600 font-medium">
                  Not configured
                </span>
              )}
            </div>
          </div>

          {!status.authenticated && (
            <p className="text-xs text-gray-500 mt-4">
              Run{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                agentxl login
              </code>{" "}
              in your terminal to set up credentials.
            </p>
          )}

          {status.authenticated && (
            <p className="text-sm text-gray-500 mt-4">
              Chat UI coming in Task 7 ✨
            </p>
          )}
        </div>
      )}

      {!status && !error && (
        <div className="text-sm text-gray-400">Connecting...</div>
      )}
    </div>
  );
}
