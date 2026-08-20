/**
 * Host <-> embed messaging contract for Aurora Layers.
 * Every message is namespaced so it can share a window with other widgets.
 */
export const EMBED_SOURCE = "aurora-layers";

export type EmbedMessage =
  | { source: typeof EMBED_SOURCE; type: "ready" }
  | { source: typeof EMBED_SOURCE; type: "height"; height: number }
  | { source: typeof EMBED_SOURCE; type: "auth"; status: "authenticated" | "error" }
  | { source: typeof EMBED_SOURCE; type: "sso"; token: string };

function post(message: EmbedMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(message, "*");
}

export function postReady() {
  post({ source: EMBED_SOURCE, type: "ready" });
}

export function postAuth(status: "authenticated" | "error") {
  post({ source: EMBED_SOURCE, type: "auth", status });
}

/**
 * Measures the real content height and streams it to the host on every change:
 * DOM mutations, image loads, font swaps, viewport resizes and animation frames
 * right after mount. Returns a cleanup function.
 */
export function startHeightReporting(): () => void {
  if (typeof window === "undefined") return () => {};

  let last = 0;
  let frame = 0;

  const measure = () => {
    const body = document.body;
    const html = document.documentElement;
    const height = Math.ceil(
      Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.scrollHeight,
        html.offsetHeight,
        html.getBoundingClientRect().height,
      ),
    );
    if (height > 0 && Math.abs(height - last) > 1) {
      last = height;
      post({ source: EMBED_SOURCE, type: "height", height });
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  };

  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(document.body);
  resizeObserver.observe(document.documentElement);

  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  document.addEventListener("transitionend", schedule);
  document.addEventListener("animationend", schedule);

  // Catch late layout shifts (fonts, images, streamed frames).
  const timers = [50, 200, 600, 1500, 3000].map((delay) =>
    window.setTimeout(schedule, delay),
  );
  const interval = window.setInterval(schedule, 1000);

  schedule();

  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("load", schedule);
    document.removeEventListener("transitionend", schedule);
    document.removeEventListener("animationend", schedule);
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearInterval(interval);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

/** Listens for an SSO token pushed by the host via postMessage. */
export function onHostSsoToken(handler: (token: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: MessageEvent) => {
    const data = event.data as EmbedMessage | undefined;
    if (data?.source === EMBED_SOURCE && data.type === "sso" && data.token) {
      handler(data.token);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
