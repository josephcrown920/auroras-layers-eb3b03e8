# Embedding Aurora Layers

Aurora Layers provides a full editor at `/embed`. It uses the same `LayerStudio` component as the standalone application and runs inside an iframe, so Aurora Global host styles cannot change its existing look, settings, or editor behavior.

## Required deployment settings

Set these secrets/environment variables on the Layers deployment:

```text
AURORA_EMBED_ALLOWED_ORIGINS=https://your-aurora.replit.app,https://your-production-domain.example
AURORA_EMBED_SSO_SECRET=<a-long-random-shared-secret>
```

`AURORA_EMBED_ALLOWED_ORIGINS` must contain exact origins without a trailing slash. It controls CSP `frame-ancestors`, the API preflight allow-list, and which hosts can exchange a session token. The regular iframe session exchange is same-origin; direct cross-origin API calls are allowed only for an origin on this list.

The `/embed` page intentionally does not set `X-Frame-Options`: that header cannot safely allow selected cross-origin iframe hosts. CSP `frame-ancestors` is the modern allow-list used instead.

## Optional session sync

The host mints a short-lived HMAC-SHA256 token with this JSON payload:

```json
{ "sub": "host-user-id", "email": "user@example.com", "name": "Optional name", "aud": "https://your-aurora.replit.app", "exp": 1735689600 }
```

The token format is `base64url(payload).hex(hmac-sha256(payload))`. The `aud` claim is strongly recommended and must match the host origin. Aurora Global's `AuroraEmbed` component sends this token through `postMessage`; it is not put into the iframe URL.

## Host integration

```tsx
<AuroraEmbed
  kind="layers"
  src="https://your-layers-domain/embed"
  ssoToken={shortLivedEmbedToken}
  title="Aurora Layers"
/>
```

The iframe reports its content height after layout changes, allowing Aurora Global to fit the full editor without iframe scrollbars or a style rewrite.