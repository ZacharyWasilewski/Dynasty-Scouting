import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dynasty Database",
    short_name: "DynastyDB",
    description:
      "Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie since 2015.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F7F9",
    theme_color: "#F6F7F9",
    icons: [
      // Only "any" purpose — the source icon is a full-bleed mark
      // with no maskable safe-zone padding, so declaring it
      // "maskable" too risks Android's adaptive-icon system cropping
      // it oddly. "any" is what actually matters for install/launch.
      { src: "/favicon.png?v=4", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
