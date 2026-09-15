export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-5 text-slate-500 sm:px-6">
        <p>
          <strong className="font-semibold text-slate-700">Unofficial.</strong>{" "}
          PD Tracker is not affiliated with the U.S. Department of State or
          USCIS. It is not legal advice. Cut-off dates can be wrong or stale —
          always confirm against the{" "}
          <a
            className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
            target="_blank"
            rel="noreferrer"
          >
            official Visa Bulletin
          </a>{" "}
          and USCIS guidance.
        </p>
        <p>
          Table A / Table B history is separate from USCIS&apos;s monthly
          &quot;which chart to use for AOS&quot; flag.{" "}
          <span className="text-slate-400">C = Current (null in JSON) · U =
          Unavailable.</span>
        </p>
      </div>
    </footer>
  );
}
