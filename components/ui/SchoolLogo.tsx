import Image from "next/image";

/**
 * Renders nothing (not a placeholder icon) when a prospect's school
 * has no matched logo — a missing logo next to a school abbreviation
 * still reads fine on its own, whereas a broken-image icon or empty
 * gray box next to every unmatched school would look like a bug
 * rather than an occasional, expected gap.
 *
 * Wrapped in a small white circular chip — most ESPN team logos are
 * designed to sit on a light background (white outlines, white
 * lettering, etc.) and were nearly invisible directly on this site's
 * dark surfaces. The white backing works regardless of which
 * surface color it happens to land on.
 */
export function SchoolLogo({
  url,
  size = 16,
  className = "",
}: {
  url: string | undefined;
  /** The logo's own size in px — matched to the surrounding text's
   *  line-height by the caller, since this always renders inline
   *  next to a school name. The white chip behind it is sized
   *  slightly larger to give the logo a small margin. */
  size?: number;
  className?: string;
}) {
  if (!url) return null;
  const chipSize = size + 4;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white ${className}`}
      style={{ width: chipSize, height: chipSize }}
    >
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="object-contain"
        style={{ width: size, height: size }}
      />
    </span>
  );
}
