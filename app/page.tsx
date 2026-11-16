import AuthGuard from "../components/auth-guard";
import LogoutButton from "../components/logout-button";
import MovementsManager from "../components/movements-manager";
const weeklyActivity = [
  { day: "Lun", height: "45%" },
  { day: "Mar", height: "70%" },
  { day: "Mié", height: "55%" },
  { day: "Jue", height: "85%" },
  { day: "Vie", height: "60%" },
  { day: "Sáb", height: "95%" },
  { day: "Dom", height: "40%" }
];

const navigation = [
  "⌂  Inicio",
  "↔  Movimientos",
  "▥  Estadísticas",
  "◎  Objetivos",
  "◇  Comparador",
  "✳  Asistente IA",
  "⚙  Configuración"
];

export default function Home() {
  return (
    <AuthGuard>
      <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <LogoutButton />
          BALANCE<span>.</span> AI
        </div>

        <div className="nav-label">MENÚ PRINCIPAL</div>

        <nav className="nav-list">
          {navigation.map((item, index) => (
            <div
              key={item}
              className={`nav-item ${index === 0 ? "active" : ""}`}
            >
              {item}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", color: "#A8A29E", fontSize: 12 }}>
          Personal Finance Intelligence
          <br />
          Version 0.1.0
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1 className="page-title">Tu panorama financiero</h1>
            <p className="page-subtitle">
              Entendé qué está pasando con tu dinero.
            </p>
          </div>

          <span className="demo-label">DATOS DE DEMOSTRACIÓN</span>
        </header>

        <section className="stats-grid">
          <article className="card">
            <p className="card-label">Balance disponible</p>
            <h2 className="card-value">$ 1.245.800</h2>
            <p className="card-note">Ejemplo de saldo en ARS</p>
          </article>

          <article className="card">
            <p className="card-label">Ingresos del mes</p>
            <h2 className="card-value">$ 1.850.000</h2>
            <p className="card-note">Ingresos registrados</p>
          </article>

          <article className="card">
            <p className="card-label">Gastos del mes</p>
            <h2 className="card-value">$ 604.200</h2>
            <p className="card-note">Gastos registrados</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="card">
            <h2 className="section-title">Actividad semanal</h2>

            <div className="chart">
              {weeklyActivity.map((item, index) => (
                <div className="chart-column" key={item.day}>
                  <div
                    className={`chart-bar ${index === 5 ? "highlight" : ""}`}
                    style={{ height: item.height }}
                  />
                  <span className="chart-label">{item.day}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h2 className="section-title">Asistente BALANCE AI</h2>
            <p style={{ color: "#78716C", fontSize: 13, lineHeight: 1.7 }}>
              Tu inteligencia financiera personal.
            </p>

            <div
              style={{
                background: "#EFF8FE",
                borderRadius: 8,
                padding: 16,
                marginTop: 18
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                ¡Hola! Soy tu asistente financiero. Puedo ayudarte a entender
                tus ingresos, organizar tus gastos y planificar tus objetivos.
              </p>
            </div>

            <p style={{ color: "#A8A29E", fontSize: 11, marginTop: 16 }}>
              Asistente de demostración · IA próximamente
            </p>
          </article>
        </section>

        <MovementsManager />

          {movements.map((movement) => (
            <div className="movement" key={movement.name}>
              <div>
                {movements.map((movement) => (
  <div className="movement" key={movement.name}>
    <div>
      <p className="movement-name">{movement.name}</p>
      <p className="movement-detail">{movement.category}</p>
    </div>
    <span className="movement-amount">
      {movement.amount}
    </span>
  </div>
))}
</section>

        <footer
          style={{
            color: "#A8A29E",
            fontSize: 11,
            textAlign: "center",
            marginTop: 28
          }}
        >
          BALANCE AI · Personal Finance Intelligence
        </footer>
      </main>
          </div>
    </AuthGuard>
  );
}
