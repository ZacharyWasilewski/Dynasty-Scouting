export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
        {eyebrow}
      </span>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
