import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline" | "dark";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 shadow-pop hover:shadow-[0_14px_36px_-14px_rgba(249,115,22,0.6)] focus-visible:ring-brand-500",
  dark: "bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-900",
  ghost: "bg-transparent text-ink-900 hover:bg-ink-100 focus-visible:ring-ink-500",
  outline:
    "bg-white text-ink-900 border border-ink-200 hover:border-ink-900 focus-visible:ring-ink-500",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-4 h-9",
  md: "text-sm px-6 h-11",
  lg: "text-base px-8 h-14",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = "") {
  // touch-manipulation disables iOS Safari's double-tap-to-zoom / panning
  // micro-delays that were re-routing Submit taps onto neighbouring inputs.
  return `inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${variantClasses[variant]} ${sizeClasses[size]} ${extra}`;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={loading || rest.disabled}
      className={buttonClasses(variant, size, className)}
    >
      {loading && (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
});
