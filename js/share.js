export function filenameFor(name, ext = "json") {
  const slug = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "focus-timer"}.${ext}`;
}

function downloadFile(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Tries the native share sheet first (best for "send this to someone" on a
// phone); falls back to a plain file download anywhere that isn't supported.
// Deliberately omits title/text alongside the file: some share targets (e.g.
// Messages, "Save to Files") treat those as separate shareable content and
// create a companion text attachment from them instead of just naming the file.
export async function shareOrDownload(filename, content) {
  const file = new File([content], filename, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to download on any other failure
    }
  }

  downloadFile(filename, content);
  return "downloaded";
}

// Plain-text sharing (a to-do list, not a JSON backup file) — the native
// share sheet takes freeform text directly here, no File wrapper needed.
// Falls back to the clipboard, then to a .txt download, wherever share/
// clipboard aren't available.
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to clipboard/download on any other failure
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      // fall through to download
    }
  }

  downloadFile(filenameFor(title, "txt"), text, "text/plain");
  return "downloaded";
}
