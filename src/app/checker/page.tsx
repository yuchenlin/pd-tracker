import { PdChecker } from "@/components/PdChecker";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PD Checker — PD Tracker",
  description:
    "Check whether a priority date is current for Table A and Table B in the latest Visa Bulletin seed data.",
};

export default function CheckerPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <PdChecker />
    </main>
  );
}
