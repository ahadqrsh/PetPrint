const QRCode = require("qrcode");

/**
 * QR codes encode the scan URL, not the raw code, so a phone camera opens the
 * chart directly: https://app.example.com/scan/PET-2026-0042
 *
 * Returned as a data URL rather than a raw image because the endpoint is
 * authenticated — an <img src> can't send a bearer token, so the client fetches
 * JSON and sets the data URL itself.
 */
function scanUrlFor(petCode) {
  const base = (process.env.CLIENT_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/scan/${encodeURIComponent(petCode)}`;
}

async function qrDataUrlFor(petCode) {
  return QRCode.toDataURL(scanUrlFor(petCode), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0f2b2a", light: "#ffffff" }
  });
}

module.exports = { scanUrlFor, qrDataUrlFor };
