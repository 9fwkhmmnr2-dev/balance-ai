import type { SVGProps } from "react";

export default function VeraIsotype({ className }: { className?: string }) {
  const props: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 64 64", fill: "none", stroke: "currentColor",
    strokeWidth: 3.2, strokeLinecap: "square", strokeLinejoin: "miter",
    "aria-hidden": true, focusable: false,
  };
  return <span className={className} aria-label="VERA"><svg {...props}><path d="M8 10 21 51 32 29 43 51 56 10 43 15 32 39 21 15 8 10Z" /></svg></span>;
}
