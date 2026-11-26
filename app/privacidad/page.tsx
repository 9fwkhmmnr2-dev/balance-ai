import Link from "next/link";

const section: React.CSSProperties = { marginTop: 22, lineHeight: 1.7, color: "#C7C5CC", fontSize: 14 };
export default function PrivacyPage() {
  return <main style={{ minHeight: "100vh", background: "#090A0D", color: "#F2F0EB", padding: "40px 20px" }}>
    <article style={{ maxWidth: 780, margin: "0 auto" }}>
      <Link href="/legal/accept" style={{ color: "#D8B66A", fontSize: 13 }}>← Volver</Link>
      <p style={{ color: "#C8A96B", letterSpacing: 2, fontSize: 11, fontWeight: 700, marginTop: 28 }}>FINANCE TRACK · VERSIÓN PRELIMINAR</p>
      <h1 style={{ fontSize: 30 }}>Política de Privacidad</h1>
      <p style={{ color: "#8F8D96", fontSize: 12 }}>Versión 2026-11-26 · Borrador sujeto a revisión legal</p>
      <section style={section}><h2>1. Información que tratamos</h2><p>Podemos tratar datos de cuenta (como correo electrónico), información de perfil, preferencias y datos financieros que ingreses, como cuentas, movimientos, ingresos, gastos, objetivos y compromisos. La fecha de nacimiento se utiliza para comprobar el requisito de edad y no se conserva en la tabla de aceptaciones.</p></section>
      <section style={section}><h2>2. Para qué utilizamos los datos</h2><p>Utilizamos la información para prestar las funciones solicitadas, mostrar resúmenes y estadísticas, mantener la seguridad, guardar preferencias y ofrecer soporte. No vendemos los datos personales.</p></section>
      <section style={section}><h2>3. Proveedores y transferencias</h2><p>La infraestructura de autenticación y base de datos utiliza Supabase. Algunas funciones de VERA pueden enviar mensajes, contexto financiero relevante y documentos que el usuario adjunte a un proveedor externo de inteligencia artificial, como Google Gemini, para generar respuestas o extraer información. Ese envío requiere autorización separada y solo podrá activarse cuando el proveedor y el uso de la aplicación cumplan sus condiciones. Los proveedores externos aplican sus propios términos y políticas; deben revisarse antes de habilitar la integración.</p></section>
      <section style={section}><h2>4. Documentos</h2><p>Cuando se habilite el análisis documental, el archivo seleccionado se enviará al proveedor de IA para su procesamiento. FINANCE.TRACK no debe conservar una copia del archivo original salvo que una función lo informe expresamente. Los resultados extraídos se mostrarán para revisión antes de guardar movimientos.</p></section>
      <section style={section}><h2>5. Conservación y seguridad</h2><p>Los datos de cuenta y financieros se conservan mientras sean necesarios para prestar el servicio o cumplir obligaciones aplicables. Aplicamos controles de acceso y políticas de seguridad, pero no existe una garantía absoluta frente a todos los riesgos.</p></section>
      <section style={section}><h2>6. Tus opciones</h2><p>Podés dejar de autorizar el procesamiento por proveedores de IA; al hacerlo, las funciones que necesiten ese procesamiento dejarán de estar disponibles. También podrás solicitar acceso, corrección o eliminación de datos mediante los canales de contacto que se informarán antes del lanzamiento.</p></section>
      <section style={section}><h2>7. Responsable y actualizaciones</h2><p>Antes del lanzamiento público se debe identificar al responsable del tratamiento, domicilio, correo de contacto, plazos concretos de conservación y mecanismo para ejercer derechos conforme a la normativa aplicable en Argentina y otros países donde opere el servicio.</p></section>
      <p style={{ marginTop: 32, padding: 14, border: "1px solid #66522D", borderRadius: 10, color: "#D8B66A", fontSize: 12 }}>Este documento es un borrador funcional. Requiere revisión legal y completar los datos del responsable antes del lanzamiento público.</p>
    </article>
  </main>;
}
