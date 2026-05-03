"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay after intersect (ms), for staggered lists */
  delayMs?: number;
};

export function Reveal({ children, className = "", delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (delayMs > 0) {
          timeoutId = window.setTimeout(() => setShown(true), delayMs);
        } else {
          setShown(true);
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -32px 0px" },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  return (
    <div ref={ref} className={`home-reveal ${shown ? "home-reveal--visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
