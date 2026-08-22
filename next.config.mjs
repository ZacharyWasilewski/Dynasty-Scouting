/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
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
  },
};

export default nextConfig;
