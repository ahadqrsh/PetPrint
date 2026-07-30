"use client";

import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import DownloadButton from "@/components/DownloadButton";
import Skeleton from "@/components/ui/Skeleton";
import { TextInput, ErrorNote } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/pets";

function ClinicSettings() {
  const toast = useToast();
  const [clinic, setClinic] = useState(null);
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/clinic")
      .then((res) => {
        setClinic(res.data.clinic);
        setTeam(res.data.team);
        setForm({
          name: res.data.clinic.name || "",
          address: res.data.clinic.address || "",
          phone: res.data.clinic.phone || ""
        });
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.put("/clinic", form);
      setClinic(res.data.clinic);
      toast("Clinic details saved");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        tab="Clinic"
        title="Clinic details"
        description="Your name and contact details appear on printed medical histories."
      >
        {loading ? (
          <div className="border-t border-line p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-9 w-full" />
            <Skeleton className="mt-3 h-9 w-full" />
          </div>
        ) : (
          <form onSubmit={save} className="border-t border-line px-5 py-5 sm:px-6">
            <TextInput
              label="Clinic name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextInput
              label="Address"
              hint="Shown on PDF exports"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <TextInput
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <div className="mt-5 grid gap-x-5 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
              {[
                ["Type", clinic?.type === "ngo" ? "Rescue / NGO" : "Private clinic"],
                ["Plan", clinic?.plan],
                ["On PetPrint since", formatDate(clinic?.createdAt)]
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[14px] text-ink">{value || "—"}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">
              Type and plan aren&apos;t self-serve — contact support to change them.
            </p>

            <ErrorNote>{error}</ErrorNote>

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="file-tab">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            Export
          </div>
          <div className="file-sheet p-5">
            <h2 className="text-base">Download your records</h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              Every pet and every recorded visit at this clinic, as a spreadsheet.
              One row per visit, with the pet and owner details on each row.
            </p>
            <DownloadButton
              path="/clinic/export.csv"
              filename="petprint-records.csv"
              className="mt-4"
              busyLabel="Building CSV…"
            >
              Export records as CSV
            </DownloadButton>
            <p className="mt-2 text-[12px] text-ink-faint">
              This file contains owner contact details and clinical notes. Handle it
              the way you&apos;d handle a paper file.
            </p>
          </div>
        </div>

        {team && (
          <div>
            <div className="file-tab">
              <span className="h-1.5 w-1.5 rounded-full bg-brass" />
              Team
            </div>
            <div className="file-sheet p-5">
              <div className="grid grid-cols-3 divide-x divide-line">
                {[
                  ["Admins", team.admins],
                  ["Vets", team.vets],
                  ["Owners", team.owners]
                ].map(([label, value]) => (
                  <div key={label} className="px-3 first:pl-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      {label}
                    </p>
                    <p className="data mt-0.5 text-[1.4rem] font-medium text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <a
                href="/admin/vets"
                className="mt-4 inline-block text-[13px] font-semibold text-jade underline underline-offset-2"
              >
                Manage vets
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Protected roles={["admin"]}>
      <ClinicSettings />
    </Protected>
  );
}
