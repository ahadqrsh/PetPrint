"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ListingCard from "@/components/ListingCard";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

export default function AdoptionsPage() {
  const { user } = useAuth();
  const isStaff = user.role !== "owner";

  const [listings, setListings] = useState([]);
  const [species, setSpecies] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (species !== "all") params.species = species;
      if (status !== "all") params.status = status;
      const res = await api.get("/adoptions", { params });
      setListings(res.data.listings);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [species, status]);

  useEffect(() => { load(); }, [load]);

  const statusOptions = isStaff
    ? [
        { id: "all", label: "All" },
        { id: "available", label: "Available" },
        { id: "pending", label: "Pending" },
        { id: "adopted", label: "Adopted" }
      ]
    : [
        { id: "all", label: "Looking for a home" },
        { id: "adopted", label: "Already adopted" }
      ];

  return (
    <PageHeader
      tab="Adoption"
      title={isStaff ? "Adoption listings" : "Looking for a home"}
      description={
        isStaff
          ? "Animals your clinic has posted for adoption. Applications arrive in the review queue."
          : "Cats and dogs at this clinic waiting for a home. Open one to apply."
      }
      action={
        isStaff ? (
          <div className="flex gap-2">
            <Link href="/adoptions/applications">
              <Button variant="secondary">Applications</Button>
            </Link>
            <Link href="/adoptions/new">
              <Button>New listing</Button>
            </Link>
          </div>
        ) : (
          <Link href="/adoptions/applications">
            <Button variant="secondary">My applications</Button>
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => setStatus(o.id)}
              aria-pressed={status === o.id}
              className={[
                "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                status === o.id
                  ? "border-jade bg-jade/10 text-jade-deep"
                  : "border-line-strong bg-white text-ink-soft hover:text-ink"
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[
            { id: "all", label: "All" },
            { id: "dog", label: "Dogs" },
            { id: "cat", label: "Cats" }
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setSpecies(o.id)}
              aria-pressed={species === o.id}
              className={[
                "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                species === o.id
                  ? "border-jade bg-jade/10 text-jade-deep"
                  : "border-line-strong bg-white text-ink-soft hover:text-ink"
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-line p-5 sm:p-6">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-line">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-[14px] text-ink">{error}</p>
            <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            title={isStaff ? "No listings yet" : "Nothing available right now"}
            body={
              isStaff
                ? "Post a cat or dog and owners at this clinic will see it straight away."
                : "Check back soon — new animals are posted as they come in."
            }
            action={
              isStaff ? (
                <Link href="/adoptions/new"><Button>New listing</Button></Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing, i) => (
                <div
                  key={listing.id}
                  className="animate-rise-in"
                  style={{ animationDelay: `${Math.min(i, 9) * 35}ms` }}
                >
                  <ListingCard listing={listing} isStaff={isStaff} />
                </div>
              ))}
            </div>
            <p className="data mt-5 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {listings.length} {listings.length === 1 ? "listing" : "listings"}
            </p>
          </>
        )}
      </div>
    </PageHeader>
  );
}
