"use client";

import Link from "next/link";

export type TerminalProgramInfo = {
  id: string;
  title: string;
  stampsRequired: number;
  minBillAmount: number;
  rewardTitle: string;
  rewardDiscount: number;
  rewardExpiryDays: number;
  isActive: boolean;
};

export function StaffTerminalView({
  slug,
}: {
  restaurant: {
    id: string;
    name: string;
    brandColor: string;
  };
  slug?: string;
  initialProgram?: TerminalProgramInfo;
}) {
  return (
    <div className="mx-auto max-w-md p-6 text-center bg-white rounded-3xl border border-[#E8DFD1] shadow-sm space-y-4">
      <div className="text-4xl">⚡</div>
      <h2 className="text-lg font-serif font-bold text-[#24211E]">
        Staff Terminal Retired
      </h2>
      <p className="text-xs text-[#716B64] leading-relaxed">
        Staff terminal login and counter PIN have been replaced with direct dynamic offers. Diners receive dynamic discounts automatically on qualifying bill amounts without requiring staff counter login.
      </p>
      <div className="pt-2 flex flex-col gap-2">
        {slug && (
          <Link
            href={`/r/${slug}/loyalty`}
            className="w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-xs bg-[#B58A4B] hover:bg-[#9E7438] transition"
          >
            Open Customer Offer Card →
          </Link>
        )}
        <Link
          href="/dashboard/loyalty"
          className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] py-2.5 text-xs font-bold text-[#24211E] hover:bg-[#F4ECDD] transition"
        >
          Manage Dynamic Offers in Dashboard →
        </Link>
      </div>
    </div>
  );
}
