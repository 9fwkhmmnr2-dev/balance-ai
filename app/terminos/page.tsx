import Link from "next/link";

const section: React.CSSProperties = { marginTop: 22, lineHeight: 1.7, color: "#C7C5CC", fontSize: 14 };
export default function TermsPage() {
  return <main style={{ minHeight: "100vh", background: "#090A0D", color: "#F2F0EB", padding: "40px 20px" }}>
    <article style={{ maxWidth: 780, margin: "0 auto" }}>
      <Link href="/legal/accept" style={{ color: "#D8B66A", fontSize: 13 }}>← Volver</Link>
      <p style={{ color: "#C8A96B", letterSpacing: 2, fontSize: 11, fontWeight: 700, marginTop: 28 }}>FINANCE TRACK · VERSIÓN PRELIMINAR</p>
      <h1 style={{ fontSize: 30 }}>Términos y Condiciones</h1>
      <p style={{ color: "#8F8D96", fontSize: 12 }}>Versión 2026-11-26 · Borrador sujeto a revisión legal</p>
      <section style={section}><h2>1. Edad y acceso</h2><p>FINANCE.TRACK está destinado exclusivamente a personas de 18 años o más. Al crear una cuenta, declarás que cumplís esa edad. Podemos bloquear el acceso si no se cumple este requisito o si no se aceptan estos términos y la Política de Privacidad.</p></section>
      <section style={section}><h2>2. Naturaleza del servicio</h2><p>FINANCE.TRACK permite registrar, organizar y consultar información financiera personal. La aplicación es una herramienta de organización y educación financiera; no es un banco, asesor financiero, contador, abogado ni asesor de inversiones. No garantiza resultados ni reemplaza asesoramiento profesional.</p></section>
      <section style={section}><h2>3. Responsabilidad sobre los datos</h2><p>La persona usuaria es responsable de que los datos ingresados sean correctos y de revisar los movimientos, importes, categorías y resultados antes de tomar decisiones.</p></section>
      <section style={section}><h2>4. VERA y funciones automatizadas</h2><p>VERA puede utilizar sistemas automatizados de inteligencia artificial. Sus respuestas pueden contener errores, omisiones o estimaciones. No tomes decisiones financieras importantes basándote únicamente en sus respuestas. Los datos solo se enviarán a un proveedor externo cuando la función esté habilitada, exista autorización específica y un responsable adulto haya verificado que el proveedor y la modalidad de servicio permiten ese tratamiento. No se enviarán datos financieros personales a modalidades gratuitas que no permitan ese uso.</p></section>
      <section style={section}><h2>5. Seguridad y disponibilidad</h2><p>Aplicamos medidas técnicas y organizativas razonables para proteger las cuentas y los datos. Ningún sistema conectado a Internet puede garantizar seguridad absoluta. Podemos actualizar, limitar o suspender funciones por mantenimiento, seguridad o cumplimiento normativo.</p></section>
      <section style={section}><h2>6. Uso permitido</h2><p>No debés intentar acceder a cuentas ajenas, interferir con el servicio, vulnerar controles de seguridad ni utilizar la aplicación para actividades ilícitas.</p></section>
      <section style={section}><h2>7. Cambios y contacto</h2><p>Podemos actualizar estos términos. Cuando un cambio requiera nueva aceptación, la aplicación la solicitará antes de continuar. Los canales de contacto y el domicilio legal del responsable deben incorporarse antes del lanzamiento público.</p></section>
      <p style={{ marginTop: 32, padding: 14, border: "1px solid #66522D", borderRadius: 10, color: "#D8B66A", fontSize: 12 }}>Este documento es un borrador funcional. No debe considerarse una versión legal definitiva ni publicarse sin revisión de un adulto responsable y asesoramiento jurídico local.</p>
    </article>
  </main>;
}
