interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}

export default function StarRating({
  rating,
  count,
  size = "sm",
}: StarRatingProps) {
  const starSize = size === "sm" ? 14 : 18;

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill={star <= Math.round(rating) ? "#2563eb" : "none"}
            stroke="#2563eb"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>
      <span className="text-text-muted text-xs">
        {rating.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </div>
  );
}
