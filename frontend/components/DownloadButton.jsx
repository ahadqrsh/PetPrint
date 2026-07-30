"use client";

import { useState } from "react";
import Button from "./ui/Button";
import { downloadFile, downloadError } from "@/lib/download";
import { useToast } from "./ui/Toast";

export default function DownloadButton({
  path,
  filename,
  children,
  busyLabel = "Preparing…",
  variant = "secondary",
  size = "md",
  className = ""
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await downloadFile(path, filename);
    } catch (err) {
      toast(await downloadError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={go} disabled={busy}>
      {busy ? busyLabel : children}
    </Button>
  );
}
