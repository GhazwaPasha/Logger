import { nameInitials } from "@/lib/member-utils";

export function Avatar({
  name,
  email,
  image,
  size,
  className,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  size: string;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${size} ${className ?? ""}`}
      aria-hidden
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- external/user-supplied URL, no next/image remote-pattern config in this app yet
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span>{nameInitials(name, email)}</span>
      )}
    </span>
  );
}
