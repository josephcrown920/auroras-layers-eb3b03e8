import { createFileRoute } from "@tanstack/react-router";

/**
 * Token-based SSO for the Aurora Layers embed.
 *
 * The host app (Replit) mints a short-lived HMAC-signed token for the signed-in
 * user and hands it to the embed. This endpoint verifies the signature and
 * returns a one-time Supabase magic-link token_hash the embed exchanges for a
 * session — so the user is signed in inside Layers without ever seeing a login
 * screen, and without the host sharing passwords.
 *
 * Token format:  base64url(JSON payload) + "." + hex(HMAC-SHA256)
 * Payload:       { sub: string, email: string, name?: string, exp: number }
 */

type Payload = {
  sub: string;
  email: string;
  name?: string;
  exp: number;
};

function allowedOrigins(): string[] {
  const raw = process.env["AURORA_EMBED_ALLOWED_ORIGINS"] ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();
  const allow =
    origin && (list.length === 0 || list.includes(origin)) ? origin : (list[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return atob(withPad);
}

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function verifyToken(token: string, secret: string): Promise<Payload | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hexEncode(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)),
  );
  if (!timingSafeEqual(expected, signature.toLowerCase())) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as Payload;
  } catch {
    return null;
  }

  if (!payload?.email || !payload?.sub) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export const Route = createFileRoute("/api/public/embed-session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) }),

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const secret = process.env["AURORA_EMBED_SSO_SECRET"];
        if (!secret) {
          return json({ error: "SSO is not configured for this deployment." }, 501, origin);
        }

        let token: string | undefined;
        try {
          ({ token } = (await request.json()) as { token?: string });
        } catch {
          return json({ error: "Invalid JSON body." }, 400, origin);
        }
        if (!token) return json({ error: "A token is required." }, 400, origin);

        const payload = await verifyToken(token, secret);
        if (!payload) return json({ error: "Invalid or expired SSO token." }, 401, origin);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Create the user on first sight; ignore "already registered".
        await supabaseAdmin.auth.admin.createUser({
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            host_user_id: payload.sub,
            full_name: payload.name ?? null,
            source: "aurora-embed-sso",
          },
        });

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: payload.email,
        });

        if (error || !data?.properties?.hashed_token) {
          return json({ error: "Could not establish an embed session." }, 500, origin);
        }

        return json(
          { email: payload.email, tokenHash: data.properties.hashed_token },
          200,
          origin,
        );
      },
    },
  },
});
