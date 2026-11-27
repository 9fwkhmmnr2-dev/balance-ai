# FINANCE.TRACK — Adquisición de usuarios y conversión ética a FINANCE PLUS

**Estado:** especificación de producto/marketing aprobada para diseño; pendiente de implementación, validación de datos y revisión legal.
**Rama de trabajo:** `feature/finance-plus-unification`
**Alcance:** documentación y diseño. No autoriza deploys, merges a `main`, cambios de producción ni activación de campañas.

## 1. Idea central

La estrategia no empieza vendiendo una suscripción. Empieza mostrando a la persona cómo FINANCE.TRACK puede ayudarla a acercarse a algo que realmente quiere conseguir.

Principio de comunicación:

> No vender solamente una herramienta financiera: mostrar qué objetivo personal podría alcanzar la persona al organizar mejor su dinero y aprovechar las herramientas disponibles.

Nombre provisional de la iniciativa: **FINANCE: WANT TO ACHIEVE**. Es una etiqueta conceptual para el sistema de objetivos e inspiración; no es todavía una marca pública ni una función implementada.

## 2. Recorrido de adquisición

1. **Descubrimiento en TikTok:** contenido corto muestra ejemplos de objetivos (gaming, tecnología, viajes, educación, música, deportes, etc.) y cómo un plan de ahorro podría acercar a ellos.
2. **Entrada por curiosidad:** la persona llega a FINANCE.TRACK para conocer su situación y explorar una meta.
3. **Registro y PERFIL FINANCE:** completa el flujo obligatorio y guiado ya especificado en `docs/onboarding-and-legal-flow.md`.
4. **Intereses y objetivos declarados:** puede indicar categorías que le interesan (por ejemplo, gaming) y qué desea conseguir. No inferir intereses sensibles ni asumir que un interés equivale a intención de compra.
5. **Permisos claros:** la persona configura por separado notificaciones de servicio, recomendaciones personalizadas y comunicaciones promocionales. Ninguna autorización promocional se deduce de aceptar términos, privacidad o de habilitar avisos esenciales.
6. **Primera experiencia útil:** FINANCE: ALGORITMO presenta una oportunidad o simulación realista, solo si cuenta con datos suficientes y permiso aplicable.
7. **Descubrimiento de PLUS:** cuando una herramienta Plus puede aportar valor concreto, se explica qué hace, qué datos necesita y qué parte está disponible en Free. La llamada a la acción lleva a una única página comparativa Free vs. Plus.
8. **Decisión libre:** no bloquear funciones esenciales ni presionar a la persona. Debe poder continuar usando Free y cambiar preferencias o retirar permisos.

## 3. Personalización mediante FINANCE: ALGORITMO

Ejemplo de contexto declarado:
- Interés: gaming.
- Objetivo: ahorrar para un videojuego.
- Ahorro mensual indicado o estimado a partir de información autorizada: USD 25.
- Horizonte de ejemplo: dos meses.

El algoritmo puede convertir esos datos en una simulación sencilla:
- USD 25 por mes durante dos meses = USD 50 acumulados, si la persona efectivamente reserva ese dinero.
- Si el precio verificado e integral del producto fuera USD 64, quedarían USD 14 por cubrir.
- Esto no significa que el juego cueste USD 14 ni que la compra ya esté financiada: USD 14 es la diferencia pendiente en ese ejemplo hipotético.

No usar nombres, precios, fechas de lanzamiento, disponibilidad o descuentos de productos como datos reales sin verificación. El ejemplo de GTA 6 es ilustrativo y no constituye una cotización ni una afirmación sobre su precio o disponibilidad.

### Reglas de cálculo y lenguaje
- Diferenciar siempre **capacidad estimada de ahorro**, **ahorro confirmado** y **dinero efectivamente reservado**.
- Un gasto reducido o una oportunidad detectada no se convierte automáticamente en saldo disponible ni en aporte a un objetivo.
- No afirmar que una persona podrá comprar algo si el cálculo solo muestra una posibilidad.
- Considerar gastos esenciales, compromisos, ingresos variables, horizonte y margen de seguridad antes de sugerir una meta.
- Si los datos son insuficientes, preguntar o mostrar una simulación explícitamente hipotética; no inventar datos.
- Si la persona no tiene margen de ahorro, no sugerir que recorte necesidades básicas ni inducir endeudamiento.
- Mostrar moneda, fecha, fuente, presentación exacta y costes adicionales cuando se use un precio externo.
- Recalcular cuando cambien los precios, los ingresos, los gastos o el objetivo.

## 4. Notificaciones: categorías y permisos separados

No mezclar alertas necesarias para operar la cuenta con recomendaciones personalizadas ni con marketing.

### A. Notificaciones de servicio y seguridad
Incluyen avisos de seguridad, cambios relevantes de cuenta, movimientos registrados, alertas importantes y recordatorios esenciales que correspondan. Se gestionan como comunicaciones operativas; las alertas críticas de seguridad no deben depender de una suscripción Plus ni quedar desactivadas por una preferencia de marketing.

### B. Recomendaciones y seguimiento personalizado
Incluyen avances de objetivos, análisis, proyecciones, oportunidades de ahorro y recomendaciones basadas en intereses declarados. Requieren controles de personalización claros y permisos aplicables. Deben permitir ajustar categorías, frecuencia, horarios y desactivar la personalización.

### C. Comunicaciones promocionales
Incluyen novedades comerciales, campañas, invitaciones a conocer Plus, ofertas de suscripción y mensajes cuyo propósito principal sea vender. Requieren una elección separada, explícita y revocable, conforme a la normativa aplicable. No enviar si la persona no autorizó este tipo de comunicación.

### Reglas comunes
- En la interfaz, explicar para qué sirve cada permiso antes de solicitarlo.
- No marcar casillas opcionales por defecto.
- No condicionar el uso básico de FINANCE.TRACK a aceptar marketing.
- Respetar bajas, preferencias, quiet hours y límites de frecuencia.
- Agrupar alertas repetidas y evitar notificaciones invasivas.
- Registrar versión, fecha y alcance del consentimiento cuando corresponda.
- No compartir intereses ni datos financieros con anunciantes o terceros para publicidad.
- No revelar saldos, movimientos, deudas ni objetivos en la pantalla bloqueada; usar textos discretos.
- Las notificaciones personalizadas deben aportar utilidad real, no optimizar clics ni generar compras impulsivas.

## 5. Ejemplo de notificación personalizada

**Título:** Una meta gamer para vos

**Texto ilustrativo:**
“Si pudieras reservar USD 25 por mes, en dos meses reunirías USD 50. Si el juego que te interesa costara USD 64 (precio hipotético), te faltarían USD 14. FINANCE PLUS incluye Modo Ahorro, que puede ayudarte a comparar oportunidades y organizar tus compras para acercarte a tu objetivo.”

**CTA:** “Descubrir FINANCE PLUS”

**Aclaración:** ejemplo hipotético. No es una oferta, precio actual ni garantía de ahorro. El mensaje solo se envía si la persona aceptó la categoría correspondiente y los datos son adecuados.

No presentar este ejemplo como una función disponible en Free: Modo Ahorro es una herramienta Plus. Free puede recibir una explicación o vista previa transparente, sin simular que tiene acceso a la herramienta.

## 6. Relación entre Free y Plus

- Free conserva las funciones esenciales de administración financiera y las notificaciones básicas/operativas.
- Plus puede ofrecer análisis personalizados más profundos, Modo Ahorro, seguimiento avanzado, proyecciones y recomendaciones adicionales conforme al catálogo vigente.
- No paywallear alertas de seguridad, información crítica ni controles de privacidad.
- No enviar recomendaciones Plus como si fueran funciones ya activas en Free.
- Las vistas previas deben explicar qué hace la función, sus límites y qué cambia al pasar a Plus.
- Todos los CTA comerciales conducen a una única página de comparación Free vs. Plus, sin checkout improvisado ni mensajes engañosos.
- Los precios comerciales siguen siendo hipótesis sujetas a validación de costes, impuestos, comisiones, mercado y requisitos del proveedor de pagos.

## 7. Medición de la estrategia

Medir utilidad y conversión sin perfilar de forma invasiva:
- visitas desde cada campaña y fuente;
- finalización del registro y del PERFIL FINANCE;
- porcentaje que configura intereses/objetivos y permisos;
- uso real de vistas previas y módulos;
- conversiones a Plus y cancelaciones;
- objetivos creados y progreso confirmado;
- recomendaciones aceptadas, descartadas y corregidas;
- quejas, bajas de notificaciones y señales de fatiga.

No optimizar únicamente CTR, tiempo de uso o compras. Priorizar utilidad financiera, transparencia, satisfacción y retención voluntaria. Usar métricas agregadas cuando sea posible y respetar minimización de datos.

## 8. Salvaguardas y requisitos pendientes

- Revisar la normativa argentina aplicable a publicidad, defensa del consumidor, comunicaciones comerciales y protección de datos personales antes del lanzamiento.
- Diseñar controles adecuados para menores y no usar la estrategia para promover servicios restringidos por edad.
- No recopilar más datos de los necesarios para personalización.
- Permitir revisar, corregir y eliminar intereses y objetivos; ofrecer opción de desactivar personalización.
- No vender ni compartir preferencias o información financiera para publicidad.
- No utilizar técnicas de urgencia artificial, culpa, miedo a perderse algo o presión social.
- No recomendar compras que comprometan necesidades esenciales ni fomentar endeudamiento.
- Modo Ahorro debe usar fuentes autorizadas y precios recientes; nunca inventar comercios, stock, descuentos o cotizaciones.
- Los permisos de notificación del sistema operativo y los consentimientos internos de FINANCE.TRACK son capas diferentes: explicar ambas y respetar ambas.
- Las comunicaciones dirigidas a menores requieren revisión específica y controles apropiados.

## 9. Dependencias de implementación

1. Completar PERFIL FINANCE guiado y la configuración de intereses/objetivos.
2. Definir el modelo de preferencias y consentimientos separados.
3. Implementar centro de preferencias y revocación.
4. Implementar FINANCE: ALGORITMO con cálculos deterministas, validación de datos y registro de razonamiento.
5. Integrar fuentes de precios autorizadas antes de emitir comparaciones reales.
6. Crear plantillas de notificación por categoría, con control de frecuencia y contenido discreto.
7. Conectar vistas previas y CTA a la página comparativa Free vs. Plus.
8. Instrumentar métricas agregadas y pruebas de privacidad.
9. Completar revisión legal, de seguridad y de experiencia antes de publicar.

## 10. Criterios de aceptación

- Un usuario Free puede entender la propuesta de valor de Plus sin recibir afirmaciones falsas sobre funciones disponibles.
- Las notificaciones de servicio, recomendaciones y promociones están separadas en interfaz, preferencias y lógica de envío.
- Ninguna comunicación promocional se envía sin el permiso correspondiente.
- Cada recomendación muestra su carácter estimado o confirmado y la base del cálculo.
- Las metas respetan gastos esenciales y no presuponen que un ahorro estimado ya fue reservado.
- Los precios externos son trazables y actuales; si no hay fuente válida, el mensaje se presenta como hipotético o no se envía.
- El usuario puede cambiar intereses, limitar frecuencia y retirar permisos.
- No se activa una campaña ni se publica contenido legal/comercial sin revisión y autorización.

---
Este documento registra decisiones de diseño y marketing. No representa una implementación técnica ni una aprobación legal final.
