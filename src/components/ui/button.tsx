import Link from "next/link";
import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "forest" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-oxblood text-ivory hover:bg-oxblood-ink",
  forest: "bg-forest text-ivory hover:bg-forest/90",
  outline: "border border-charcoal/30 bg-transparent text-charcoal hover:bg-ivory-deep",
  ghost: "text-charcoal hover:bg-ivory-deep",
  danger: "border border-oxblood/40 text-oxblood hover:bg-oxblood/10",
};

const sizes: Record<Size, string> = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  loading,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
