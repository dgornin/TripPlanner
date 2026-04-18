import { ReactNode } from "react";

export function Container({
  children,
  className = "",
  size = "xl",
}: {
  children: ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  const width = {
    md: "max-w-3xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
  }[size];
  return <div className={`mx-auto ${width} px-6 sm:px-8 ${className}`}>{children}</div>;
}

export function Section({
  children,
  className = "",
  eyebrow,
  title,
  kicker,
  id,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
  kicker?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-20 sm:py-28 ${className}`}>
      <Container>
        {(eyebrow || title || kicker) && (
          <div className="mb-14 sm:mb-20 max-w-3xl">
            {eyebrow && (
              <div className="text-xs uppercase tracking-[0.28em] text-brand-600 mb-3 font-semibold">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-ink-900">
                {title}
              </h2>
            )}
            {kicker && (
              <p className="mt-5 text-ink-500 text-lg max-w-xl">{kicker}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
