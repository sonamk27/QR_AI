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
    <div className="flex items-start gap-4">
      <div className="shrink-0">
        {value && !previewFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Business logo preview"
            onError={() => setPreviewFailed(true)}
            className="h-16 w-16 rounded-xl bg-white object-contain p-1 ring-2 ring-[#E8DFD1]"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#FAF7F2] text-2xl ring-2 ring-dashed ring-[#E8DFD1]">
            🖼
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <input type="hidden" name="logoUrl" value={value} />
        <label className="mb-1 block text-xs font-semibold text-[#716B64]" htmlFor={`${inputId}-url`}>
          Business logo <span className="font-normal text-[#716B64]/60">(optional)</span>
        </label>
        <label
          htmlFor={`${inputId}-file`}
          className={`inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-[#D8CBB6] bg-white px-3 text-xs font-semibold text-[#24211E] hover:bg-[#FAF7F2] ${disabled || processing ? "pointer-events-none opacity-60" : ""}`}
        >
          {processing ? "Preparing logo…" : "Choose image"}
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
        {value && (
          <button
            type="button"
            className="ml-2 min-h-9 rounded-lg px-2 text-xs font-semibold text-[#716B64] underline"
            disabled={disabled || processing}
            onClick={() => {
              onChange("");
              setPreviewFailed(false);
            }}
          >
            Remove logo
          </button>
        )}
        <p className="mt-1 text-[11px] text-[#716B64]">
          Upload a PNG, JPG, or WebP up to 5 MB, or paste a secure image URL.
        </p>
        <input
          id={`${inputId}-url`}
          type="url"
          value={urlValue}
          disabled={disabled || processing}
          className="mt-2 w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
          placeholder="https://example.com/logo.png"
          onChange={(event) => {
            onChange(event.target.value);
            setPreviewFailed(false);
          }}
        />
        {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
        {previewFailed && value && !value.startsWith("data:image/webp;") && (
          <p role="alert" className="mt-1 text-[11px] text-red-700">This link could not be shown as an image. Use a public direct image URL.</p>
        )}
      </div>
    </div>
  );
}
