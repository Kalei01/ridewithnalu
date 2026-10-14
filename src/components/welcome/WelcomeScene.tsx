import "./welcome-scene.css";

/**
 * Decorative opening scene for the introduction: an outline of Oʻahu, a route
 * line drawn from Kapolei toward town, and a car and a Skyline train moving
 * side by side. Illustrative only (same pace for both; no claim about speed).
 * Plays once for about 3 s, then rests. Static under reduced motion.
 */
export function WelcomeScene() {
  return (
    <svg
      className="welcome-scene"
      viewBox="0 0 300 150"
      role="img"
      aria-label="Illustration: a car and a Skyline train travel side by side from Kapolei toward town on Oʻahu."
      focusable="false"
    >
      <path
        className="welcome-scene__island"
        d="M9 45 L30 62 L50 87 L70 110 L91 131 L120 134 L150 128 L173 125 L200 136 L223 145 L262 138 L296 128 L280 112 L264 100 L245 96 L227 84 L205 62 L190 40 L172 20 L159 6 L135 12 L120 20 L100 30 L91 37 L60 40 Z"
      />
      <path className="welcome-scene__route" pathLength="1" d="M108 119 C140 112 165 116 200 127" />
      <path className="welcome-scene__rail" pathLength="1" d="M108 123 C140 117 165 121 200 131" />
      <circle className="welcome-scene__stop" cx="108" cy="119" r="3" />
      <circle className="welcome-scene__stop welcome-scene__stop--end" cx="200" cy="127" r="3" />
      <text className="welcome-scene__label" x="86" y="108">
        Kapolei
      </text>
      <text className="welcome-scene__label" x="190" y="115">
        Town
      </text>
      <rect className="welcome-scene__car" x="-4" y="-2.5" width="8" height="5" rx="2" />
      <rect className="welcome-scene__train" x="-6" y="-2.5" width="12" height="5" rx="2" />
    </svg>
  );
}
