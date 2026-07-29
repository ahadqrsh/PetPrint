"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import Button from "@/components/ui/Button";
import PetCode from "@/components/PetCode";

// QR target. Resolves the code to a pet inside the caller's clinic, then
// forwards to the chart. A code from another clinic 404s like an unknown one.
export default function ScanPage() {
  const { petCode } = useParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/pets/code/${encodeURIComponent(petCode)}`)
      .then((res) => router.replace(`/pets/${res.data.pet.id}`))
      .catch((err) => setError(apiError(err)));
  }, [petCode, router]);

  return (
    <div>
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Scan
      </div>
      <div className="file-sheet px-6 py-14 text-center">
        <div className="mx-auto mb-4 w-fit">
          <PetCode code={decodeURIComponent(petCode)} />
        </div>

        {error ? (
          <>
            <h1 className="text-xl">{error}</h1>
            <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-soft">
              Check the code on the tag, or search for the pet by name instead.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/pets"><Button>Search pets</Button></Link>
            </div>
          </>
        ) : (
          <p className="data text-[12px] uppercase tracking-[0.16em] text-ink-faint">
            Opening chart
          </p>
        )}
      </div>
    </div>
  );
}
