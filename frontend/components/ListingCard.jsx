"use client";

import Link from "next/link";
import StatusChip from "./StatusChip";
import ListingImage from "./ListingImage";

export default function ListingCard({ listing, isStaff }) {
  return (
    <Link
      href={`/adoptions/${listing.id}`}
      className="group block overflow-hidden rounded-lg border border-line bg-white transition-colors hover:border-jade"
    >
      <ListingImage
        src={listing.imageUrl}
        alt={listing.name}
        species={listing.species}
        className="h-44 w-full"
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base">{listing.name}</h2>
          <StatusChip status={listing.status} />
        </div>

        <p className="mt-0.5 text-[13px] text-ink-soft">
          {listing.breed || (listing.species === "cat" ? "Cat" : "Dog")}
        </p>

        {listing.description && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {listing.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          {isStaff ? (
            <span className="data text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {listing.applicationCount || 0}{" "}
              {listing.applicationCount === 1 ? "application" : "applications"}
            </span>
          ) : listing.myApplication ? (
            <StatusChip status={listing.myApplication.status} />
          ) : (
            <span className="data text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Read more
            </span>
          )}
          <span className="text-[13px] font-semibold text-jade group-hover:underline">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}
