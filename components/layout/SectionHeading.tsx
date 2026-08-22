export function SectionHeading({
  eyebrow,
  title,
  description,
  size = "default",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** "hero" is for the rare case this component is standing in as
   *  an actual page title (currently just /team-sync) rather than a
   *  sub-section heading within a longer page — those two roles need
   *  different visual weight, so this is a real, deliberate switch
   *  rather than a compromise size that half-serves both. */
  size?: "default" | "hero";
}) {
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
        {eyebrow}
      </span>
      {size === "hero" ? (
        <h1 className="mt-2 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
          {title}
        </h1>
      ) : (
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
