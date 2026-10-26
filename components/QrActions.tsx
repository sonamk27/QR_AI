"use client";

import { useState } from "react";
import Link from "next/link";
import { extractSocialHandle } from "@/lib/social-format";

export function OpenQrButton({
  qrId,
  name,
  location,
  tableNo,
  restaurantName,
  logoUrl,
  brandColor = "#B58A4B",
  googleReviewUrl,
  instagramUrl,
  facebookUrl,
  shareCaption,
}: {
  qrId: string;
  name: string;
  location?: string | null;
  tableNo?: string | null;
  restaurantName: string;
  logoUrl?: string | null;
  brandColor?: string;
  googleReviewUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  shareCaption?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"card" | "raw">("card");

  const igHandle = extractSocialHandle(instagramUrl, "instagram");
  const fbHandle = extractSocialHandle(facebookUrl, "facebook");
  const placement = [location, tableNo ? `Table ${tableNo}` : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <>
      <button
        type="button"
        className="rounded-xl border border-[#E8DFD1] bg-white px-2.5 py-1 text-xs font-semibold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition"
        onClick={() => setOpen(true)}
      >
        Open QR &amp; Stand Card
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`qr-title-${qrId}`}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-[#E8DFD1] bg-white p-6 text-center shadow-2xl my-8"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-3 text-left">
              <div>
                <h2 id={`qr-title-${qrId}`} className="font-serif text-lg font-bold text-[#24211E]">{name}</h2>
                <p className="text-xs text-[#716B64]">Table stand card and high-resolution QR downloads.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-3 text-[#716B64] hover:text-[#24211E] text-base font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex rounded-xl bg-[#FAF7F2] p-1 border border-[#E8DFD1] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "card"
                    ? "bg-white text-[#24211E] shadow-2xs font-bold"
                    : "text-[#716B64] hover:text-[#24211E]"
                }`}
              >
                🪧 Table Stand Card
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "raw"
                    ? "bg-white text-[#24211E] shadow-2xs font-bold"
                    : "text-[#716B64] hover:text-[#24211E]"
                }`}
              >
                🖼️ Raw QR Code
              </button>
            </div>

            {/* Content: Table Stand Card Preview */}
            {activeTab === "card" && (
              <div className="space-y-4">
                <div className="relative mx-auto max-w-xs rounded-2xl border border-[#E8DFD1] bg-white p-5 text-center shadow-subtle">
                  <div
                    className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl bg-[#B58A4B]"
                  />

                  {/* Header */}
                  <div className="pt-1">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt=""
                        className="mx-auto mb-1.5 h-12 w-12 rounded-full object-cover border border-[#E8DFD1] shadow-2xs"
                      />
                    )}
                    <h3 className="font-serif font-bold text-[#24211E] text-base">{restaurantName}</h3>
                    {placement && (
                      <span className="mt-1 inline-block rounded-full bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-0.5 text-[10px] font-semibold text-[#7A5826]">
                        {placement}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-semibold text-[#24211E]">Enjoyed your experience?</p>
                  <p className="text-[11px] text-[#716B64]">Scan to collect stamps &amp; write a review</p>

                  {/* QR Image */}
                  <div className="my-3 flex justify-center">
                    <div className="rounded-xl border border-[#E8DFD1] bg-white p-2 shadow-inner">
                      <img
                        src={`/api/qr/${qrId}/download?format=png&inline=1`}
                        alt={`QR code for ${name}`}
                        className="h-36 w-36 object-contain"
                      />
                    </div>
                  </div>

                  {/* Social Badges */}
                  <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#716B64] text-center">
                      Connect &amp; Share
                    </p>

                    {igHandle && (
                      <div className="flex items-center justify-between rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-[#24211E] flex items-center gap-1.5">
                          Instagram
                        </span>
                        <span className="font-mono text-[#7A5826]">{igHandle}</span>
                      </div>
                    )}

                    {fbHandle && (
                      <div className="flex items-center justify-between rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-[#24211E] flex items-center gap-1.5">
                          Facebook
                        </span>
                        <span className="font-mono text-[#7A5826]">{fbHandle}</span>
                      </div>
                    )}

                    {googleReviewUrl && (
                      <div className="flex items-center justify-between rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-[#24211E] flex items-center gap-1.5">
                          Google Reviews
                        </span>
                        <span className="text-[10px] font-medium text-[#B58A4B]">★ ★ ★ ★ ★</span>
                      </div>
                    )}
                  </div>

                  {shareCaption && (
                    <p className="mt-2 text-[10px] italic text-[#716B64]">
                      &ldquo;{shareCaption}&rdquo;
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[#E8DFD1]/60">
                  <Link
                    href={`/dashboard/qr/${qrId}/print`}
                    target="_blank"
                    className="rounded-xl bg-[#24211E] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-stone-800 transition flex items-center gap-1.5"
                  >
                    <span>🖨️</span>
                    <span>Print Stand Card (Full Page)</span>
                  </Link>
                  <a
                    className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2 text-xs font-semibold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition"
                    href={`/api/qr/${qrId}/download?format=png`}
                    download
                  >
                    Download PNG
                  </a>
                </div>
              </div>
            )}

            {/* Content: Raw QR */}
            {activeTab === "raw" && (
              <div className="space-y-4">
                <div className="flex justify-center rounded-2xl bg-[#FAF7F2] p-6 border border-[#E8DFD1]">
                  <img
                    src={`/api/qr/${qrId}/download?format=png&inline=1`}
                    alt={`QR code for ${name}`}
                    className="h-56 w-56 object-contain"
                  />
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 border-t border-[#E8DFD1]/60">
                  <a
                    className="rounded-xl bg-[#B58A4B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition"
                    href={`/api/qr/${qrId}/download?format=png`}
                    download
                  >
                    Download PNG (High-Res)
                  </a>
                  <a
                    className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2 text-xs font-semibold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition"
                    href={`/api/qr/${qrId}/download?format=svg`}
                    download
                  >
                    Download Vector SVG
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
