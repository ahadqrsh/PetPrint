import ChartPreview from "@/components/ChartPreview";
import GuestOnly from "@/components/GuestOnly";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: what the product actually does, shown rather than described. */}
      <section className="relative hidden overflow-hidden bg-petrol px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div>
          <span className="font-display text-xl font-semibold tracking-[-0.02em] text-white">
            PetPrint
          </span>
          <h2 className="mt-10 max-w-sm font-display text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white">
            Every visit, on the same chart.
          </h2>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">
            Look a pet up by name, owner, or code and pick the treatment back up
            exactly where the last vet left it.
          </p>
        </div>

        <ChartPreview />

        <p className="data text-[11px] uppercase tracking-[0.16em] text-white/30">
          Cats &amp; dogs · Clinics &amp; rescues
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-form">
          <GuestOnly>{children}</GuestOnly>
        </div>
      </section>
    </div>
  );
}
