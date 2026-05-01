import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · LogBase",
  description: "Sign in or create a LogBase account to open your workspace.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
