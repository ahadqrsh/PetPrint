"use client";

import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import Button from "./ui/Button";
import Skeleton from "./ui/Skeleton";

// The endpoint is authenticated, so an <img src> pointing at it would fail —
// we fetch JSON with the bearer token and render the returned data URL.
export default function QrPanel({ petId, petCode, petName }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .get(`/pets/${petId}/qrcode`)
      .then((res) => alive && setQr(res.data))
      .catch((err) => alive && setError(apiError(err)));
    return () => { alive = false; };
  }, [petId]);

  function download() {
    const a = document.createElement("a");
    a.href = qr.dataUrl;
    a.download = `${petCode}.png`;
    a.click();
  }

  return (
    <div>
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Tag
      </div>
      <div className="file-sheet p-5 text-center">
        {error ? (
          <p className="py-6 text-[13px] text-ink-soft">{error}</p>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.dataUrl}
              alt={`QR code linking to ${petName}'s chart`}
              className="mx-auto h-40 w-40 rounded border border-line"
            />
            <p className="mt-3 text-[13px] text-ink-soft">
              Scan to open this chart on a phone.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={download}>
              Download PNG
            </Button>
          </>
        ) : (
          <Skeleton className="mx-auto h-40 w-40" />
        )}
      </div>
    </div>
  );
}
