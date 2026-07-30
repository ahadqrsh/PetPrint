"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import StatusChip from "@/components/StatusChip";
import ListingImage from "@/components/ListingImage";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import { ErrorNote } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/pets";

function ApplyForm({ listing, onSubmit, onCancel }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(message);
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink">Your message</span>
          <span className="text-[12px] text-ink-faint">{message.length}/2000</span>
        </span>
        <textarea
          rows={5}
          autoFocus
          maxLength={2000}
          value={message}
          placeholder={`Tell the team about your home and why ${listing.name} would suit it — other pets, garden, who's home during the day.`}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
        />
      </label>
      <p className="mt-2 text-[12px] text-ink-faint">
        The clinic will see your name, email, and phone number alongside this message.
      </p>
      <ErrorNote>{error}</ErrorNote>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send application"}
        </Button>
      </div>
    </form>
  );
}

export default function ListingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const isStaff = user.role !== "owner";
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/adoptions/${id}`);
      setListing(res.data.listing);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function apply(message) {
    await api.post(`/adoptions/${id}/apply`, { message });
    setApplying(false);
    toast("Application sent — the clinic will be in touch");
    load();
  }

  async function withdraw() {
    setBusy(true);
    try {
      await api.delete(`/adoptions/applications/${listing.myApplication.id}`);
      setWithdrawing(false);
      toast("Application withdrawn");
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/adoptions/${id}`);
      toast("Listing deleted");
      router.replace("/adoptions");
    } catch (err) {
      toast(apiError(err), "error");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="file-tab"><span className="h-1.5 w-1.5 rounded-full bg-brass" />Listing</div>
        <div className="file-sheet p-6">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="mt-4 h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="file-tab"><span className="h-1.5 w-1.5 rounded-full bg-brass" />Listing</div>
        <div className="file-sheet px-6 py-12 text-center">
          <h1 className="text-xl">{error}</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            The listing may have been removed, or it belongs to another clinic.
          </p>
          <Link href="/adoptions" className="mt-4 inline-block">
            <Button variant="secondary">Back to adoptions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const mine = listing.myApplication;
  const canApply = !isStaff && !mine && listing.status !== "adopted";

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <div className="file-tab">
          <span className="h-1.5 w-1.5 rounded-full bg-brass" />
          Listing
        </div>
        <div className="file-sheet overflow-hidden">
          <ListingImage
            src={listing.imageUrl}
            alt={listing.name}
            species={listing.species}
            className="h-64 w-full sm:h-80"
          />

          <div className="px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1>{listing.name}</h1>
                <p className="mt-0.5 text-[14px] text-ink-soft">
                  {listing.breed || (listing.species === "cat" ? "Cat" : "Dog")}
                  {" · listed "}
                  {formatDate(listing.createdAt)}
                </p>
              </div>
              <StatusChip status={listing.status} />
            </div>

            {listing.description ? (
              <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-[15px] leading-relaxed text-ink">
                {listing.description}
              </p>
            ) : (
              <p className="mt-4 border-t border-line pt-4 text-[14px] text-ink-faint">
                No description was added to this listing.
              </p>
            )}

            {listing.postedBy && (
              <p className="mt-4 text-[13px] text-ink-soft">
                Posted by {listing.postedBy.name}
              </p>
            )}

            {/* ---- Owner: apply, or track the application already sent ---- */}
            {!isStaff && (
              <div className="mt-5 border-t border-line pt-4">
                {mine ? (
                  <div className="rounded-md border border-line bg-paper px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-ink">
                        You applied on {formatDate(mine.createdAt)}
                      </p>
                      <StatusChip status={mine.status} />
                    </div>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      {mine.status === "applied" &&
                        "The clinic is reviewing applications. You can withdraw yours until they decide."}
                      {mine.status === "approved" &&
                        `Your application was approved — the clinic will arrange collection of ${listing.name}.`}
                      {mine.status === "rejected" &&
                        "This one went to another home. Other animals may still be available."}
                    </p>
                    {mine.status === "applied" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setWithdrawing(true)}
                      >
                        Withdraw application
                      </Button>
                    )}
                  </div>
                ) : listing.status === "adopted" ? (
                  <p className="text-[14px] text-ink-soft">
                    {listing.name} has found a home. Have a look at who else is waiting.
                  </p>
                ) : (
                  <>
                    <Button onClick={() => setApplying(true)}>Apply to adopt {listing.name}</Button>
                    {listing.status === "pending" && (
                      <p className="mt-2 text-[13px] text-ink-soft">
                        Someone else has applied, but no decision has been made yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ---- Staff: manage ---- */}
            {isStaff && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Link href="/adoptions/applications">
                  <Button variant="secondary" size="sm">
                    {listing.applicationCount || 0} open{" "}
                    {listing.applicationCount === 1 ? "application" : "applications"}
                  </Button>
                </Link>
                <button
                  onClick={() => setDeleting(true)}
                  className="ml-auto text-[12px] font-semibold text-ink-faint underline underline-offset-2 hover:text-clay-ink"
                >
                  Delete listing
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/adoptions"
            className="text-[13px] font-semibold text-jade underline underline-offset-2"
          >
            ← All listings
          </Link>
        </div>
      </div>

      <Modal
        open={applying}
        onClose={() => setApplying(false)}
        title={`Apply to adopt ${listing.name}`}
        description="The clinic reviews every application before deciding."
      >
        <ApplyForm listing={listing} onSubmit={apply} onCancel={() => setApplying(false)} />
      </Modal>

      <ConfirmDialog
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        onConfirm={withdraw}
        busy={busy}
        title="Withdraw your application?"
        body={`You can apply for ${listing.name} again later, as long as they're still available.`}
        confirmLabel="Withdraw"
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        busy={busy}
        title={`Delete ${listing.name}'s listing?`}
        body="The listing and every application made for it are removed. This can't be undone."
        confirmLabel="Delete listing"
      />
    </>
  );
}
