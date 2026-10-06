"use client";

import { useState } from "react";

export function OpenQrButton({ qrId, name }: { qrId: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-ghost !px-2.5 !py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        Open QR
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`qr-title-${qrId}`}
            className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 text-center shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3 text-left">
              <div>
                <h2 id={`qr-title-${qrId}`} className="text-lg font-semibold text-ink">{name}</h2>
                <p className="text-xs text-ink/60">Scan this QR code to open your restaurant feedback page.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-3 text-ink/50 hover:text-ink text-sm"
                aria-label="Close QR code"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center rounded-xl bg-white p-3">
              <img
                src={`/api/qr/${qrId}/download?format=png&inline=1`}
                alt={`QR code for ${name}`}
                className="h-64 w-64 object-contain"
              />
            </div>

            <div className="flex justify-start border-t border-line pt-3">
              <a
                className="btn text-xs"
                href={`/api/qr/${qrId}/download?format=png`}
                download
              >
                Download QR
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
