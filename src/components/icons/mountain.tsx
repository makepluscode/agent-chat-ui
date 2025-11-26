export function MountainIconSVG({
  className,
  width,
  height,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 거대한 산 아이콘 - 계층적인 산봉우리, 크게 그리고 위로 */}
      {/* 뒷산 */}
      <path
        d="M6 12L2 24H10L6 12Z"
        fill="#1a3a3b"
      />
      {/* 중간 산 */}
      <path
        d="M16 2L8 24H24L16 2Z"
        fill="#264849"
      />
      {/* 앞산 (가장 큰 산) */}
      <path
        d="M26 6L18 24H32L26 6Z"
        fill="#3a6b6d"
      />
      {/* 눈 덮인 봉우리 */}
      <path
        d="M16 0L14 4L18 4L16 0Z"
        fill="#ffffff"
      />
      <path
        d="M26 6L24 10L28 10L26 6Z"
        fill="#ffffff"
      />
    </svg>
  );
}
