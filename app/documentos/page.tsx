import AuthGuard from "@/components/auth-guard";
import DocumentIntelligence from "@/components/document-intelligence";

export default function DocumentosPage() {
  return (
    <AuthGuard>
      <main style={{ minHeight: "100vh", padding: "clamp(18px,4vw,42px)", background: "#0b1220" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <a href="/" style={{ color: "#c6a66c", textDecoration: "none", fontSize: 13 }}>← Volver a FINANCE.TRACK</a>
          <div style={{ marginTop: 22 }}><DocumentIntelligence /></div>
        </div>
      </main>
    </AuthGuard>
  );
}
