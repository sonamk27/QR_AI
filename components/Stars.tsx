"use client";

export function Stars({
  value,
  onChange,
  size = 44,
  label = "Rating",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex justify-center gap-2" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          style={{ width: size, height: size }}
          className="grid place-items-center rounded-full transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" width={size - 8} height={size - 8} fill={n <= value ? "#E39A1B" : "none"} stroke={n <= value ? "#E39A1B" : "#B8C2BB"} strokeWidth="1.6">
            <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8L12 3Z" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export const StarsStatic = ({ n }: { n: number }) => (
  <span aria-label={`${n} out of 5`} className="text-saffron">
    {"★".repeat(n)}
    <span className="text-line">{"★".repeat(5 - n)}</span>
  </span>
);
