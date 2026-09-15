import { cutoffLabel } from "./format";
import type { Cutoff, PdCheckResult } from "./types";

/**
 * A priority date is current when the cut-off is Current (C / null)
 * or the PD is on or before the cut-off date.
 * Unavailable (U) is never current.
 */
export function checkPriorityDate(pd: string, cutoff: Cutoff): PdCheckResult {
  const label = cutoffLabel(cutoff);

  if (cutoff === "U") {
    return {
      status: "unavailable",
      current: false,
      cutoff,
      cutoffLabel: label,
      reason: "Visa numbers are unavailable (U) for this category in this bulletin.",
    };
  }

  if (cutoff === null) {
    return {
      status: "current",
      current: true,
      cutoff,
      cutoffLabel: label,
      reason: "Cut-off is Current (C) — all pending priority dates may file / be approved.",
    };
  }

  if (pd <= cutoff) {
    return {
      status: "current",
      current: true,
      cutoff,
      cutoffLabel: label,
      reason: `Priority date ${pd} is on or before the cut-off ${cutoff}.`,
    };
  }

  return {
    status: "not-current",
    current: false,
    cutoff,
    cutoffLabel: label,
    reason: `Priority date ${pd} is after the cut-off ${cutoff}.`,
  };
}
