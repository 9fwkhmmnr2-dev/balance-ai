# FINANCE.TRACK — Matriz Free vs. FINANCE PLUS

**Estado:** especificación comercial y funcional en revisión; no representa checkout activo.
**Rama:** `feature/finance-plus-unification`.

## 1. Principios

- FINANCE.TRACK es la plataforma; VERA es su asistente integrado.
- FINANCE FREE y FINANCE PLUS son los planes visibles.
- Mantener por compatibilidad valores internos `free` y `premium` hasta migración deliberada.
- No esconder alertas críticas, seguridad ni controles de privacidad detrás de Plus.
- Mostrar vistas previas transparentes de herramientas Plus, sin fingir que están activas para Free.
- Entitlements validados server-side; nunca confiar en el estado visual del cliente.
- No realizar operaciones financieras sin confirmación explícita.

## 2. FREE

- Funciones esenciales para cuentas, movimientos, presupuestos y objetivos según disponibilidad del producto.
- VERA básico: **20 mensajes diarios**, saldo acumulable máximo **40**. Mensajes no usados se acumulan hasta el tope.
- Resúmenes financieros básicos basados en datos reales.
- Notificaciones de servicio, seguridad y avisos financieros importantes.
- Centro de notificaciones y preferencias esenciales.
- Calculadora básica de Modo Ahorro: importe mensual elegido por el usuario y proyecciones simples a 2, 3, 6 y 12 meses, sin intereses ni inflación.\n- Vista previa y explicación de FINANCE PLUS.
- Acceso a funciones generales de administración financiera que no estén expresamente designadas como Plus.

## 3. FINANCE PLUS

- VERA ampliado: **40 mensajes diarios**, saldo acumulable máximo **80**.
- Respuestas más detalladas, análisis profundo y contexto ampliado dentro de límites sostenibles.
- Modo Ahorro: Operación de Ahorro personalizada, listas, presupuesto, comparación, ofertas verificadas, alternativas, canasta familiar y optimización de cesta cuando haya fuentes autorizadas.
- Evolución e historial de ahorro con estimaciones, confirmaciones y dinero reservado separados.
- Simulador de decisiones y cuotas usando datos existentes de FINANCE.TRACK.
- Importación inteligente y análisis avanzado de documentos: PDF, XLSX, CSV, DOCX e imágenes, con extracción y categorización propuesta; el usuario revisa antes de guardar.
- Informes de cierre mensual y análisis financiero avanzado.
- Planificación y proyección avanzada de objetivos.
- Recomendaciones y seguimiento personalizado más profundos.
- FINANCE Wrapped avanzado.
- Notificaciones inteligentes, umbrales configurables, proyecciones y recomendaciones Plus.
- Personalización Para vos y análisis cruzado según permisos.

## 4. Cuotas de VERA

- Free: 20 mensajes diarios; saldo máximo 40.
- Plus: 40 mensajes diarios; saldo máximo 80.
- Cuota compartida entre conversaciones.
- Reinicio diario a medianoche según zona horaria de la cuenta.
- Solo cuentan solicitudes del usuario procesadas correctamente; fallos técnicos no consumen cuota.
- Al agotarse la cuota, conservar historial y explicar cuándo vuelve a estar disponible.
- Enforcement en servidor; nunca depender del contador del navegador.
- Ajustar límites si costes, abuso o capacidad lo requieren; comunicar cambios antes de aplicarlos.

## 5. Notificaciones por plan y por categoría

Separar tres categorías:
1. **Servicio/seguridad:** actividad de cuenta, movimientos registrados, alertas importantes, situaciones adversas y seguridad. No paywalled.
2. **Recomendaciones personalizadas:** avances, análisis, oportunidades y proyecciones; controles y permisos claros.
3. **Promocionales:** campañas, anuncios de Plus y novedades comerciales; permiso separado, explícito y revocable.

Free recibe alertas esenciales y resumen básico. Plus puede recibir análisis, umbrales, seguimiento y recomendaciones avanzadas. Ningún usuario debe aceptar marketing para usar Free. Consultar `docs/marketing/plus-acquisition-and-personalization.md`.

## 6. Precios propuestos — NO PUBLICAR SIN VALIDACIÓN

- Mensual: **USD 6.99**.
- Anual: **USD 59.99**.
- Alternativa beta orientativa discutida: USD 3.99 mensual / USD 29.99 anual, sujeta a definir duración y condiciones.
- USD 59.99 anual frente a USD 83.88 pagando 12 meses: descuento aproximado **28.5%**, comunicar “casi 30%”, no “30% exacto”.
- No ofrecer precio de por vida ni congelamiento permanente sin validar costes.
- Validar IA, datos/precios, impuestos, comisiones, facturación, mercado y disposición a pagar.
- Checkout y contratos requieren proveedor y titularidad legal apropiada; el usuario menor de edad no debe eludir requisitos de edad/identidad del proveedor.

## 7. Experiencia de descubrimiento y conversión

- Botón dorado bajo el menú: “Descubrí FINANCE PLUS”.
- Vistas previas de módulos Plus accesibles desde Free.
- Cada vista explica qué hace, qué necesita, qué está disponible y qué requiere Plus.
- Todos los CTA conducen a una página única de comparación Free vs. Plus con beneficios y checks.
- No presionar, usar urgencia falsa ni bloquear funciones básicas.
- Marketing personalizado solo con permisos aplicables. Los ejemplos de ahorro deben ser ilustrativos salvo que se basen en precios y datos comprobados.

## 8. Primera entrega de Modo Ahorro\n\n- Free conserva la calculadora básica y puede conocer el importe acumulado para el plazo elegido.\n- Plus incorpora Operación de Ahorro personalizada y herramientas avanzadas; el algoritmo debe revisar capacidad real antes de recomendar un aporte.\n- Comparador, promociones y optimización en vivo solo se habilitan con fuentes autorizadas y datos frescos.\n- No confundir ahorro estimado, ahorro confirmado y dinero reservado.\n\n## 9. Estado y cautelas

Esta matriz consolida decisiones aprobadas y propuestas de precio que aún deben validarse. No implica que todas las funciones estén implementadas. Revisar el código, backend, RLS, entitlements, proveedores, legal y costes antes de publicar.
