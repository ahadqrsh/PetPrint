import api, { apiError } from "./api";

/**
 * Downloads an authenticated file.
 *
 * A plain <a href> can't carry the bearer token, so the file is fetched as a
 * blob and handed to a temporary link. Falls back to the filename the server
 * suggested in Content-Disposition when one is present.
 */
export async function downloadFile(path, fallbackName) {
  const res = await api.get(path, { responseType: "blob" });

  const disposition = res.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}

/**
 * Error bodies come back as blobs too when responseType is "blob", so the
 * JSON message has to be read out of the blob before it can be shown.
 */
export async function downloadError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob && data.type.includes("json")) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.error?.message || apiError(err);
    } catch {
      return apiError(err);
    }
  }
  return apiError(err);
}
