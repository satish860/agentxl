using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;

namespace AgentXL.FolderPicker;

internal sealed class WindowOwner : IWin32Window
{
    public WindowOwner(IntPtr handle)
    {
        Handle = handle;
    }

    public IntPtr Handle { get; }
}

internal static class NativeMethods
{
    [DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();
}

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var initialPath = GetInitialPath(args);

            using var dialog = new FolderBrowserDialog
            {
                Description = "Choose the folder with your supporting documents",
                ShowNewFolderButton = false,
                UseDescriptionForTitle = true,
                RootFolder = Environment.SpecialFolder.MyDocuments,
            };

            if (!string.IsNullOrWhiteSpace(initialPath) && Directory.Exists(initialPath))
            {
                dialog.SelectedPath = initialPath;
            }

            var ownerHandle = NativeMethods.GetForegroundWindow();
            var result = ownerHandle != IntPtr.Zero
                ? dialog.ShowDialog(new WindowOwner(ownerHandle))
                : dialog.ShowDialog();

            if (result == DialogResult.OK && !string.IsNullOrWhiteSpace(dialog.SelectedPath))
            {
                WriteJson(new
                {
                    ok = true,
                    cancelled = false,
                    folderPath = dialog.SelectedPath,
                });
                return 0;
            }

            WriteJson(new
            {
                ok = true,
                cancelled = true,
                folderPath = (string?)null,
            });
            return 0;
        }
        catch (Exception ex)
        {
            WriteJson(new
            {
                ok = false,
                error = ex.Message,
            });
            return 1;
        }
    }

    private static string? GetInitialPath(string[] args)
    {
        for (var i = 0; i < args.Length; i++)
        {
            if (string.Equals(args[i], "--initial-path", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                return args[i + 1];
            }

            const string prefix = "--initial-path=";
            if (args[i].StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return args[i][prefix.Length..];
            }
        }

        return null;
    }

    private static void WriteJson(object payload)
    {
        Console.Out.Write(JsonSerializer.Serialize(payload));
    }
}
