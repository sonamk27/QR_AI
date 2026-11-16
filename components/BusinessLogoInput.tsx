"use client";

import { useId, useState } from "react";
import { prepareLogoUpload } from "../lib/logo-upload";

export function BusinessLogoInput({
  value,
  onChange,
  disabled = false,
  onProcessingChange,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const inputId = useId();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const urlValue = value.startsWith("data:image/webp;") ? "" : value;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    onProcessingChange?.(true);
    setError("");
    try {
      onChange(await prepareLogoUpload(file));
      setPreviewFailed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare this logo.");
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preview card */}
      <div className="relative flex items-center justify-center rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-4 aspect-square">
        {value && !previewFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Business logo preview"
            onError={() => setPreviewFailed(true)}
            className="h-full w-full max-h-[120px] max-w-[120px] object-contain p-2 shadow-sm"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-white p-4">
            <span className="text-3xl text-[#716B64]/40">🖼</span>
          </div>
        )}
        {value && !previewFailed && (
          <button
            type="button"
            className="absolute top-2 right-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
            onClick={() => {
              onChange("");
              setPreviewFailed(false);
            }}
            disabled={disabled || processing}
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="mb-1 block text-xs font-semibold text-[#716B64]" htmlFor={`${inputId}-url`}>
          Business logo <span className="font-normal text-[#716B64]/60">(optional)</span>
        </label>

        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
          <label
            htmlFor={`${inputId}-file`}
            className={`flex min-w-[120px] flex-1 items-center justify-center rounded-lg border border-[#D8CBB6] bg-white px-3 py-2.5 text-xs font-semibold text-[#24211E] hover:bg-[#FAF7F2] ${disabled || processing ? "pointer-events-none opacity-60" : ""}`}
          >
            {processing ? "Preparing…" : "Upload image"}
          </label>
          <input
            id={`${inputId}-file`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={disabled || processing}
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />

          <input
            id={`${inputId}-url`}
            type="url"
            value={urlValue}
            disabled={disabled || processing}
            className="flex-1 rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white sm:min-w-[200px]"
            placeholder="https://example.com/logo.png"
            onChange={(event) => {
              onChange(event.target.value);
              setPreviewFailed(false);
            }}
          />
        </div>

        <p className="mt-1 text-[11px] text-[#716B64]">
          Upload a PNG, JPG, or WebP up to 5 MB, or paste a secure image URL.
        </p>
        {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
        {previewFailed && value && !value.startsWith("data:image/webp;") && (
          <p role="alert" className="mt-1 text-[11px] text-red-700">
            This link could not be shown as an image. Use a public direct image URL.
          </p>
        )}
      </div>
    </div>
  );
}
