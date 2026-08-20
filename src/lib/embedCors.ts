/**
 * Server-only CORS helpers for the optional Aurora Layers SSO exchange.
 * The iframe normally calls this endpoint same-origin; these headers make the
 * approved-host policy explicit for browser preflights and error responses.
 */
export function normalizeHttpOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function allowedEmbedOrigins(): string[] {
  const raw = process.env["AURORA_EMBED_ALLOWED_ORIGINS"] ?? "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .map(normalizeHttpOrigin)
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function embedCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowedEmbedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}