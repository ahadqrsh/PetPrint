"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api, { apiError } from "@/lib/api";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import { TextInput, SelectInput, ErrorNote } from "@/components/ui/Field";
import ImagePicker from "@/components/ImagePicker";
import { useToast } from "@/components/ui/Toast";

function NewListing() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "", species: "dog", breed: "", description: ""
  });
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Multipart: let the browser set the boundary — don't set Content-Type.
      const data = new FormData();
      data.append("name", form.name);
      data.append("species", form.species);
      data.append("breed", form.breed);
      data.append("description", form.description);
      if (image) data.append("image", image);

      const res = await api.post("/adoptions", data);
      toast(`${res.data.listing.name} is now listed`);
      router.replace(`/adoptions/${res.data.listing.id}`);
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <PageHeader
      tab="New listing"
      title="Post an animal for adoption"
      description="Owners registered at this clinic will see this listing and can apply."
    >
      <form onSubmit={onSubmit} className="border-t border-line px-5 py-5 sm:px-6">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <TextInput
            label="Name" required autoFocus value={form.name}
            placeholder="What are you calling them?"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextInput
            label="Breed" hint="Optional" value={form.breed}
            placeholder="e.g. Tabby, or Mixed"
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
          />
          <SelectInput
            label="Species" value={form.species}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
          </SelectInput>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink">Description</span>
            <span className="text-[12px] text-ink-faint">
              {form.description.length}/2000
            </span>
          </span>
          <textarea
            rows={5}
            maxLength={2000}
            value={form.description}
            placeholder="Temperament, history, whether they're good with children or other animals, anything a new home should know."
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
          />
        </label>

        <ImagePicker
          hint="Optional, but listings with a photo get far more interest"
          onChange={setImage}
        />

        <ErrorNote>{error}</ErrorNote>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Publishing…" : "Publish listing"}
          </Button>
        </div>
      </form>
    </PageHeader>
  );
}

export default function Page() {
  return (
    <Protected roles={["vet", "admin"]}>
      <NewListing />
    </Protected>
  );
}
