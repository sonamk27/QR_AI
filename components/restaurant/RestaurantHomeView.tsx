"use client";

import Link from "next/link";
import { extractSocialHandle } from "@/lib/social-format";

export type RestaurantHomeProps = {
  slug: string;
  restaurant: {
    id: string;
    name: string;
    city: string | null;
    logoUrl: string | null;
    brandColor: string;
    googleReviewUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    shareCaption: string | null;
  };
  program: {
    id: string;
    title: string;
    isActive: boolean;
    stampsRequired: number;
    minBillAmount: number; // in paise
    rewardTitle: string;
    rewardDiscount: number; // in paise
    rewardExpiryDays: number;
  };
};

export function RestaurantHomeView({ slug, restaurant, program }: { slug: string; restaurant: RestaurantHomeProps["restaurant"]; program: RestaurantHomeProps["program"] }) {
  const brandColor = restaurant.brandColor || "#1F6F5C";
  const igHandle = extractSocialHandle(restaurant.instagramUrl, "instagram");
  const fbHandle = extractSocialHandle(restaurant.facebookUrl, "facebook");

  const minBillRupees = Math.round(program.minBillAmount / 100);
  const rewardDiscountRupees = Math.round(program.rewardDiscount / 100);

  function trackSocial(platform: "instagram" | "facebook") {
    try {
      navigator.sendBeacon?.(
        "/api/public/social-click",
        new Blob(
          [JSON.stringify({ restaurantId: restaurant.id, platform })],
          { type: "application/json" }
        )
      );
    } catch {}
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 font-sans text-stone-900 selection:bg-stone-200">
      {/* Top Brand Banner */}
      <div
        className="h-32 w-full transition-colors relative"
        style={{
          background: `linear-gradient(135deg, ${brandColor} 0%, #111827 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
      </div>

      <div className="mx-auto max-w-lg px-5">
        {/* Restaurant Profile Card */}
        <div className="relative -mt-14 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm text-center">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="mx-auto -mt-16 h-24 w-24 rounded-full border-4 border-white object-cover shadow-md"
            />
          ) : (
            <div
              className="mx-auto -mt-16 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white text-3xl font-bold text-white shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-stone-900">
            {restaurant.name}
          </h1>

          {restaurant.city && (
            <p className="mt-0.5 text-xs font-semibold text-stone-500 flex items-center justify-center gap-1">
              <span>📍</span> {restaurant.city}
            </p>
          )}

          {/* Direct Social Profile Pills */}
          {(restaurant.instagramUrl || restaurant.facebookUrl) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {restaurant.instagramUrl && (
                <a
                  href={restaurant.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackSocial("instagram")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50/80 px-3.5 py-1.5 text-xs font-semibold text-pink-700 shadow-2xs hover:bg-pink-100 transition active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                  <span>{igHandle || "Instagram"}</span>
                  <span className="text-[10px] opacity-75">↗</span>
                </a>
              )}
              {restaurant.facebookUrl && (
                <a
                  href={restaurant.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackSocial("facebook")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-100 transition active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                  <span>{fbHandle || "Facebook"}</span>
                  <span className="text-[10px] opacity-75">↗</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Stamp & Loyalty Program Card */}
        {program.isActive && (
          <div className="mt-6 rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-50 to-stone-50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300">
                <span>☕</span>
                <span>{program.title}</span>
              </span>
              <span className="text-[11px] font-bold text-amber-800">
                Save ₹{rewardDiscountRupees}
              </span>
            </div>

            <div className="mt-4">
              <h2 className="font-display text-xl font-bold text-stone-900 leading-snug">
                {program.rewardTitle}
              </h2>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                Collect <strong>{program.stampsRequired} digital stamps</strong> to earn this reward. Earn 1 stamp for each qualifying visit of ₹{minBillRupees} or more!
              </p>
            </div>

            {/* Dynamic Rule Highlights */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-amber-200/60 pt-4 text-center">
              <div className="rounded-2xl bg-white/80 p-2.5 border border-amber-100 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-stone-400">Target</div>
                <div className="text-sm font-extrabold text-stone-900">{program.stampsRequired} Stamps</div>
              </div>
              <div className="rounded-2xl bg-white/80 p-2.5 border border-amber-100 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-stone-400">Min. Bill</div>
                <div className="text-sm font-extrabold text-stone-900">₹{minBillRupees}</div>
              </div>
              <div className="rounded-2xl bg-white/80 p-2.5 border border-amber-100 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-stone-400">Expiry</div>
                <div className="text-sm font-extrabold text-stone-900">{program.rewardExpiryDays} Days</div>
              </div>
            </div>

            {/* Loyalty Quick Actions */}
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <Link
                href={`/r/${slug}/loyalty`}
                className="flex-1 rounded-2xl bg-stone-900 py-3 text-center text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition active:scale-[0.99]"
              >
                ☕ View My Stamp Card
              </Link>
              <Link
                href={`/r/${slug}`}
                className="flex-1 rounded-2xl border border-amber-300 bg-amber-100/70 py-3 text-center text-xs font-bold text-amber-950 hover:bg-amber-200 transition active:scale-[0.99]"
              >
                ✍️ Rate &amp; Claim Today&apos;s Stamp
              </Link>
            </div>
          </div>
        )}

        {/* Quick Actions & Redirection Hub */}
        <div className="mt-6 space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Connect &amp; Review
          </h2>

          {/* AI Review Flow */}
          <Link
            href={`/r/${slug}`}
            className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:border-stone-400 hover:shadow-md transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 text-xl font-bold shadow-2xs">
                ⭐
              </span>
              <div className="text-left">
                <h3 className="text-sm font-bold text-stone-900">Share Your Experience</h3>
                <p className="text-xs text-stone-500">1-click AI review assist &amp; feedback</p>
              </div>
            </div>
            <span className="text-xs font-bold text-stone-700">Start →</span>
          </Link>

          {/* Direct Instagram Redirect */}
          {restaurant.instagramUrl && (
            <a
              href={restaurant.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSocial("instagram")}
              className="flex items-center justify-between rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50/50 to-white p-4 shadow-sm hover:border-pink-400 hover:shadow-md transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 text-xl shadow-2xs">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                </span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-stone-900">Instagram Profile</h3>
                  <p className="text-xs font-mono font-semibold text-pink-600">{igHandle || "Direct Account Link"}</p>
                </div>
              </div>
              <span className="rounded-xl bg-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-pink-700 transition">
                Open App ↗
              </span>
            </a>
          )}

          {/* Direct Facebook Redirect */}
          {restaurant.facebookUrl && (
            <a
              href={restaurant.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSocial("facebook")}
              className="flex items-center justify-between rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/50 to-white p-4 shadow-sm hover:border-blue-400 hover:shadow-md transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 text-xl shadow-2xs">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                </span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-stone-900">Facebook Page</h3>
                  <p className="text-xs font-mono font-semibold text-blue-600">{fbHandle || "Direct Account Link"}</p>
                </div>
              </div>
              <span className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition">
                Open App ↗
              </span>
            </a>
          )}

          {/* Google Reviews */}
          {restaurant.googleReviewUrl && (
            <a
              href={restaurant.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-400 hover:shadow-md transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 shadow-2xs">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.6C3.7 20.4 7.5 23.2 12 23.2z" />
                  </svg>
                </span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-stone-900">Google Reviews &amp; Maps</h3>
                  <p className="text-xs text-stone-500">Read verified customer reviews</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700">Open Maps ↗</span>
            </a>
          )}
        </div>

        {/* Footer info & staff link */}
        <div className="mt-12 text-center text-xs text-stone-400 space-y-2">
          <div>Powered by ReviewFlow • Customer &amp; Rewards Hub</div>
          <div>
            <Link
              href={`/terminal/${slug}`}
              className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 underline"
            >
              Staff Counter Terminal →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
