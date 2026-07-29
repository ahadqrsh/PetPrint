"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import { TextInput, SelectInput, ErrorNote } from "@/components/ui/Field";
import TagInput from "@/components/TagInput";
import { useToast } from "@/components/ui/Toast";

export default function NewPetPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const isStaff = user.role !== "owner";

  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState({
    name: "", species: "dog", sex: "female", breed: "", dateOfBirth: "", ownerId: ""
  });
  const [allergies, setAllergies] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    api.get("/owners").then((res) => setOwners(res.data.owners)).catch(() => {});
  }, [isStaff]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        species: form.species,
        sex: form.sex,
        breed: form.breed,
        allergies,
        chronicConditions: conditions
      };
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (isStaff) payload.ownerId = form.ownerId;

      const res = await api.post("/pets", payload);
      toast(`${res.data.pet.name} registered as ${res.data.pet.petCode}`);
      router.push(`/pets/${res.data.pet.id}`);
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <PageHeader
      tab="New chart"
      title="Register a pet"
      description="A pet code is generated automatically — it's what the QR tag and search box use."
    >
      <form onSubmit={onSubmit} className="border-t border-line px-5 py-5 sm:px-6">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <TextInput
            label="Name" required autoFocus value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextInput
            label="Breed" hint="Optional" value={form.breed}
            placeholder="e.g. Cocker Spaniel"
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
          />
          <SelectInput
            label="Species" value={form.species}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
          </SelectInput>
          <SelectInput
            label="Sex" value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value })}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </SelectInput>
          <TextInput
            label="Date of birth" hint="Optional" type="date" value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          {isStaff && (
            <SelectInput
              label="Owner" required value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
            >
              <option value="">Choose an owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name} · {o.email}</option>
              ))}
            </SelectInput>
          )}
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <TagInput
            label="Allergies"
            hint="Shown as a warning banner on the chart"
            placeholder="Type an allergy and press Enter"
            value={allergies}
            onChange={setAllergies}
            tone="warning"
          />
          <TagInput
            label="Ongoing conditions"
            hint="Optional"
            placeholder="Type a condition and press Enter"
            value={conditions}
            onChange={setConditions}
          />
        </div>

        {isStaff && owners.length === 0 && (
          <p className="mt-4 rounded-md border border-line-strong bg-paper px-3 py-2 text-[13px] text-ink-soft">
            No owners are registered at this clinic yet. An owner needs to sign up
            before you can file a pet against them.
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Registering…" : "Register pet"}
          </Button>
        </div>
      </form>
    </PageHeader>
  );
}
