/** The one decorative element: 14 px of gold with peacock zigzag teeth, then a 3 px pink line (design spec §4.3). */
export function TempleBorder() {
  return (
    <div aria-hidden="true" className="w-full">
      <svg width="100%" height="14" className="block bg-gold" preserveAspectRatio="none">
        <defs>
          <pattern id="temple-teeth" width="28" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 0h28L14 11 0 0Z" className="fill-peacock" />
          </pattern>
        </defs>
        <rect width="100%" height="14" fill="url(#temple-teeth)" />
      </svg>
      <div className="h-[3px] bg-rani" />
    </div>
  );
}
