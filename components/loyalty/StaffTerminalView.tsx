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
  restaurant,
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
    <div className="mx-auto max-w-md p-6 text-center bg-white rounded-3xl border border-stone-200 shadow-sm space-y-4">
      <div className="text-4xl">⚡</div>
      <h2 className="text-lg font-bold text-stone-900">
        Staff Terminal Retired
      </h2>
      <p className="text-xs text-stone-600 leading-relaxed">
        Staff terminal login and counter PIN have been replaced with direct dynamic offers. Diners receive dynamic discounts automatically on qualifying bill amounts without requiring staff counter login.
      </p>
      <div className="pt-2 flex flex-col gap-2">
        {slug && (
          <Link
            href={`/r/${slug}/loyalty`}
            className="w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: restaurant.brandColor || "#1F6F5C" }}
          >
            Open Customer Offer Card →
          </Link>
        )}
        <Link
          href="/dashboard/loyalty"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100"
        >
          Manage Dynamic Offers in Dashboard →
        </Link>
      </div>
    </div>
  );
}
