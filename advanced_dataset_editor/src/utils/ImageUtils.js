

export function cleanupBlobUrls(obj) {
  if (!obj) return;
  Object.values(obj).forEach(url => URL.revokeObjectURL(url));
}

export function base64ToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";

  // Convert base64 → binary
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // Create Blob + Blob URL
  const blob = new Blob([byteArray], { type: mime });
  return URL.createObjectURL(blob);
}
