# FINANCE: ALGORITMO — Especificación funcional y arquitectura

**Estado:** diseño de producto aprobado conceptualmente. En código existe un registro tipado de motores/modos y una función determinista de proyección de ahorro; los motores analíticos completos siguen pendientes por etapas.
**Rama:** `feature/finance-plus-unification`
**No autoriza deploy, merge a main ni cambios de producción.**

## 1. Propósito

FINANCE: ALGORITMO es el motor de inteligencia y coordinación de FINANCE.TRACK. Conecta módulos y datos autorizados para ayudar a la persona a comprender su situación, tomar decisiones, ahorrar y avanzar hacia sus objetivos.

VERA es la interfaz conversacional que puede explicar resultados, responder preguntas y profundizar análisis. El algoritmo también debe aportar valor directamente en los módulos, sin obligar al usuario a conversar con VERA.

Principios:
- Beneficio financiero y personal real, no maximizar clics, tiempo de pantalla ni compras.
- Los cálculos financieros son deterministas, reproducibles y basados en datos disponibles.
- La IA generativa explica y contextualiza; no inventa cifras, fuentes, precios, movimientos ni hechos.
- Datos incompletos generan resultados parciales claramente señalados, nunca certezas falsas.
- Analiza únicamente datos propios autorizados y necesarios para cada función.
- No realiza transferencias, pagos, compras, operaciones de inversión ni modificaciones de datos financieros sin confirmación explícita separada.

## 2. Modos de funcionamiento aprobados

1. **Automático:** analiza en segundo plano datos autorizados y genera alertas solo cuando hay algo realmente útil.
2. **A demanda:** analiza cuando la persona abre un módulo o solicita una evaluación.
3. **Seguimiento:** observa evolución de metas, presupuestos, deudas, ahorros y tendencias para detectar desvíos relevantes.
4. **Análisis profundo:** cruza módulos para elaborar una evaluación más completa, disponible según permisos y plan.

Autonomía acordada: **equilibrada**. El algoritmo puede analizar y preparar propuestas, pero no aplicar cambios financieros por su cuenta.

Aprendizaje acordado: **adaptativo**. Puede ajustar recomendaciones a partir de preferencias declaradas, uso, recomendaciones aceptadas/rechazadas, correcciones y resultados confirmados. Debe ser transparente, controlable y desactivable.

Prioridad acordada: **combinada**. Considera beneficio económico, metas personales, intereses/preferencias y relevancia contextual.

## 3. Arquitectura de motores especializados

- **FINANCE ANALYTICS:** ingresos, gastos, movimientos, saldos, patrimonio, categorías, tendencias y calidad de datos.
- **FINANCE PREDICT:** proyecciones de saldos, presupuestos, metas, ahorro y escenarios.
- **FINANCE SAVINGS:** Modo Ahorro; comparación de precios, canastas, alternativas y coste total.
- **FINANCE RECOMMEND:** ordena recomendaciones según situación, objetivos, preferencias y utilidad.
- **FINANCE PROFILE:** intereses, preferencias, contexto declarado y controles de personalización.
- **FINANCE DECISION:** simulación de compras, cuotas, presupuestos, decisiones y plazos de objetivos.
- **FINANCE DOCUMENTS:** extracción de documentos, identificación de movimientos, clasificación y detección de inconsistencias para revisión.
- **FINANCE ALERTS:** decide si corresponde notificar, prioridad, agrupación, frecuencia y prevención de spam.
- **FINANCE REPORTS:** cierres mensuales, informes anuales, comparaciones y Wrapped a partir de datos comprobables.
- **FINANCE LEARNING:** adaptación a preferencias, correcciones y resultados confirmados.

## 4. Flujo técnico

1. **Captura autorizada:** cuentas, movimientos, presupuestos, metas, preferencias, documentos y fuentes externas permitidas.
2. **FINANCE DATA LAYER:** normaliza, valida, fecha y etiqueta procedencia, moneda, calidad, permisos y frescura.
3. **Análisis:** motores especializados calculan métricas y detectan patrones.
4. **Predicción:** escenarios deterministas con supuestos visibles.
5. **Recomendación:** prioriza opciones según beneficio, meta, interés, contexto, confianza y actualidad.
6. **Validación:** comprueba permisos, calidad, frescura, privacidad y reglas del producto.
7. **Entrega:** comunica en el módulo, notificación, informe o VERA.
8. **Aprendizaje:** registra correcciones y resultados permitidos para mejorar recomendaciones futuras.

Arquitectura lógica:
`Módulos → FINANCE DATA LAYER → FINANCE: ALGORITMO → validación/permisos → módulos, notificaciones, informes y VERA`.

## 5. Puntuación y clasificación de recomendaciones

Factores propuestos:
- beneficio económico potencial;
- relevancia para una meta personal;
- coincidencia con intereses y preferencias;
- relevancia temporal/contextual;
- nivel de confianza;
- frescura de los datos.

Tipos de resultado:
- **Informativo:** explica un dato o tendencia.
- **Recomendación:** sugiere una opción no obligatoria.
- **Atención:** señala una situación que merece revisión.
- **Crítico:** comunica un evento de importancia alta, especialmente seguridad o riesgo financiero.

No puntuar por probabilidad de clic o compra. La recomendación debe poder explicar por qué aparece y qué datos la sustentan.

## 6. Propuestas de mejora con confirmación

El algoritmo puede preparar propuestas para:
- ajustar un presupuesto;
- modificar una meta o plazo;
- reorganizar un plan de ahorro;
- revisar una planificación;
- evaluar alternativas de compra o cuotas.

Debe mostrar situación actual, cambio propuesto, impacto esperado, supuestos y riesgos. **La persona confirma antes de aplicar cualquier cambio.**

## 7. Integración entre módulos

Puede cruzar, si existe autorización:
Inicio, Mis cuentas, Movimientos, Presupuestos, Objetivos, Ahorros, Patrimonio, Deudas, Inversiones, Economía, Fiscalidad, Modo Ahorro, Perfil/Para vos, Wrapped, Notificaciones y VERA.

Ejemplo de meta:
- La persona quiere reunir 150.000 en seis meses.
- Objetivos calcula una referencia de 25.000 por mes.
- Analytics evalúa ingresos, gastos y compromisos.
- Predict presenta escenarios y supuestos.
- Savings identifica oportunidades de menor coste.
- Recommend ordena las opciones.
- Learning adapta futuras sugerencias a las correcciones y resultados.
- Objetivos registra aportes realmente reservados y progreso confirmado.

El ahorro potencial por comprar más barato no se convierte automáticamente en dinero reservado para la meta.

## 8. Perfil, intereses y personalización

Intereses declarados posibles: tecnología, gaming, deportes, viajes, música, educación y categorías personalizadas.

La sección **Para vos** puede mostrar productos relacionados, alternativas más económicas, metas alcanzables, ofertas verificadas, comparaciones y recomendaciones financieras útiles.

Controles:
- editar intereses;
- desactivar personalización;
- revisar qué información se utiliza;
- retirar permisos aplicables;
- no vender preferencias ni compartir datos financieros para publicidad.

## 9. Reglas financieras y de seguridad

- Separar estimaciones, resultados confirmados y dinero reservado.
- No contar dos veces la misma oportunidad de ahorro.
- No suponer que un saldo de perfil equivale a cuentas o movimientos registrados.
- Mostrar moneda, fecha, fuente, supuestos y limitaciones.
- Datos de mercado/precios solo desde fuentes autorizadas y vigentes.
- Sin automatizar transferencias, pagos, compras ni operaciones de inversión.
- RLS, aislamiento por usuario, autorización server-side y mínimo acceso necesario.
- Mantener controles legales y de elegibilidad de VERA separados del acceso general a finanzas personales.
- No activar funciones de IA sin los permisos requeridos.

## 10. Estado y dependencias

Esta es la especificación objetivo. No significa que todos los motores estén implementados. La implementación debe avanzar por etapas, empezando por datos fiables, cálculos deterministas, permisos y trazabilidad antes de automatizar recomendaciones.

Ver también:
- [Modo Ahorro](./modo-ahorro-spec.md)
- [Free vs. Plus](./free-vs-plus-matrix.md)
- [Adquisición y notificaciones](../marketing/plus-acquisition-and-personalization.md)
- [Onboarding](../onboarding-and-legal-flow.md)
