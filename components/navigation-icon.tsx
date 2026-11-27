import type { SVGProps, ReactNode } from "react";

export type NavigationIconName = "home" | "activity" | "wallet" | "target" | "transfer" | "exchange" | "file" | "vera" | "user" | "settings" | "markets";

const common: SVGProps<SVGSVGElement> = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true, focusable: false
};

export default function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const paths: Record<NavigationIconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M7 5V3h11" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    transfer: <><path d="M4 7h15l-3-3M20 17H5l3 3" /><path d="M19 7v4M5 17v-4" /></>,
    exchange: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.5 10h4a1.7 1.7 0 0 1 0 3.4h-3" /><path d="M3 7h4M17 17h4M5 5 3 7l2 2M19 15l2 2-2 2" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    vera: <><path d="M3.5 5 8 19 12 11 16 19 20.5 5 16.5 6.5 12 15 7.5 6.5z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)" /></>,
    markets: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>
  };
  return <svg {...common} className={className}>{paths[name]}</svg>;
}
