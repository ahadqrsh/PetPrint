"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import Button from "@/components/ui/Button";

/**
 * Deliberately outside both the (auth) and (app) route groups: someone can
 * land here whether or not they're currently signed in — most people click a
 * verification link while still logged in on another tab — so this must not
 * be caught by either group's guard.
 */
export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState("checking"); // checking | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .post("/auth/verify-email", { token })
      .then(() => { if (!cancelled) setStatus("success"); })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(apiError(err));
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="file-sheet p-6 text-center">
        {status === "checking" && (
          <p className="text-[14px] text-ink-soft">Confirming your email…</p>
        )}

        {status === "success" && (
          <>
            <h1 className="text-lg font-semibold text-ink">Email confirmed</h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              Thanks — {"you're"} all set.
            </p>
            <Link href="/dashboard">
              <Button className="mt-4 w-full">Continue to PetPrint</Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-lg font-semibold text-ink">Link expired</h1>
            <p className="mt-2 text-[14px] text-ink-soft">{message}</p>
            <p className="mt-1 text-[13px] text-ink-faint">
              Sign in and request a new verification email from your account.
            </p>
            <Link href="/login">
              <Button variant="secondary" className="mt-4 w-full">Go to sign in</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
