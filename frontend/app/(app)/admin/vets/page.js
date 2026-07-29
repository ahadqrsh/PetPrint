"use client";

import { useCallback, useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { TextInput, ErrorNote } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const EMPTY = { name: "", email: "", phone: "", password: "" };

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function VetForm({ mode, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <TextInput
        label="Full name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextInput
        label="Email"
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <TextInput
        label="Phone"
        hint="Optional"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <TextInput
        label={mode === "edit" ? "New password" : "Temporary password"}
        hint={mode === "edit" ? "Leave blank to keep current" : "8 characters or more"}
        type="password"
        required={mode === "create"}
        minLength={8}
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      {mode === "create" && (
        <p className="mt-2 text-[12px] text-ink-faint">
          Share this password with the vet directly. They sign in with it and can
          change it later.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add vet"}
        </Button>
      </div>
    </form>
  );
}

function VetsPage() {
  const toast = useToast();

  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/vets");
      setVets(res.data.vets);
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createVet(form) {
    await api.post("/vets", form);
    setCreating(false);
    toast(`${form.name} can now sign in`);
    load();
  }

  async function updateVet(form) {
    const payload = { name: form.name, email: form.email, phone: form.phone };
    if (form.password) payload.password = form.password;
    await api.put(`/vets/${editing.id}`, payload);
    setEditing(null);
    toast("Changes saved");
    load();
  }

  async function confirmRemove() {
    setRemoveBusy(true);
    try {
      await api.delete(`/vets/${removing.id}`);
      toast(`${removing.name} removed from the team`);
      setRemoving(null);
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        tab="Team"
        title="Vets"
        description="Vets you add here can record visits for this clinic, and see only its records. Admin accounts are managed separately."
        action={<Button onClick={() => setCreating(true)}>Add vet</Button>}
      >
        {loading ? (
          <div className="divide-y divide-line border-t border-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="border-t border-line px-5 py-10 text-center sm:px-6">
            <p className="text-[14px] text-ink">{loadError}</p>
            <Button variant="secondary" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : vets.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState
              title="No vets on the team yet"
              body="Add a vet so they can register pets and record visits for this clinic."
              action={<Button onClick={() => setCreating(true)}>Add the first vet</Button>}
            />
          </div>
        ) : (
          <>
            {/* Column headings, desktop only — the row itself is legible without them. */}
            <div className="hidden grid-cols-[1fr_180px_120px_150px] gap-4 border-t border-line bg-paper/60 px-6 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint md:grid">
              <span>Vet</span>
              <span>Phone</span>
              <span>Joined</span>
              <span className="text-right">Actions</span>
            </div>

            <ul className="divide-y divide-line border-t border-line md:border-t-0">
              {vets.map((vet, i) => (
                <li
                  key={vet.id}
                  className="animate-rise-in items-center gap-4 px-5 py-4 transition-colors hover:bg-paper/60 sm:px-6 md:grid md:grid-cols-[1fr_180px_120px_150px]"
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={vet.name} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">{vet.name}</p>
                      <p className="truncate text-[13px] text-ink-soft">{vet.email}</p>
                    </div>
                  </div>

                  <p className="mt-2 text-[13px] text-ink-soft md:mt-0">
                    {vet.phone || <span className="text-ink-faint">Not set</span>}
                  </p>

                  <p className="data mt-1 text-[12px] text-ink-soft md:mt-0">
                    {formatDate(vet.createdAt)}
                  </p>

                  <div className="mt-3 flex gap-2 md:mt-0 md:justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(vet)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => setRemoving(vet)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-5 py-3 sm:px-6">
              <p className="data text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {vets.length} {vets.length === 1 ? "vet" : "vets"}
              </p>
            </div>
          </>
        )}
      </PageHeader>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add a vet"
        description="They'll be able to sign in straight away."
      >
        <VetForm mode="create" onSubmit={createVet} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit vet"
        description={editing?.email}
      >
        {editing && (
          <VetForm
            mode="edit"
            initial={{
              name: editing.name,
              email: editing.email,
              phone: editing.phone || "",
              password: ""
            }}
            onSubmit={updateVet}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        busy={removeBusy}
        title={`Remove ${removing?.name || "this vet"}?`}
        body="They lose access to this clinic immediately. You can add them again later with the same email."
        confirmLabel="Remove vet"
      />
    </>
  );
}

export default function Page() {
  return (
    <Protected roles={["admin"]}>
      <VetsPage />
    </Protected>
  );
}
