export type PageMetadata = {
  title: string;
  description: string;
  noIndex?: boolean;
};

const defaultMetadata: PageMetadata = {
  title: "ReviewFlow | QR Reviews and Digital Loyalty for Restaurants",
  description:
    "Help restaurant guests share feedback and earn rewards with QR review flows and digital loyalty stamps from ReviewFlow.",
};

export function getPageMetadata(pathname: string): PageMetadata {
  if (pathname === "/") return defaultMetadata;
  if (pathname === "/admin" || pathname === "/superadmin") {
    return {
      title: "Page not found | ReviewFlow",
      description: "The page you requested could not be found.",
      noIndex: true,
    };
  }
  if (pathname === "/login") {
    return {
      title: "Sign in | ReviewFlow",
      description: "Sign in to your ReviewFlow restaurant account.",
      noIndex: true,
    };
  }
  if (pathname === "/admin/login") {
    return {
      title: "Restaurant admin sign in | ReviewFlow",
      description: "Sign in to manage your restaurant's ReviewFlow account.",
      noIndex: true,
    };
  }
  if (pathname === "/signup") {
    return {
      title: "Create a restaurant account | ReviewFlow",
      description: "Set up your restaurant account and start managing QR reviews and digital loyalty with ReviewFlow.",
      noIndex: true,
    };
  }
  if (pathname === "/reset-password") {
    return {
      title: "Reset your password | ReviewFlow",
      description: "Request a secure password reset link for your ReviewFlow account.",
      noIndex: true,
    };
  }
  if (pathname === "/privacy") {
    return {
      title: "Privacy Policy | ReviewFlow",
      description: "Learn how ReviewFlow uses account, guest feedback, loyalty, and optional analytics data.",
    };
  }
  if (pathname === "/terms") {
    return {
      title: "Terms of Service | ReviewFlow",
      description: "Read the terms for ReviewFlow restaurant accounts, guest feedback, QR codes, and loyalty features.",
    };
  }
  if (/^\/r\/[^/]+(?:\/(?:review|home|loyalty))?$/.test(pathname)) {
    return {
      title: "Guest review and rewards | ReviewFlow",
      description: "Share feedback and explore this restaurant's guest rewards with ReviewFlow.",
      noIndex: true,
    };
  }
  if (/^\/terminal\/[^/]+$/.test(pathname)) {
    return {
      title: "Restaurant loyalty | ReviewFlow",
      description: "Open the restaurant's ReviewFlow loyalty experience.",
      noIndex: true,
    };
  }
  if (/^\/(?:dashboard|super-admin|admin|superadmin)(?:\/|$)/.test(pathname)) {
    return {
      title: "Restaurant management | ReviewFlow",
      description: "Manage restaurant feedback, QR codes, payments, and loyalty with ReviewFlow.",
      noIndex: true,
    };
  }
  return {
    title: "Page not found | ReviewFlow",
    description: "The page you requested could not be found.",
    noIndex: true,
  };
}

export function getSiteOrigin(): string {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (!configuredUrl) return window.location.origin;

  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("VITE_SITE_URL must use HTTPS outside local development.");
  }
  return url.origin;
}

export function updatePageMetadata(metadata: PageMetadata, pathname: string): void {
  const origin = getSiteOrigin();
  const canonicalUrl = new URL(pathname, `${origin}/`).href;
  const imageUrl = new URL("/social-share.png", `${origin}/`).href;

  document.title = metadata.title;
  setMeta("name", "description", metadata.description);
  setMeta("name", "robots", metadata.noIndex ? "noindex, nofollow" : "index, follow");
  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", "ReviewFlow");
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:url", canonicalUrl);
  setMeta("property", "og:image", imageUrl);
  setMeta("property", "og:image:alt", "ReviewFlow QR reviews and digital loyalty for restaurants");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", metadata.title);
  setMeta("name", "twitter:description", metadata.description);
  setMeta("name", "twitter:image", imageUrl);

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;
}

export function updateStructuredData(id: string, data?: Record<string, unknown>): void {
  document.getElementById(id)?.remove();
  if (!data) return;

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
  document.head.append(script);
}

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}
