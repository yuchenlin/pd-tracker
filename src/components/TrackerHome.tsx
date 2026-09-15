"use client";

import { ChartPanel } from "@/components/ChartPanel";
import { PdChecker } from "@/components/PdChecker";
import type { Category, Chargeability } from "@/lib/types";
import { useState } from "react";

const DEFAULT_PD = "2024-07-16";

export function TrackerHome() {
  const [category, setCategory] = useState<Category>("EB-1");
  const [chargeability, setChargeability] = useState<Chargeability>("CHINA");
  const [pd, setPd] = useState(DEFAULT_PD);

  return (
    <>
      <ChartPanel
        category={category}
        chargeability={chargeability}
        pd={pd}
        onCategoryChange={setCategory}
        onChargeabilityChange={setChargeability}
        onPdChange={setPd}
      />
      <PdChecker
        compact
        category={category}
        chargeability={chargeability}
        pd={pd}
        onCategoryChange={setCategory}
        onChargeabilityChange={setChargeability}
        onPdChange={setPd}
      />
    </>
  );
}
