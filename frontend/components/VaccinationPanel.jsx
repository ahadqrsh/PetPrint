"use client";

import { useCallback, useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import ConfirmDialog from "./ui/ConfirmDialog";
import Skeleton from "./ui/Skeleton";
import DueChip from "./DueChip";
import { TextInput, SelectInput, ErrorNote } from "./ui/Field";
import { useToast } from "./ui/Toast";
import { formatDate } from "@/lib/pets";

function RecordForm({ pet, catalogue, preselectId, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    vaccineTypeId: preselectId || "",
    dateGiven: new Date().toISOString().slice(0, 10),
    batchNumber: "",
    site: "",
    notes: ""
  });
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
      <SelectInput
        label="Vaccine"
        required
        value={form.vaccineTypeId}
        onChange={(e) => setForm({ ...form, vaccineTypeId: e.target.value })}
      >
        <option value="">Choose a vaccine…</option>
        {catalogue.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.isCore ? " (core)" : ""}
          </option>
        ))}
      </SelectInput>

      <TextInput
        label="Date given"
        type="date"
        required
        max={new Date().toISOString().slice(0, 10)}
        value={form.dateGiven}
        onChange={(e) => setForm({ ...form, dateGiven: e.target.value })}
      />

      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextInput
          label="Batch number"
          hint="Optional"
          value={form.batchNumber}
          onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
        />
        <TextInput
          label="Site"
          hint="Optional"
          placeholder="e.g. left shoulder"
          value={form.site}
          onChange={(e) => setForm({ ...form, site: e.target.value })}
        />
      </div>

      <TextInput
        label="Notes"
        hint="Optional"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />

      <p className="mt-3 text-[12px] text-ink-faint">
        The dose number and the next due date are worked out automatically from{" "}
        {pet.name}&apos;s history.
      </p>

      <ErrorNote>{error}</ErrorNote>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Recording…" : "Record vaccination"}
        </Button>
      </div>
    </form>
  );
}

/** One vaccine's row: status, progress through the course, and its dose history. */
function VaccineRow({ entry, canWrite, onRecord, onDelete }) {
  const [open, setOpen] = useState(false);
  const { vaccineType: type, next, doses, started } = entry;
  const total = type.totalDoses;

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{type.name}</span>
            {type.isCore && (
              <span className="chip border-line-strong bg-paper text-ink-soft">Core</span>
            )}
            <DueChip status={next.status} label={next.label} />
          </div>

          <p className="mt-1 text-[13px] text-ink-soft">
            {next.dueDate ? (
              <>
                Next: {next.isBooster ? "booster" : `dose ${next.doseSequence}`} on{" "}
                <span className="data">{formatDate(next.dueDate)}</span>
              </>
            ) : (
              next.reason
            )}
          </p>

          {/* Course progress: filled pips for doses given, hollow for remaining. */}
          {total > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full ${
                    i < doses.length ? "bg-jade" : "bg-line"
                  }`}
                />
              ))}
              <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {next.courseComplete
                  ? "Course complete"
                  : `${doses.length} of ${total}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {started && (
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-[12px] font-semibold text-jade underline underline-offset-2"
            >
              {open ? "Hide" : `${doses.length} recorded`}
            </button>
          )}
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => onRecord(type.id)}>
              Record
            </Button>
          )}
        </div>
      </div>

      {open && doses.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-paper/50">
          {doses.map((dose) => (
            <li key={dose.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="text-[13px] text-ink">
                  Dose {dose.doseSequence} ·{" "}
                  <span className="data">{formatDate(dose.dateGiven)}</span>
                </span>
                <span className="block truncate text-[12px] text-ink-soft">
                  {[dose.givenBy && `by ${dose.givenBy}`, dose.batchNumber && `batch ${dose.batchNumber}`, dose.site]
                    .filter(Boolean)
                    .join(" · ") || "No further detail"}
                </span>
              </span>
              {canWrite && (
                <button
                  onClick={() => onDelete(dose)}
                  className="shrink-0 text-[12px] text-ink-faint underline underline-offset-2 hover:text-clay-ink"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function VaccinationPanel({ petId }) {
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = user.role === "vet" || user.role === "admin";

  const [data, setData] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(null); // vaccineTypeId or "" for any
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/pets/${petId}/vaccinations`);
      setData(res.data);
      const cat = await api.get("/vaccines", {
        params: { species: res.data.pet.species }
      });
      setCatalogue(cat.data.vaccineTypes);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  async function record(form) {
    const payload = { ...form };
    if (!payload.dateGiven) delete payload.dateGiven;
    const res = await api.post(`/pets/${petId}/vaccinations`, payload);
    setRecording(null);
    toast(`${res.data.record.vaccineName} recorded`);
    load();
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.delete(`/vaccinations/${deleting.id}`);
      setDeleting(null);
      toast("Vaccination removed");
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const overdue = data?.schedule.filter((s) => s.next.status === "overdue").length || 0;

  return (
    <>
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Vaccinations
      </div>
      <div className="file-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base">Schedule</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Due dates are worked out from what&apos;s been given, not typed in.
            </p>
          </div>
          {canWrite && <Button size="sm" onClick={() => setRecording("")}>Record a vaccination</Button>}
        </div>

        {overdue > 0 && (
          <div className="border-y border-clay/30 bg-clay-soft px-5 py-3 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-clay-ink">
              Overdue
            </p>
            <p className="mt-0.5 text-[14px] text-clay-ink">
              {overdue} {overdue === 1 ? "vaccination is" : "vaccinations are"} past due.
            </p>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-line border-t border-line">
            {[0, 1].map((i) => (
              <div key={i} className="px-5 py-4 sm:px-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="border-t border-line px-6 py-8 text-center">
            <p className="text-[14px] text-ink">{error}</p>
            <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
          </div>
        ) : data?.schedule.length === 0 ? (
          <p className="border-t border-line px-6 py-8 text-center text-[14px] text-ink-soft">
            No vaccines are set up for {data.pet.species}s yet. An administrator can
            seed the catalogue.
          </p>
        ) : (
          <>
            {!data.pet.dateOfBirth && (
              <p className="border-t border-line bg-paper px-5 py-3 text-[13px] text-ink-soft sm:px-6">
                {data.pet.name} has no date of birth on file, so first doses can&apos;t be
                scheduled. Add one on the chart and these dates will fill in.
              </p>
            )}
            <ul className="divide-y divide-line border-t border-line">
              {data.schedule.map((entry) => (
                <VaccineRow
                  key={entry.vaccineType.id}
                  entry={entry}
                  canWrite={canWrite}
                  onRecord={(id) => setRecording(id)}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={recording !== null}
        onClose={() => setRecording(null)}
        title="Record a vaccination"
        description={data ? `${data.pet.name} · ${data.pet.petCode}` : ""}
      >
        {data && (
          <RecordForm
            pet={data.pet}
            catalogue={catalogue}
            preselectId={recording}
            onSubmit={record}
            onCancel={() => setRecording(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Remove this vaccination?"
        body="Use this to correct a mistaken entry. The next due date will be recalculated from what's left."
        confirmLabel="Remove"
      />
    </>
  );
}
