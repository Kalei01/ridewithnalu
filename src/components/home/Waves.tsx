/** The wave motif behind the hero ("nalu" means wave). */
export function Waves() {
  return (
    <svg
      className="nh-waves"
      viewBox="0 0 440 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="nh-wave nh-wave--1"
        d="M0 120 C 55 100 110 140 165 120 S 275 100 330 120 S 440 140 495 120"
      />
      <path
        className="nh-wave nh-wave--2"
        d="M0 140 C 60 122 120 158 180 140 S 300 122 360 140 S 480 158 540 140"
      />
      <path
        className="nh-wave nh-wave--3"
        d="M0 160 C 65 146 130 174 195 160 S 325 146 390 160 S 520 174 585 160"
      />
    </svg>
  );
}
