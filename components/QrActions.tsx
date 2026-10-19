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
  brandColor = "#1F6F5C",
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
        className="btn-ghost !px-2.5 !py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        Open QR &amp; Stand Card
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm overflow-y-auto"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`qr-title-${qrId}`}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-line bg-white p-6 text-center shadow-2xl my-8"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line pb-3 text-left">
              <div>
                <h2 id={`qr-title-${qrId}`} className="text-lg font-semibold text-ink">{name}</h2>
                <p className="text-xs text-ink/60">Table stand card and high-resolution QR downloads.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-3 text-ink/50 hover:text-ink text-sm font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex rounded-xl bg-zinc-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "card"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                🪧 Table Stand Card (with Social Badges)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "raw"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                🖼️ Raw QR Code
              </button>
            </div>

            {/* Content: Table Stand Card Preview */}
            {activeTab === "card" && (
              <div className="space-y-4">
                <div className="relative mx-auto max-w-xs rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-md">
                  {/* Brand accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl"
                    style={{ backgroundColor: brandColor }}
                  />

                  {/* Header */}
                  <div className="pt-1">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt=""
                        className="mx-auto mb-1.5 h-12 w-12 rounded-full object-cover shadow-sm"
                      />
                    )}
                    <h3 className="font-bold text-ink text-base">{restaurantName}</h3>
                    {placement && (
                      <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                        {placement}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-semibold text-ink">Enjoyed your experience?</p>
                  <p className="text-[11px] text-ink/60">Scan to rate us &amp; generate an AI review</p>

                  {/* QR Image */}
                  <div className="my-3 flex justify-center">
                    <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-inner">
                      <img
                        src={`/api/qr/${qrId}/download?format=png&inline=1`}
                        alt={`QR code for ${name}`}
                        className="h-36 w-36 object-contain"
                      />
                    </div>
                  </div>

                  {/* Social Badges */}
                  <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40 text-center">
                      Connect &amp; Share
                    </p>

                    {igHandle && (
                      <div className="flex items-center justify-between rounded-lg border border-pink-100 bg-pink-50/60 px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-pink-900 flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-pink-600">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                          </svg>
                          Instagram
                        </span>
                        <span className="font-mono text-pink-700">{igHandle}</span>
                      </div>
                    )}

                    {fbHandle && (
                      <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-blue-600">
                            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                          </svg>
                          Facebook
                        </span>
                        <span className="font-mono text-blue-700">{fbHandle}</span>
                      </div>
                    )}

                    {googleReviewUrl && (
                      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px]">
                        <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                            <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.6C3.7 20.4 7.5 23.2 12 23.2z" />
                          </svg>
                          Google Reviews
                        </span>
                        <span className="text-[10px] font-medium text-emerald-700">★ ★ ★ ★ ★</span>
                      </div>
                    )}
                  </div>

                  {shareCaption && (
                    <p className="mt-2 text-[10px] italic text-zinc-500">
                      &ldquo;{shareCaption}&rdquo;
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-line">
                  <Link
                    href={`/dashboard/qr/${qrId}/print`}
                    target="_blank"
                    className="btn !bg-ink !text-white flex items-center gap-1.5 text-xs shadow-sm"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print Stand Card (Full Page)
                  </Link>
                  <a
                    className="btn-ghost !border-line border text-xs"
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
                <div className="flex justify-center rounded-2xl bg-zinc-50 p-6 border border-zinc-200">
                  <img
                    src={`/api/qr/${qrId}/download?format=png&inline=1`}
                    alt={`QR code for ${name}`}
                    className="h-56 w-56 object-contain"
                  />
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 border-t border-line">
                  <a
                    className="btn text-xs"
                    href={`/api/qr/${qrId}/download?format=png`}
                    download
                  >
                    Download PNG (High-Res)
                  </a>
                  <a
                    className="btn-ghost !border-line border text-xs"
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
