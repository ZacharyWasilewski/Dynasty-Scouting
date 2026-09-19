import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dynasty Database",
    short_name: "DynastyDB",
    description:
      "Analytical grades, position rankings, and draft-class boards for dynasty-relevant prospects from every class since 2015.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F7F9",
    theme_color: "#F6F7F9",
    icons: [
      // Only "any" purpose — the source icon is a full-bleed mark
      // with no maskable safe-zone padding, so declaring it
      // "maskable" too risks Android's adaptive-icon system cropping
      // it oddly. "any" is what actually matters for install/launch.
      //
      // Four real sizes, not one file declared at multiple nominal
      // sizes — each was actually resized from the source 512x512
      // mark (see public/icons/), so a launcher requesting 192x192
      // gets genuine 192x192 pixels rather than a mismatched file it
      // has to scale itself.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/favicon.png?v=4", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
