export default function FinanceTrackLoader({ message = "Preparando tu espacio" }: { message?: string }) {
  return (
    <main className="financetrack-loading" aria-live="polite" aria-busy="true">
      <div className="financetrack-loading-lockup" role="img" aria-label="FINANCE TRACK">
        <span className="financetrack-loading-finance">FINANCE</span>
        <span className="financetrack-loading-track">TRACK</span>
      </div>
      <p>{message}</p>
      <span className="financetrack-loading-line" />
    </main>
  );
}
