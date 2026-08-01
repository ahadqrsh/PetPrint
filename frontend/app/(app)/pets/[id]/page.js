"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PetCode from "@/components/PetCode";
import AllergyBanner from "@/components/AllergyBanner";
import RecordTimeline from "@/components/RecordTimeline";
import QrPanel from "@/components/QrPanel";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { TextInput, ErrorNote } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { describePet, formatDate } from "@/lib/pets";
import DownloadButton from "@/components/DownloadButton";

function Textarea({ label, hint, value, onChange, rows = 3, ...props }) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
        {...props}
      />
    </label>
  );
}

const EMPTY_VISIT = {
  visitDate: new Date().toISOString().slice(0, 10),
  symptoms: "", diagnosis: "", treatment: "", notes: ""
};

function VisitForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
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
        label="Visit date" type="date" required value={form.visitDate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
      />
      <Textarea
        label="Symptoms" hint="What was presented" value={form.symptoms}
        onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
      />
      <Textarea
        label="Diagnosis" value={form.diagnosis}
        onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
      />
      <Textarea
        label="Treatment" value={form.treatment}
        onChange={(e) => setForm({ ...form, treatment: e.target.value })}
      />
      <Textarea
        label="Notes" hint="Optional" rows={2} value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export default function PetProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const canWrite = user.role === "vet" || user.role === "admin";
  const isAdmin = user.role === "admin";

  const [pet, setPet] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingPet, setDeletingPet] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [petRes, recRes] = await Promise.all([
        api.get(`/pets/${id}`),
        api.get(`/pets/${id}/records`)
      ]);
      setPet(petRes.data.pet);
      setRecords(recRes.data.records);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addVisit(form) {
    await api.post(`/pets/${id}/records`, form);
    setAdding(false);
    toast("Visit added to the chart");
    load();
  }

  async function saveVisit(form) {
    await api.put(`/records/${editing.id}`, form);
    setEditing(null);
    toast("Visit updated");
    load();
  }

  async function confirmDeleteVisit() {
    setBusy(true);
    try {
      await api.delete(`/records/${deleting.id}`);
      setDeleting(null);
      toast("Visit deleted");
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletePet() {
    setBusy(true);
    try {
      await api.delete(`/pets/${id}`);
      toast(`${pet.name}'s chart deleted`);
      router.push("/pets");
    } catch (err) {
      toast(apiError(err), "error");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="file-tab"><span className="h-1.5 w-1.5 rounded-full bg-brass" />Chart</div>
        <div className="file-sheet p-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-64" />
          <Skeleton className="mt-6 h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="file-tab"><span className="h-1.5 w-1.5 rounded-full bg-brass" />Chart</div>
        <div className="file-sheet px-6 py-12 text-center">
          <h1 className="text-xl">{error}</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            The pet may belong to another clinic, or the code may be wrong.
          </p>
          <Link href="/pets" className="mt-4 inline-block">
            <Button variant="secondary">Back to pets</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="file-tab">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            Chart
          </div>
          <div className="file-sheet">
            <header className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1>{pet.name}</h1>
                  <PetCode code={pet.petCode} />
                </div>
                <p className="mt-1 text-[14px] text-ink-soft">{describePet(pet)}</p>
                {pet.owner && (
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    Owner: <span className="text-ink">{pet.owner.name}</span>
                    {pet.owner.phone ? ` · ${pet.owner.phone}` : ""}
                  </p>
                )}
              </div>
              {canWrite && <Button onClick={() => setAdding(true)}>Add visit</Button>}
            </header>

            <AllergyBanner
              allergies={pet.allergies}
              chronicConditions={pet.chronicConditions}
            />

            <div className="flex items-baseline justify-between border-t border-line px-5 pt-4 sm:px-6">
              <h2 className="text-base">History</h2>
              <span className="data text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {records.length} {records.length === 1 ? "visit" : "visits"}
              </span>
            </div>

            {records.length === 0 ? (
              <EmptyState
                title="No visits recorded yet"
                body={
                  canWrite
                    ? "Add the first visit and it becomes the top of this pet's timeline."
                    : "Your vet will add visits here after each appointment."
                }
                action={canWrite ? <Button onClick={() => setAdding(true)}>Add visit</Button> : null}
              />
            ) : (
              <RecordTimeline
                records={records}
                canEdit={canWrite}
                canDelete={isAdmin}
                onEdit={(r) =>
                  setEditing({
                    id: r.id,
                    visitDate: new Date(r.visitDate).toISOString().slice(0, 10),
                    symptoms: r.symptoms || "",
                    diagnosis: r.diagnosis || "",
                    treatment: r.treatment || "",
                    notes: r.notes || ""
                  })
                }
                onDelete={setDeleting}
              />
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <QrPanel petId={pet.id} petCode={pet.petCode} petName={pet.name} />

          <div>
            <div className="file-tab">
              <span className="h-1.5 w-1.5 rounded-full bg-brass" />
              Details
            </div>
            <div className="file-sheet p-5">
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ["Born", pet.dateOfBirth ? formatDate(pet.dateOfBirth) : "Not recorded"],
                  ["Registered", formatDate(pet.createdAt)],
                  ["Owner email", pet.owner?.email || "—"]
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      {k}
                    </dt>
                    <dd className="mt-0.5 break-words text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

              <DownloadButton
                path={`/pets/${pet.id}/record.pdf`}
                filename={`${pet.petCode}-history.pdf`}
                size="sm"
                className="mt-4 w-full"
                busyLabel="Building PDF…"
              >
                Print history (PDF)
              </DownloadButton>

              {isAdmin && (
                <button
                  onClick={() => setDeletingPet(true)}
                  className="mt-4 border-t border-line pt-3 text-[12px] font-semibold text-ink-faint underline underline-offset-2 hover:text-clay-ink"
                >
                  Delete this chart
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a visit"
        description={`${pet.name} · ${pet.petCode}`}
      >
        <VisitForm
          initial={EMPTY_VISIT}
          onSubmit={addVisit}
          onCancel={() => setAdding(false)}
          submitLabel="Add visit"
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit visit"
        description={`${pet.name} · ${pet.petCode}`}
      >
        {editing && (
          <VisitForm
            initial={editing}
            onSubmit={saveVisit}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDeleteVisit}
        busy={busy}
        title="Delete this visit?"
        body="It's removed from the pet's history permanently."
        confirmLabel="Delete visit"
      />

      <ConfirmDialog
        open={deletingPet}
        onClose={() => setDeletingPet(false)}
        onConfirm={confirmDeletePet}
        busy={busy}
        title={`Delete ${pet.name}'s chart?`}
        body={`This removes the pet and all ${records.length} recorded ${records.length === 1 ? "visit" : "visits"}. It can't be undone.`}
        confirmLabel="Delete chart"
      />
    </>
  );
}
