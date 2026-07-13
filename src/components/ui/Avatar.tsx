import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
  className?: string;
}

const sizeMap = {
  sm: { container: "w-8 h-8", text: "text-xs", px: 32 },
  md: { container: "w-10 h-10", text: "text-sm", px: 40 },
  lg: { container: "w-14 h-14", text: "text-lg", px: 56 },
  xl: { container: "w-20 h-20", text: "text-2xl", px: 80 },
};

export default function Avatar({
  src,
  alt,
  size = "md",
  fallback,
  className = "",
}: AvatarProps) {
  const s = sizeMap[size];
  const initials =
    fallback ||
    alt
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  if (src) {
    return (
      <div
        className={`${s.container} rounded-full overflow-hidden bg-surface shrink-0 ${className}`}
      >
        <Image
          src={src}
          alt={alt}
          width={s.px}
          height={s.px}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.container} rounded-full bg-blue-50 flex items-center justify-center shrink-0 ${className}`}
    >
      <span className={`${s.text} font-medium text-accent`}>{initials}</span>
    </div>
  );
}
