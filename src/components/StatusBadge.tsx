import type { PdStatus } from "@/lib/types";

const STYLES: Record<PdStatus, string> = {
  current: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  "not-current": "bg-rose-50 text-rose-800 ring-rose-600/20",
  unavailable: "bg-amber-50 text-amber-900 ring-amber-600/20",
};

const LABELS: Record<PdStatus, string> = {
  current: "Current",
  "not-current": "Not current",
  unavailable: "Unavailable",
};

export function StatusBadge({ status }: { status: PdStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
