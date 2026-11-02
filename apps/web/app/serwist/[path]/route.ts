import { createSerwistRoute } from '@serwist/turbopack';

// Builds and serves /serwist/sw.js from app/sw.ts. Only hashed static files are precached. Pages are NOT
// precached (Stage 0 finding: a precached page kept showing an old version after a redeploy); sw.ts sends
// navigations network-first, and the last copy seen opens the app offline.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
});
