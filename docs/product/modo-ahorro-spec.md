# FINANCE.TRACK: Modo Ahorro — Especificación completa de producto

**Plan:** FINANCE PLUS.
**Estado:** interfaz inicial parcialmente implementada. El módulo está bloqueado para Free. Operación de Ahorro Plus aún es una proyección de referencia, no una evaluación de capacidad ni un plan persistido. Comparación real, ofertas y optimización avanzada dependen de fuentes autorizadas y backend.
**Rama:** `feature/finance-plus-unification`.

## 1. Promesa

Ayudar a gastar menos en compras planificadas comparando productos equivalentes y el coste total real. No mostrar descuentos genéricos sin verificar ni inventar precios, comercios, stock u ofertas.

## 2. Funciones

1. **Acceso Plus:** todo el espacio Modo Ahorro, incluidas calculadora, Operación de Ahorro, listas y presupuestos, es exclusivo de FINANCE PLUS. Free solo puede ver una presentación informativa sin usar las herramientas.
2. **Operación de Ahorro (Plus):** planes prediseñados y personalizados a partir de un importe y plazo elegidos. FINANCE: ALGORITMO solo puede recomendar aportes después de evaluar ingresos, gastos esenciales, compromisos, reservas y objetivos autorizados. Permitir reducir, pausar o cancelar sin penalizaciones.
3. **Listas de compras:** crear listas por texto o imagen, cantidades, presentaciones y marcas preferidas.
4. **Presupuesto de compra:** definir límite y detectar qué productos elevan el total; sugerir alternativas sin presionar a comprar.
5. **Comparación de comercios:** comparar mismo producto/presentación en supermercados, farmacias y comercios admitidos.
6. **Descuentos y promociones:** cupones, bancos, tarjetas y promociones con fuente, vigencia, requisitos, restricciones y condiciones.
7. **Alternativas económicas:** marcas, variantes y tamaños comparables; normalizar precio por kg, litro o unidad y explicar diferencias.
8. **Optimización de canasta:** comparar compra en un solo comercio frente a varios; considerar entrega, mínimo de compra, distancia, transporte y otros costes.
9. **Análisis de ahorro:** estimar oportunidades y registrar ahorro realizado solo cuando el usuario confirme el precio real de compra.

## 3. Canasta mensual familiar

Herramienta Plus donde la persona selecciona:
- cantidad de integrantes del hogar;
- duración: 15, 30, 60 días o período configurable;
- categorías y cantidades de productos.

Debe mantener dos referencias distintas:
1. **Canasta Básica Alimentaria (CBA) del INDEC:** referencia estadística oficial, no una lista personalizada de compras ni consejo nutricional.
2. **Canasta práctica FINANCE.TRACK:** conjunto configurable de categorías y cantidades para comparar costes reales.

Resultados posibles:
- coste estimado de la canasta para tamaño y duración elegidos;
- comparación de canastas equivalentes entre comercios;
- diferencia y ahorro potencial;
- proyección mensual/anual claramente identificada como estimación;
- estrategia de compra en uno o varios comercios con costes de traslado/entrega y mínimos.

No convertirla en dieta, recomendación clínica ni consejo nutricional. No afirmar que la canasta práctica representa exactamente la CBA.

## 4. Datos, equivalencia y calidad

Cada oferta debe registrar:
- comercio y fuente autorizada;
- producto exacto, marca, modelo/variante y presentación;
- cantidad, unidad y precio unitario normalizado;
- moneda y precio total;
- fecha/hora de consulta y estado de frescura;
- disponibilidad solo cuando esté verificada;
- condiciones de promoción, vigencia y elegibilidad;
- entrega, mínimos, viaje u otros cargos cuando se conozcan.

No comparar como idénticos productos de distinto tamaño, calidad, variante o contenido. Marcar sustituciones explícitamente.

Si no existe fuente confiable, informar que no se encontró una oferta verificada. No hacer scraping ni mostrar comercialmente datos si la licencia no lo permite.

## 5. Ubicación y privacidad

La comparación cercana requiere ubicación aproximada compartida explícitamente o zona ingresada manualmente. Permitir usar la función sin ubicación precisa cuando sea posible. No conservar ubicación precisa por defecto. No compartir listas ni preferencias con comercios.

## 6. Ahorro: tres conceptos obligatorios

- **Ahorro potencial/estimado:** diferencia calculada entre alternativas comparables, aún no realizada.
- **Ahorro confirmado/realizado:** diferencia respaldada por precio real de compra que el usuario confirmó.
- **Dinero reservado:** importe que la persona separó efectivamente para una meta.

No confundirlos ni sumarlos como si fueran el mismo saldo. Evitar contar dos veces una misma oportunidad.

## 7. Evolución e historial de ahorro

Panel Plus con vistas mensual, trimestral, semestral, anual y total:
- ahorro potencial;
- ahorro confirmado;
- promedio mensual;
- mejor período;
- comercios y categorías donde más se ahorró;
- evolución y proyecciones;
- historial de oportunidades y confirmaciones.

Informe anual de VERA puede resumir evolución, mejor mes, categorías/comercios y proyección del próximo año usando datos verificados.

## 8. Integración con Objetivos y demás módulos

Modo Ahorro puede ayudar a reducir el coste de compras para acercarse a metas. Objetivos calcula aportes y plazo; Analytics evalúa capacidad; Predict presenta escenarios; VERA explica recomendaciones.

Una compra más barata no significa que el importe ahorrado haya sido depositado o reservado. Para sumar dinero a una meta, el usuario debe registrar o confirmar la reserva.

## 9. Límites de plan

Todo Modo Ahorro y la canasta básica/familiar son exclusivos de FINANCE PLUS. Free solo puede ver una presentación informativa; no puede usar la calculadora del módulo, listas, presupuestos ni comparaciones. Las funciones esenciales de finanzas y seguridad siguen disponibles en Free.

## 10. Estado técnico conocido

- Existe una primera interfaz en `components/vera-savings-mode.tsx`, CSS asociado y ruta `/finance-plus/ahorro`.
- La interfaz Plus incluye lista, cantidades, presupuesto y cálculos con precios de referencia ingresados por el usuario.
- La UI inicial no equivale a cotizaciones en vivo.
- Comparador, descuentos y optimización avanzada fueron marcados como próximos.
- Persistencia, endpoints, integración de comercios y precios autorizados no están completos.
- No activar ofertas hasta validar licencia, calidad, frescura, seguridad y coste total.

## 11. Primera entrega prevista

- Free: vista previa informativa, sin acceso funcional al Modo Ahorro ni a canastas.
- Plus: calculadora, Operación de Ahorro y herramientas de planificación/compras; las comparaciones y ofertas reales permanecen desactivadas hasta integrar fuentes autorizadas.
- Las notificaciones de seguimiento requieren preferencias/permisos y una fuente de datos persistente; no se simulan como activas en esta primera interfaz.
- La primera interfaz no persiste aún el plan ni la lista en Supabase; no debe presentarse como seguimiento automático.

## 12. Criterios de aceptación

- Comparaciones de productos equivalentes y cantidades normalizadas.
- Coste total considera gastos conocidos y condiciones.
- Toda oferta externa tiene fuente y fecha.
- Estimado, confirmado y reservado se muestran separados.
- El usuario puede editar/eliminar listas y controlar ubicación.
- Sin compras, redenciones ni transferencias automáticas.
- Datos insuficientes producen aviso, no invención.


## 13. Beta del comparador inteligente — arquitectura de fuentes

**Objetivo inicial:** permitir buscar un producto y comparar precios publicados por fuentes autorizadas, sin presentar datos incompletos como si fueran una oferta garantizada.

### Fuentes candidatas para la beta

1. **SEPA / Precios Claros:** primera prioridad para productos de consumo masivo. La base pública informa precios minoristas y mayoristas con actualización diaria y licencia CC BY 4.0. Atribuir siempre a SEPA y conservar fecha, comercio y sucursal cuando estén disponibles. La declaración del comercio no constituye verificación independiente del precio en góndola.
2. **Mercado Libre:** publicaciones de marketplace mediante sus APIs oficiales, sujeto a validación de permisos, límites, atribución y términos de uso vigentes. Mostrar como publicación de marketplace, no como precio de sucursal.
3. **Tiendanube y feeds directos:** integrar únicamente tiendas que autoricen expresamente el acceso a su catálogo.
4. **Open Food Facts:** enriquecer identificación de alimentos por código de barras y atributos del producto; no utilizarlo como fuente de precios.
5. **Aportes de comunidad:** etapa posterior, separados visualmente de datos comerciales y oficiales. Nunca convertir un aporte en precio verificado solo por cantidad de reportes.

### Proveedor SEPA de terceros

Se evaluará el proyecto público `superprecios-claros` como acelerador de la beta. Expone un manifest y búsquedas por EAN con agregaciones regionales e histórico, basados en SEPA. Antes de depender de él en producción se deben revisar disponibilidad, frecuencia real, licencia del código, términos del hosting, continuidad y atribución. Es un intermediario comunitario, no una API oficial del Estado.

### Flujo técnico

`Fuentes autorizadas → conectores → normalización → controles de calidad → índice de búsqueda → comparador → interfaz VERA:AHORRO`

- Registrar por fuente: titular, tipo, licencia/términos, cobertura, límites, cadencia, última sincronización y estado.
- Preferir coincidencia exacta por EAN/GTIN o SKU. Si no existe, comparar por marca, modelo, contenido y variante; indicar claramente coincidencias aproximadas.
- Mantener separados precio de lista, precio promocional, requisitos de elegibilidad, stock, envío y costo total.
- No consultar proveedores externos en cada pulsación de búsqueda. Sincronizar y cachear datos cuando las condiciones de la fuente lo permitan.
- Para cada observación guardar fuente, fecha declarada, fecha de captura, comercio, sucursal/región, moneda, presentación, condición promocional y estado de disponibilidad.
- Si un dato está vencido, incompleto o no es comparable, mostrarlo como tal o excluirlo del ranking.
- La ubicación se ingresará manualmente. No solicitar ni almacenar ubicación precisa del dispositivo para esta función.

### Etiquetas de procedencia

- **Informado por comercio (SEPA)**
- **Sincronizado con comercio**
- **Publicado en marketplace**
- **Aporte de comunidad**
- **Dato histórico**

No usar una etiqueta genérica “verificado” si no hubo una comprobación independiente adecuada.

### Alcance y límites de la primera beta

- Comenzar por productos de consumo masivo cubiertos por SEPA y ampliar categorías solo cuando haya una fuente autorizada y cobertura suficiente.
- La cobertura nacional es un objetivo de arquitectura, no una promesa de que cada producto o localidad tendrá resultados.
- La búsqueda por necesidad será una capa posterior de IA sobre el mismo catálogo estructurado; nunca debe inventar productos ni precios.
- No persistir archivos SEPA completos de gran volumen en tablas transaccionales de Supabase sin evaluar almacenamiento, particionado, índices y costes.
- No crear migraciones ni activar conectores hasta validar contratos de datos, límites, licencia y estrategia de almacenamiento.


## 14. Calculadora de ahorro multidivisa — primera implementación

- Monedas iniciales: ARS, USD, EUR y BRL.
- El usuario define el objetivo y aporte mensual en una moneda original.
- La vista permite mostrar ambas monedas, solo la original o solo la moneda equivalente.
- La equivalencia usa la cotización publicada por la API oficial de Estadísticas Cambiarias del BCRA para USD, EUR y BRL; ARS funciona como unidad base.
- La conversión se calcula con la cotización disponible y no proyecta tipos de cambio futuros. La moneda original conserva su importe nominal en todos los plazos.
- Se informa fecha y procedencia de la cotización. Si el BCRA no entrega todas las cotizaciones requeridas, no se inventan valores: se mantiene la proyección en moneda original y se informa que la conversión no está disponible.
- La referencia del BCRA no debe describirse como precio minorista de compra/venta ni como cotización garantizada para una operación.
- Advertencia visible obligatoria: las proyecciones son matemáticas y no contemplan inflación, devaluación, variaciones futuras del tipo de cambio, cambios de precios, impuestos, comisiones, intereses, retiros ni otros acontecimientos económicos; el poder adquisitivo futuro puede diferir.
- Los importes de lista de compras y presupuesto permanecen expresados en ARS en esta etapa; la multidivisa aplica a la calculadora y a la Operación de Ahorro.
- No se guarda ni persiste una meta multidivisa en esta primera entrega.
