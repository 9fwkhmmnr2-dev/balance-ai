export default function FinanceTrackLoader({ message = "Preparando tu espacio" }: { message?: string }) {
  return (
    <main className="financetrack-loading" aria-live="polite" aria-busy="true">
      <div className="financetrack-loading-lockup" role="img" aria-label="FINANCE.TRACK">
        <svg viewBox="0 0 420 170" aria-hidden="true">
          <defs><linearGradient id="ft-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8C875"/><stop offset="1" stopColor="#B88D36"/></linearGradient></defs>
          <g fill="none" stroke="url(#ft-gold)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
            <path d="M145 78 C145 38 174 19 214 19 H265 C282 19 294 13 305 2" />
            <path d="M143 81 C119 89 101 104 91 126 C83 145 97 156 111 144 C124 133 125 114 142 99" />
            <path d="M211 43 C212 83 238 105 271 96 C297 89 319 57 350 22" />
            <path d="M318 20 L357 8 L349 49" />
            <path d="M213 81 L213 143" />
          </g>
          <text x="210" y="164" textAnchor="middle" fill="url(#ft-gold)" fontFamily="Georgia,serif" fontSize="43" fontWeight="bold" letterSpacing="2">FINANCE.TRACK</text>
        </svg>
      </div>
      <p>{message}</p>
      <span className="financetrack-loading-line" />
    </main>
  );
}
