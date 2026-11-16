"use client";

import { useState } from "react";

type RatingStarsProps = {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  activeColor?: string;
  inactiveColor?: string;
  readonly?: boolean;
  label?: string;
};

const SIZE_MAP: Record<string, { text: string; gap: string }> = {
  sm: { text: "text-sm", gap: "gap-1" },
  md: { text: "text-base", gap: "gap-1.5" },
  lg: { text: "text-lg", gap: "gap-2" },
};

const FILLED = "★";
const EMPTY = "☆";

export function RatingStars({
  value,
  onChange,
  size = "md",
  activeColor = "#B58A4B",
  inactiveColor = "#E8DFD1",
  readonly = false,
}: RatingStarsProps) {
  const { text: textSize, gap: gapClass } = SIZE_MAP[size];
  const [hover, setHover] = useState<number | null>(null);
  const displayValue = readonly ? value : hover ?? value;

  return (
    <div
      className={`flex items-center ${gapClass} role="radiogroup" aria-label="Rating"`}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const isFilled = n <= displayValue;
        const isHovered = n === hover;
        const showColor = isFilled ? activeColor : inactiveColor;
        const isInteractive = !readonly && Boolean(onChange);

        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={isFilled}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange?.(n)}
            className={`cursor-pointer select-none transition-all duration-150 ${isInteractive ? "hover:scale-110 active:scale-95" : ""}`}
            style={{
              color: showColor,
              fontSize:
                textSize === "text-sm" ? "1rem" : textSize === "text-base" ? "1.25rem" : "1.5rem",
              lineHeight: "1",
            }}
          >
            {isFilled ? <span className="text-[#B58A4B]">{FILLED}</span> : <span>{EMPTY}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Static (non-interactive) star display
 */
export const RatingStarsStatic = ({ n, size = "md", activeColor = "#B58A4B" }: { n: number; size?: "sm" | "md" | "lg"; activeColor?: string }) => {
  const { text: textSize } = SIZE_MAP[size];
  const filled = Math.max(0, Math.min(5, Math.round(n)));
  const empty = 5 - filled;

  return (
    <span className="flex items-center gap-1" aria-label={`${filled} out of 5 stars`}>
      {[...Array(filled)].map(() => (
        <span key="f" className="text-[#B58A4B]">
          {FILLED}
        </span>
      ))}
      {[...Array(empty)].map(() => (
        <span key="e" className="text-[#E8DFD1]">
          {EMPTY}
        </span>
      ))}
    </span>
  );
};
