import { createSerwistRoute } from "@serwist/turbopack";

// Builds and serves /serwist/sw.js from app/sw.ts. Only hashed static files are precached. The page itself is
// NOT precached: a precached page is served cache-first and keyed by commit, so a redeploy without a new commit
// kept showing the old page. Pages go network-first (sw.ts), and the last copy seen opens the app offline.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
