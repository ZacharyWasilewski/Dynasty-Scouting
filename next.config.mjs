/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep response payloads small without changing any application behavior.
  compress: true,
  images: {
    // Serve the same source images in modern, smaller formats whenever the
    // visitor's browser supports them. This affects transfer size only, not
    // which image is selected or how the UI behaves.
    formats: ["image/avif", "image/webp"],
    // Keep optimized remote images in Next's cache longer so repeat visits
    // and client navigations avoid unnecessary image work.
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/i/headshots/college-football/players/**",
      },
      {
        protocol: "https",
        hostname: "sleepercdn.com",
        pathname: "/content/nfl/players/**",
      },
    ],
  },
  // pg conditionally requires a couple of packages it doesn't
  // actually need in a standard Node environment (e.g. pg-cloudflare)
  // — letting webpack try to bundle it anyway is a known source of
  // build/runtime errors in Next.js App Router. This tells Next to
  // load it natively via Node's require in Route Handlers instead.
  experimental: {
    serverComponentsExternalPackages: ["pg"],
    // The site uses lucide across many client components. Rewriting package
    // imports to direct modules trims navigation/page JavaScript without
    // changing icons or runtime behavior.
    optimizePackageImports: ["lucide-react"],
  },
  poweredByHeader: false,
};

export default nextConfig;
