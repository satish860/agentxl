const mode = process.env.MOCK_FOLDER_PICKER_MODE || "success";
const folderPath = process.env.MOCK_FOLDER_PICKER_PATH || "C:\\Helper Picked\\Support";

if (mode === "success") {
  process.stdout.write(
    JSON.stringify({ ok: true, cancelled: false, folderPath })
  );
  process.exit(0);
}

if (mode === "cancel") {
  process.stdout.write(
    JSON.stringify({ ok: true, cancelled: true, folderPath: null })
  );
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({ ok: false, error: "Mock helper failed" })
);
process.exit(1);
