"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import PetCode from "@/components/PetCode";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/pets";

function TrashSection({ title, items, loading, onRestore, restoringId, renderLabel, renderMeta, emptyBody }) {
  return (
    <div>
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        {title}
      </div>
      <div className="file-sheet">
        {loading ? (
          <div className="divide-y divide-line">
            {[0, 1].map((i) => (
              <div key={i} className="px-5 py-3.5 sm:px-6">
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-[14px] text-ink-soft sm:px-6">{emptyBody}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-ink">{renderLabel(item)}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">{renderMeta(item)}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={restoringId === item.id}
                  onClick={() => onRestore(item.id)}
                >
                  {restoringId === item.id ? "Restoring…" : "Restore"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TrashView() {
  const toast = useToast();
  const [pets, setPets] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [petsRes, recordsRes] = await Promise.all([
        api.get("/trash/pets"),
        api.get("/trash/records")
      ]);
      setPets(petsRes.data.pets);
      setRecords(recordsRes.data.records);
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function restorePet(id) {
    setRestoringId(id);
    try {
      await api.post(`/trash/pets/${id}/restore`);
      toast("Pet restored");
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setRestoringId(null);
    }
  }

  async function restoreRecord(id) {
    setRestoringId(id);
    try {
      await api.post(`/trash/records/${id}/restore`);
      toast("Record restored");
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <PageHeader
        tab="Trash"
        title="Deleted items"
        description="Deleting a pet or a visit record doesn't erase it — it moves here, where it can be restored. Nothing here is ever removed automatically."
      />

      <div className="mt-6 space-y-6">
        <TrashSection
          title="Pets"
          items={pets}
          loading={loading}
          onRestore={restorePet}
          restoringId={restoringId}
          emptyBody="No deleted pets."
          renderLabel={(p) => (
            <span className="flex items-center gap-2">
              {p.name} <PetCode code={p.petCode} size="sm" />
            </span>
          )}
          renderMeta={(p) => `Deleted ${formatDate(p.deletedAt)}`}
        />

        <TrashSection
          title="Medical records"
          items={records}
          loading={loading}
          onRestore={restoreRecord}
          restoringId={restoringId}
          emptyBody="No deleted records."
          renderLabel={(r) => (
            <Link href={`/pets/${r.petId}`} className="text-jade underline underline-offset-2">
              {r.petName}
            </Link>
          )}
          renderMeta={(r) => `Visit on ${formatDate(r.visitDate)} · deleted ${formatDate(r.deletedAt)}`}
        />
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Protected roles={["admin"]}>
      <TrashView />
    </Protected>
  );
}
