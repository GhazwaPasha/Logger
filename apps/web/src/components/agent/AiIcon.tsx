/**
 * The AI mark: the common "sparkles" glyph (a large four-point star with a smaller one beside it), used
 * everywhere the agent appears so it reads as AI at a glance. Inherits `currentColor`.
 */
export function AiIcon({ className = "size-4", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d="M10 3.5Q11.1 11.4 18.5 13Q11.1 14.6 10 22.5Q8.9 14.6 1.5 13Q8.9 11.4 10 3.5Z" />
      <path d="M18.5 1.5Q19 4.6 22.5 5.5Q19 6.4 18.5 9.5Q18 6.4 14.5 5.5Q18 4.6 18.5 1.5Z" />
    </svg>
  );
}
