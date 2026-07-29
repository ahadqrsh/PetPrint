"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PetCode from "./PetCode";

// Search runs against name, owner name, and pet code at once — the three
// things someone at a front desk actually has to hand.
export default function SearchBar({ placeholder = "Search pets by name, owner, or code" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      api
        .get("/search", { params: { q } })
        .then((res) => { setResults(res.data.pets); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(id) {
    setOpen(false);
    setQ("");
    router.push(`/pets/${id}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
      />

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-soft">
              {busy ? "Searching…" : `Nothing matches "${q}".`}
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {results.map((pet) => (
                <li key={pet.id}>
                  <button
                    onClick={() => go(pet.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-paper"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">
                          {pet.name}
                        </span>
                        {pet.hasAllergies && (
                          <span className="chip border-clay/40 bg-clay-soft text-clay-ink">
                            Allergy
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[12px] text-ink-soft">
                        {[pet.breed, pet.ownerName && `owner: ${pet.ownerName}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <PetCode code={pet.petCode} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
