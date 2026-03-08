# AgentXL Windows Folder Picker Helper

Tiny native helper used by AgentXL to open a reliable Windows folder picker and return the selected path as JSON.

## Build

From the repo root on Windows with the .NET 8 SDK installed:

```bash
dotnet publish ./tools/folder-picker-win/agentxl-folder-picker.csproj -c Release -r win-x64 -p:PublishSingleFile=true --self-contained false -o ./bin
```

This produces:

```txt
bin/agentxl-folder-picker.exe
```

## Contract

The helper writes JSON to stdout:

### Picked folder
```json
{"ok":true,"cancelled":false,"folderPath":"C:\\Clients\\ABC\\Support"}
```

### User cancelled
```json
{"ok":true,"cancelled":true,"folderPath":null}
```

### Error
```json
{"ok":false,"error":"Failed to open folder picker"}
```
