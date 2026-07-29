"use client";

import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  busy = false
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[14px] text-ink-soft">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
