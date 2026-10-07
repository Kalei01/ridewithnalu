import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Re-keys its content when `changeKey` changes so a short opacity fade plays,
 * but never on first render. Opacity only, so nothing moves or reflows.
 * `kind="verdict"` is the calm 360 ms cross-fade for a changed recommendation;
 * `kind="number"` is the quick 220 ms settle for an updated time. Both are
 * switched off for riders who asked for reduced motion (see styles.css).
 */
export function FadeOnChange({
  changeKey,
  kind,
  as: Tag = "span",
  className,
  id,
  children,
}: {
  changeKey: string;
  kind: "verdict" | "number";
  as?: ElementType;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const first = useRef(true);
  const [generation, setGeneration] = useState(0);
  const last = useRef(changeKey);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (last.current !== changeKey) {
      last.current = changeKey;
      setGeneration((n) => n + 1);
    }
  }, [changeKey]);
  const animated = generation > 0;
  return (
    <Tag
      key={generation}
      id={id}
      className={`${className ?? ""}${animated ? ` nalu-fade-${kind}` : ""}`.trim()}
    >
      {children}
    </Tag>
  );
}
