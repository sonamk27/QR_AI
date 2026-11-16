"use client";

import { useEffect, useState } from "react";

type GoogleReview = {
  authorAttribution?: { displayName?: string; uri?: string };
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: string;
};

type GooglePlace = {
  displayName?: string;
  googleMapsURI?: string;
  rating?: number;
  reviews?: GoogleReview[];
  userRatingCount?: number;
  fetchFields: (options: { fields: string[] }) => Promise<unknown>;
};

type GooglePlacesLibrary = {
  Place: new (options: { id: string }) => GooglePlace;
};

type GoogleMapsApi = {
  importLibrary: (libraryName: "places") => Promise<GooglePlacesLibrary>;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
  }
}

type ReviewData = Pick<GooglePlace, "displayName" | "googleMapsURI" | "rating" | "reviews" | "userRatingCount">;

let placesLibraryPromise: Promise<GooglePlacesLibrary> | null = null;

function loadPlacesLibrary(apiKey: string): Promise<GooglePlacesLibrary> {
  if (window.google?.maps) return window.google.maps.importLibrary("places");
  if (placesLibraryPromise) return placesLibraryPromise;

  placesLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: apiKey, v: "weekly", loading: "async" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onload = () => {
      const maps = window.google?.maps;
      if (!maps) {
        placesLibraryPromise = null;
        reject(new Error("Google Maps JavaScript API did not initialize."));
        return;
      }
      void maps.importLibrary("places").then(resolve, (error: unknown) => {
        placesLibraryPromise = null;
        reject(error);
      });
    };
    script.onerror = () => {
      placesLibraryPromise = null;
      reject(new Error("Google Maps JavaScript API could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return placesLibraryPromise;
}

export function GooglePlacesReviews({
  placeId,
  businessName,
  googleReviewUrl,
}: {
  placeId: string;
  businessName: string;
  googleReviewUrl?: string | null;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

    setData(null);
    setError("");
    setLoading(true);

    if (!apiKey) {
      setError("Google reviews are not configured yet.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void loadPlacesLibrary(apiKey)
      .then(async ({ Place }) => {
        const place = new Place({ id: placeId });
        await place.fetchFields({
          fields: ["displayName", "rating", "userRatingCount", "reviews", "googleMapsURI"],
        });
        return place;
      })
      .then((place) => {
        if (active) {
          setData({
            displayName: place.displayName,
            googleMapsURI: place.googleMapsURI,
            rating: place.rating,
            reviews: place.reviews,
            userRatingCount: place.userRatingCount,
          });
        }
      })
      .catch((cause: unknown) => {
        console.error("Could not load Google Places reviews", cause);
        if (active) setError("Public Google reviews could not be loaded. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [placeId]);

  const mapsUrl = data?.googleMapsURI || googleReviewUrl;
  const attributedReviews = data?.reviews?.filter(
    (review) => typeof review.authorAttribution?.displayName === "string" && review.authorAttribution.displayName.length > 0,
  ) ?? [];

  return (
    <section
      aria-label={`Public Google reviews for ${businessName}`}
      className="mt-5 space-y-4 rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-base font-bold text-[#24211E]">What guests are saying</h3>
          <p className="mt-0.5 text-xs text-[#716B64]">{data?.displayName || businessName}</p>
        </div>
        {typeof data?.rating === "number" && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-[#24211E]">
              <span className="mr-1 text-amber-500" aria-hidden="true">★</span>
              {data.rating.toFixed(1)}
            </p>
            {typeof data.userRatingCount === "number" && (
              <p className="text-[10px] text-[#716B64]">{data.userRatingCount} ratings</p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#716B64]" role="status">Loading public reviews…</p>
      ) : error ? (
        <p className="text-xs text-[#716B64]" role="status">{error}</p>
      ) : attributedReviews.length ? (
        <div className="space-y-3">
          {attributedReviews.map((review, index) => (
            <article key={`${review.authorAttribution?.displayName ?? "guest"}-${index}`} className="border-t border-[#E8DFD1] pt-3">
              <div className="flex items-start justify-between gap-2">
                {review.authorAttribution?.uri ? (
                  <a
                    href={review.authorAttribution.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#24211E] underline"
                  >
                    {review.authorAttribution.displayName}
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-[#24211E]">
                    {review.authorAttribution?.displayName}
                  </span>
                )}
                {typeof review.rating === "number" && (
                  <span className="shrink-0 text-xs text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}
                  </span>
                )}
              </div>
              {review.relativePublishTimeDescription && (
                <p className="mt-0.5 text-[10px] text-[#716B64]">{review.relativePublishTimeDescription}</p>
              )}
              {review.text && <p className="mt-2 text-xs leading-relaxed text-[#38332E]">{review.text}</p>}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#716B64]">No public reviews are available right now.</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[#E8DFD1] pt-3">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#24211E] underline"
          >
            View on Google Maps
          </a>
        ) : <span />}
        <span translate="no" className="shrink-0 font-sans text-xs font-normal text-[#5E5E5E]">Google Maps</span>
      </div>
    </section>
  );
}
