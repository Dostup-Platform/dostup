import { next, rewrite } from "@vercel/functions";
import {
  fetchProductSlugById,
  isCrawlerUserAgent,
  isUuid,
} from "./api/_lib/og";

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/p\/([^/]+)$/);
  if (!match) return next();

  const segment = decodeURIComponent(match[1]);
  const userAgent = request.headers.get("user-agent") || "";

  if (isUuid(segment)) {
    const slug = await fetchProductSlugById(segment);
    if (slug && slug !== segment) {
      const location = `/p/${encodeURIComponent(slug)}${url.search}`;
      return new Response(null, {
        status: 301,
        headers: { Location: location },
      });
    }
  }

  if (isCrawlerUserAgent(userAgent)) {
    const ogUrl = new URL("/api/og-product", url.origin);
    ogUrl.searchParams.set("slug", segment);
    if (url.search) {
      ogUrl.searchParams.set("search", url.search);
    }
    return rewrite(ogUrl);
  }

  return next();
}

export const config = {
  matcher: "/p/:path*",
};
