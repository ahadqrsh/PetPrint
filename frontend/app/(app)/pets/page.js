"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SearchBar from "@/components/SearchBar";
import PetCode from "@/components/PetCode";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { describePet } from "@/lib/pets";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "dog", label: "Dogs" },
  { id: "cat", label: "Cats" }
];

function PetsList() {
  const { user } = useAuth();
  const isStaff = user.role !== "owner";

  const [pets, setPets] = useState([]);
  const searchParams = useSearchParams();
  // Driven by the dashboard's allergy alert: /pets?hasAllergies=true
  const [allergyOnly, setAllergyOnly] = useState(
    searchParams.get("hasAllergies") === "true"
  );
  const [species, setSpecies] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (species !== "all") params.species = species;
      if (allergyOnly) params.hasAllergies = "true";
      const res = await api.get("/pets", { params });
      setPets(res.data.pets);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [species, allergyOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageHeader
      tab={isStaff ? "Patients" : "My pets"}
      title={isStaff ? "Pets" : "My pets"}
      description={
        isStaff
          ? "Every pet registered at this clinic. Open one to see its full history."
          : "Your pets and their complete medical history at this clinic."
      }
      action={<Button onClick={() => (window.location.href = "/pets/new")}>Register a pet</Button>}
    >
      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex-1">
          <SearchBar
            placeholder={
              isStaff ? "Search by name, owner, or code" : "Search your pets by name or code"
            }
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allergyOnly && (
            <button
              onClick={() => setAllergyOnly(false)}
              className="rounded-md border border-clay/40 bg-clay-soft px-3 py-1.5 text-[13px] font-semibold text-clay-ink transition-colors hover:border-clay"
              title="Show all pets again"
            >
              With allergies ×
            </button>
          )}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSpecies(f.id)}
              aria-pressed={species === f.id}
              className={[
                "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                species === f.id
                  ? "border-jade bg-jade/10 text-jade-deep"
                  : "border-line-strong bg-white text-ink-soft hover:text-ink"
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="divide-y divide-line border-t border-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-4 sm:px-6">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-t border-line px-6 py-10 text-center">
          <p className="text-[14px] text-ink">{error}</p>
          <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : pets.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState
            title={
              allergyOnly
                ? "No pets with recorded allergies"
                : species === "all"
                  ? "No pets on file yet"
                  : `No ${species}s on file`
            }
            body={
              species === "all"
                ? "Register a pet to start its chart. Every visit you record after that lands on the same timeline."
                : "Try a different filter, or register one."
            }
            action={
              <Link href="/pets/new">
                <Button>Register a pet</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line border-t border-line">
            {pets.map((pet, i) => (
              <li
                key={pet.id}
                className="animate-rise-in"
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              >
                <Link
                  href={`/pets/${pet.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-paper/60 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">{pet.name}</span>
                      {pet.allergies.length > 0 && (
                        <span className="chip border-clay/40 bg-clay-soft text-clay-ink">
                          Allergy on file
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-soft">
                      {describePet(pet)}
                      {isStaff && pet.owner ? ` · ${pet.owner.name}` : ""}
                    </span>
                  </span>
                  <PetCode code={pet.petCode} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3 sm:px-6">
            <p className="data text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {pets.length} {pets.length === 1 ? "pet" : "pets"}
            </p>
          </div>
        </>
      )}
    </PageHeader>
  );
}

/**
 * useSearchParams needs a Suspense boundary on a prerendered route, otherwise
 * Next bails out of static rendering for the whole page.
 */
export default function PetsPage() {
  return (
    <Suspense fallback={null}>
      <PetsList />
    </Suspense>
  );
}
