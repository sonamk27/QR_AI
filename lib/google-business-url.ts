export function isGoogleBusinessUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "maps.app.goo.gl" || hostname === "g.page") {
      return url.pathname.length > 1;
    }
    if (hostname === "goo.gl") {
      return url.pathname.toLowerCase().startsWith("/maps/");
    }
    if (hostname === "google.com" || hostname.endsWith(".google.com")) {
      const path = url.pathname.toLowerCase();
      return (
        path === "/maps" ||
        path.startsWith("/maps/") ||
        path.startsWith("/local/") ||
        (path === "/" &&
          (hostname === "maps.google.com" ||
            (hostname === "www.google.com" &&
              (url.searchParams.has("q") ||
                url.searchParams.has("kgmid") ||
                url.searchParams.has("ludocid"))))) ||
        (path === "/search" &&
          (url.searchParams.has("q") ||
            url.searchParams.has("kgmid") ||
            url.searchParams.has("ludocid")))
      );
    }
    return false;
  } catch {
    return false;
  }
}
