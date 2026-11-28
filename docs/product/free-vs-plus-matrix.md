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

## 2. FINANCE FREE

- Funciones esenciales para cuentas, movimientos, transferencias, presupuestos y objetivos según disponibilidad del producto.
- VERA: **20 mensajes diarios**, con hasta **40 créditos acumulables**.
- Contexto conversacional de hasta **12 mensajes**.
- Resúmenes financieros básicos basados en datos reales.
- Recomendaciones generales y sencillas basadas en los datos disponibles.
- Notificaciones esenciales de servicio, seguridad y avisos financieros importantes.
- Sin acceso funcional al Modo Ahorro ni a la canasta básica/familiar; solo puede consultar una vista previa informativa.
- Sin análisis avanzado de documentos, simulador avanzado, cierre mensual inteligente ni planificación Plus.

## 3. FINANCE PLUS

- VERA: **100 mensajes diarios**, con hasta **200 créditos acumulables**.
- Contexto conversacional de hasta **32 mensajes**.
- Respuestas más extensas, análisis más profundos y planificación personalizada.
- Análisis comparativo de períodos, categorías y tendencias.
- Simulador de decisiones, compras y cuotas usando datos existentes de FINANCE.TRACK.
- Modo Ahorro, listas, presupuestos de compra y canasta básica/familiar.
- Comparación de comercios, descuentos verificados, alternativas y optimización de canastas solo cuando existan fuentes autorizadas y vigentes.
- Análisis e importación documental con revisión del usuario antes de guardar. Los formatos y límites técnicos dependen de las capacidades efectivamente implementadas.
- Cierre mensual inteligente, planificación avanzada, alertas y Wrapped avanzado.
- Las funciones Plus amplían el análisis, pero no autorizan a inventar información ni a ejecutar operaciones financieras sin confirmación.

## 4. Cuotas de VERA

- Free: 20 créditos por día; máximo acumulable 40.
- Plus: 100 créditos por día; máximo acumulable 200.
- Contador único compartido entre todas las conversaciones del usuario.
- Los créditos se renuevan diariamente según la zona horaria de la cuenta y los no utilizados se acumulan hasta el máximo del plan.
- Solo consume un crédito una solicitud que termina con una respuesta generada correctamente.
- Los errores técnicos no descuentan créditos; si una solicitud reservó un crédito y falla técnicamente, el servidor lo devuelve.
- Al agotarse la cuota, se conserva el historial y se informa que debe esperar la renovación.
- El control es server-side y atómico; nunca depende del contador del navegador.
- No hay una cuota mensual aprobada. No inventar límites de longitud, archivos, memoria o prioridad/modelo hasta definirlos y documentarlos.

## 5. Notificaciones por plan y por categoría

Separar tres categorías:
1. **Servicio/seguridad:** actividad de cuenta, movimientos registrados, alertas importantes, situaciones adversas y seguridad. No son exclusivas de Plus.
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
- Checkout y contratos requieren proveedor y titularidad legal apropiada; no eludir requisitos de edad o identidad del proveedor.

## 7. Experiencia de descubrimiento y conversión

- Botón y vistas previas Plus con explicación transparente de lo que está disponible y lo que requiere el plan.
- Cada vista explica qué hace, qué necesita y qué está implementado.
- Los CTA conducen a una página única de comparación Free vs. Plus.
- No presionar, usar urgencia falsa ni bloquear funciones básicas.
- Marketing personalizado solo con permisos aplicables. Los ejemplos de ahorro deben ser ilustrativos salvo que se basen en precios y datos comprobados.

## 8. Primera entrega de Modo Ahorro

- Modo Ahorro y canasta básica/familiar son exclusivos de FINANCE PLUS. Free solo ve una presentación informativa.
- Plus incorpora calculadora, Operación de Ahorro, listas, presupuestos y planificación de compras.
- El algoritmo debe revisar capacidad real antes de recomendar un aporte.
- Comparador, promociones y optimización en vivo solo se habilitan con fuentes autorizadas y datos frescos.
- No confundir ahorro estimado, ahorro confirmado y dinero reservado.

## 9. Estado y cautelas

Esta matriz consolida decisiones aprobadas y propuestas de precio que aún deben validarse. No implica que todas las funciones estén implementadas. Revisar el código, backend, RLS, entitlements, proveedores, legal y costes antes de publicar.
