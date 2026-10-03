import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/qr";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage";
const GOOGLE_API_TIMEOUT_MS = 15_000;

type GoogleAccount = {
  name: string;
  accountName?: string;
};

export type GoogleBusinessLocation = {
  name: string;
  title: string;
  address: string;
  accountName: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured to connect Google Business Profile.`);
  return value;
}

function getOAuthConfig() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const authSecret = requiredEnv("AUTH_SECRET");
  if (authSecret.startsWith("generate-with:") || authSecret === "dev-only-secret-change-me") {
    throw new Error("Set a unique AUTH_SECRET before connecting Google Business Profile.");
  }
  encryptionKey();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    new URL("/api/super-admin/google/callback", appBaseUrl()).toString();
  const redirectUrl = new URL(redirectUri);

  if (
    process.env.NODE_ENV === "production" &&
    (redirectUrl.protocol !== "https:" ||
      redirectUrl.hostname === "localhost" ||
      redirectUrl.hostname === "127.0.0.1")
  ) {
    throw new Error("GOOGLE_REDIRECT_URI must be a public HTTPS URL in production.");
  }

  return { clientId, clientSecret, authSecret, redirectUri };
}

function encryptionKey() {
  const raw = requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const key = /^[\da-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.");
  }
  return key;
}

export function encryptGoogleToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptGoogleToken(encryptedToken: string) {
  const [version, ivPart, tagPart, valuePart] = encryptedToken.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !valuePart) {
    throw new Error("Stored Google authorization is invalid. Reconnect the Google account.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(valuePart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createGoogleAuthorizationUrl(state: string) {
  const config = getOAuthConfig();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const config = getOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });
  const result = (await response.json()) as TokenResponse;
  if (!response.ok || !result.refresh_token) {
    throw new Error(
      result.error_description ||
        result.error ||
        "Google did not return an offline refresh token. Reconnect and approve access.",
    );
  }
  return result.refresh_token;
}

async function googleApiGet<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;
  if (!response.ok) {
    throw new Error(
      result.error?.message || `Google Business Profile API request failed (${response.status}).`,
    );
  }
  return result;
}

async function accessTokenForConnection(connectionId: string) {
  const connection = await db.googleBusinessConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, encryptedRefreshToken: true },
  });
  if (!connection) throw new Error("Google account is not connected. Connect it again.");

  const config = getOAuthConfig();
  const refreshToken = decryptGoogleToken(connection.encryptedRefreshToken);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });
  const result = (await response.json()) as TokenResponse;
  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description ||
        result.error ||
        "Google authorization expired or was revoked. Reconnect the account.",
    );
  }
  if (result.refresh_token) {
    await db.googleBusinessConnection.update({
      where: { id: connection.id },
      data: { encryptedRefreshToken: encryptGoogleToken(result.refresh_token) },
    });
  }
  return result.access_token;
}

export async function listGoogleBusinessLocations(connectionId: string) {
  const accessToken = await accessTokenForConnection(connectionId);
  const accounts: GoogleAccount[] = [];
  let accountPageToken: string | undefined;

  do {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    url.searchParams.set("pageSize", "20");
    if (accountPageToken) url.searchParams.set("pageToken", accountPageToken);
    const result = await googleApiGet<{
      accounts?: GoogleAccount[];
      nextPageToken?: string;
    }>(url, accessToken);
    accounts.push(...(result.accounts ?? []));
    accountPageToken = result.nextPageToken;
  } while (accountPageToken);

  const locations: GoogleBusinessLocation[] = [];
  for (const account of accounts) {
    let locationPageToken: string | undefined;
    do {
      const accountPath = account.name.split("/").map(encodeURIComponent).join("/");
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountPath}/locations`,
      );
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (locationPageToken) url.searchParams.set("pageToken", locationPageToken);
      const result = await googleApiGet<{
        locations?: Array<{
          name: string;
          title?: string;
          storefrontAddress?: {
            addressLines?: string[];
            locality?: string;
            administrativeArea?: string;
            postalCode?: string;
          };
        }>;
        nextPageToken?: string;
      }>(url, accessToken);

      for (const location of result.locations ?? []) {
        const address = location.storefrontAddress;
        locations.push({
          name: location.name,
          title: location.title?.trim() || location.name,
          address: [
            ...(address?.addressLines ?? []),
            address?.locality,
            address?.administrativeArea,
            address?.postalCode,
          ]
            .filter(Boolean)
            .join(", "),
          accountName: account.accountName?.trim() || account.name,
        });
      }
      locationPageToken = result.nextPageToken;
    } while (locationPageToken);
  }

  return locations;
}

export function googleOAuthSigningKey() {
  return new TextEncoder().encode(getOAuthConfig().authSecret);
}
