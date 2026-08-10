/**
 * The Marquee wordmark: a small theater-marquee sign (lit bulbs around a framed
 * "M") next to the name. The sign frame and "M" use `currentColor` so the mark
 * adapts to light/dark contexts; the bulbs stay marquee-gold.
 */

interface Props {
  /** Height of the icon/text in pixels. Text scales with it. */
  size?: number;
  className?: string;
}

export default function Wordmark({ size = 22, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Marquee">
      <MarqueeMark height={size} />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: size * 0.9, lineHeight: 1 }}
      >
        Marquee
      </span>
    </span>
  );
}

function MarqueeMark({ height }: { height: number }) {
  // viewBox is 48x40; scale to the requested height.
  const width = (height * 48) / 40;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="3"
        y="9"
        width="42"
        height="22"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <g fill="#f5c518">
        <circle cx="10" cy="9" r="1.7" />
        <circle cx="19" cy="9" r="1.7" />
        <circle cx="29" cy="9" r="1.7" />
        <circle cx="38" cy="9" r="1.7" />
        <circle cx="10" cy="31" r="1.7" />
        <circle cx="19" cy="31" r="1.7" />
        <circle cx="29" cy="31" r="1.7" />
        <circle cx="38" cy="31" r="1.7" />
      </g>
      <polyline
        points="15,26 15,15 24,21 33,15 33,26"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
