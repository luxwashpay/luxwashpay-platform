type Variant = "default" | "success" | "warning" | "error" | "blue";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-600 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 text-xs font-medium
        rounded-full border ${variantStyles[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}
