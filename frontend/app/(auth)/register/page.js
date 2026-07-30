"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import api, { apiError } from "@/lib/api";
import { TextInput, SelectInput, ErrorNote } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const { registerOwner, registerClinic } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("owner");
  const [clinics, setClinics] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [owner, setOwner] = useState({
    name: "", email: "", password: "", phone: "", clinicId: ""
  });
  const [clinic, setClinic] = useState({
    clinicName: "", type: "private", address: "", phone: "",
    adminName: "", adminEmail: "", adminPassword: ""
  });

  useEffect(() => {
    api.get("/clinics").then((res) => setClinics(res.data.clinics)).catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "owner") {
        await registerOwner(owner);
      } else {
        await registerClinic({
          clinic: {
            name: clinic.clinicName,
            type: clinic.type,
            address: clinic.address,
            phone: clinic.phone
          },
          admin: {
            name: clinic.adminName,
            email: clinic.adminEmail,
            password: clinic.adminPassword
          }
        });
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  const tab = (id, label, sub) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={mode === id}
      onClick={() => { setMode(id); setError(""); }}
      className={[
        "flex-1 rounded-md border px-3 py-2.5 text-left transition-colors",
        mode === id
          ? "border-jade bg-jade/5 text-ink"
          : "border-line-strong bg-white text-ink-soft hover:border-line-strong hover:text-ink"
      ].join(" ")}
    >
      <span className="block text-[13px] font-semibold">{label}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{sub}</span>
    </button>
  );

  return (
    <div className="animate-rise-in">
      <p className="data text-[11px] uppercase tracking-[0.18em] text-ink-faint">New account</p>
      <h1 className="mt-1 text-[1.75rem]">Get set up</h1>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Account type">
        {tab("owner", "I own a pet", "Join a clinic you already visit")}
        {tab("clinic", "I run a clinic", "Set up a new clinic or rescue")}
      </div>

      <form onSubmit={onSubmit} className="mt-5">
        {mode === "owner" ? (
          <>
            <TextInput
              label="Your name" required value={owner.name}
              onChange={(e) => setOwner({ ...owner, name: e.target.value })}
            />
            <TextInput
              label="Email" type="email" required autoComplete="email" value={owner.email}
              onChange={(e) => setOwner({ ...owner, email: e.target.value })}
            />
            <TextInput
              label="Password" hint="8 characters or more" type="password" required
              minLength={8} autoComplete="new-password" value={owner.password}
              onChange={(e) => setOwner({ ...owner, password: e.target.value })}
            />
            <TextInput
              label="Phone" hint="Optional" value={owner.phone}
              onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
            />
            <SelectInput
              label="Where your pet is treated" required value={owner.clinicId}
              onChange={(e) => setOwner({ ...owner, clinicId: e.target.value })}
            >
              <option value="">Choose a clinic or rescue…</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.type === "ngo" ? "rescue" : "clinic"}
                </option>
              ))}
            </SelectInput>
          </>
        ) : (
          <>
            <TextInput
              label="Clinic or rescue name" required value={clinic.clinicName}
              onChange={(e) => setClinic({ ...clinic, clinicName: e.target.value })}
            />
            <SelectInput
              label="Type" value={clinic.type}
              onChange={(e) => setClinic({ ...clinic, type: e.target.value })}
            >
              <option value="private">Private clinic</option>
              <option value="ngo">Rescue or NGO</option>
            </SelectInput>
            <TextInput
              label="Address" hint="Optional" value={clinic.address}
              onChange={(e) => setClinic({ ...clinic, address: e.target.value })}
            />
            <TextInput
              label="Phone" hint="Optional" value={clinic.phone}
              onChange={(e) => setClinic({ ...clinic, phone: e.target.value })}
            />

            <p className="mt-6 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              Your admin account
            </p>
            <TextInput
              label="Your name" required value={clinic.adminName}
              onChange={(e) => setClinic({ ...clinic, adminName: e.target.value })}
            />
            <TextInput
              label="Email" type="email" required value={clinic.adminEmail}
              onChange={(e) => setClinic({ ...clinic, adminEmail: e.target.value })}
            />
            <TextInput
              label="Password" hint="8 characters or more" type="password" required
              minLength={8} autoComplete="new-password" value={clinic.adminPassword}
              onChange={(e) => setClinic({ ...clinic, adminPassword: e.target.value })}
            />
          </>
        )}

        <ErrorNote>{error}</ErrorNote>
        <Button full className="mt-5" disabled={busy}>
          {busy ? "Setting up…" : mode === "owner" ? "Create account" : "Create clinic"}
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-ink-soft">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-jade underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
