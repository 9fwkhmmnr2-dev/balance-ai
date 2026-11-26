import type { SVGProps } from "react";

export type NavigationIconName = "home" | "activity" | "wallet" | "target" | "transfer" | "exchange" | "file" | "vera" | "user";

const common: SVGProps<SVGSVGElement> = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true, focusable: false
};

export default function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const paths: Record<NavigationIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M7 5V3h11" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    transfer: <><path d="M4 7h15l-3-3M20 17H5l3 3" /><path d="M19 7v4M5 17v-4" /></>,
    exchange: <><path d="M4 7h14l-3-3M20 17H6l3 3" /><path d="M18 7v4M6 17v-4" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    vera: <><path d="M4 5h3l5 14 5-14h3" /><path d="M8 12h8" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></>
  };
  return <svg {...common} className={className}>{paths[name]}</svg>;
}
