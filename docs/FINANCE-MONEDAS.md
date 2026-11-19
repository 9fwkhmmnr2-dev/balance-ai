# FINANCE:MONEDAS — Especificación técnica y auditoría inicial

Estado: especificación aprobada conceptualmente; auditoría de código inicial.
Rama de trabajo: `feature/mis-cuentas`.
Producción: fuera de alcance. No ejecutar migraciones ni modificar datos durante esta fase.

## 1. Objetivo

Construir un sistema multidivisa compartido por cuentas, movimientos, balances, estadísticas, conversor y VERA. Los importes originales nunca se sustituyen por equivalencias convertidas.

## 2. Decisiones funcionales aprobadas

1. Admitir todas las monedas fiat activas del catálogo internacional ISO 4217.
2. Cada usuario elige su moneda principal durante la configuración inicial; puede cambiarla posteriormente.
3. El patrimonio actual se valora con cotizaciones actuales válidas. Los movimientos conservan su equivalencia histórica.
4. Sin cotización confiable no hay conversión automática.
5. FINANCE recomienda fuentes según país y mercado.
6. El patrimonio debe mostrar total valorado y estado de valoración incompleta.
7. Cambiar fuentes solo desde configuraciones avanzadas.
8. En conversiones, conservar por separado importe enviado, importe recibido y comisiones.
9. Permitir valoraciones manuales, siempre identificadas como estimadas.
10. Monedas admitidas y monedas convertibles son estados distintos: una moneda puede utilizarse en cuentas y movimientos aunque no exista una fuente de conversión confiable.

## 3. Principios de integridad financiera

- Guardar siempre importe y moneda originales.
- Nunca reescribir movimientos históricos por cambios posteriores de cotización.
- Una variación cambiaria del patrimonio no es ingreso ni gasto.
- Las transferencias entre cuentas propias no son ingresos/gastos ordinarios; las comisiones sí pueden registrarse como gasto.
- Una fuente de respaldo solo puede reemplazar a otra si representa el mismo mercado, par, lado de cotización y contexto temporal compatible.
- No sumar directamente cantidades de monedas distintas.
- No utilizar valores aproximados o vencidos como si fueran cotizaciones confirmadas.
- Las valoraciones manuales no se convierten en cotizaciones oficiales ni en movimientos.
- Mantener separados valor automático, valor manual estimado y valor pendiente.
- Usar aritmética decimal exacta o enteros en unidades menores; evitar errores de punto flotante.
- Respetar los dígitos fraccionarios definidos para cada moneda, no asumir dos decimales para todas.

## 4. Modelo de dominio propuesto

### Currency Catalog
Catálogo versionado de monedas ISO 4217: código, nombre, símbolo, dígitos fraccionarios, estado (activa/retirada) y metadatos de vigencia. La región no limita el catálogo.

### User Currency Preferences
Preferencias por usuario: moneda principal, país/mercado de referencia y configuración avanzada de fuentes. La moneda principal es una preferencia de presentación y valoración, no cambia la moneda de las cuentas.

### Exchange Rate Sources
Registro de proveedores y fuentes aprobadas: país, mercado, par, tipo de cotización, proveedor, URL/documentación, prioridad, estado, última comprobación y reglas de frescura.

### Exchange Rates
Cotizaciones observadas con par base/destino, compra/venta o tipo aplicable, fuente, mercado, timestamp efectivo, timestamp de consulta, estado de validación y metadatos. Las cotizaciones son inmutables como observaciones históricas; una nueva consulta crea una observación nueva.

### Valuations
Valoraciones de saldos en la moneda principal: importe original, moneda original, importe valorado, moneda destino, cotización/observación utilizada, fuente, fecha de valoración, tipo (automática/manual), estado y autor. Una valoración manual requiere tipo de cambio, fecha de referencia y etiqueta estimada.

### Conversion / Transfer Operation
Operación que vincula importe enviado, importe recibido, monedas de origen/destino, cuentas, tipo de cambio efectivo, comisión y moneda de comisión, fecha y referencia. Evitar descontar dos veces comisiones incluidas en el importe enviado.

### Historical Movement Valuation
Instantánea de equivalencia histórica asociada al movimiento: importe y moneda originales, importe y moneda de valoración, cotización y fuente, fecha efectiva y precisión aplicada. No se recalcula retroactivamente.

## 5. Reglas de cálculo

### Patrimonio actual
1. Obtener saldos originales por cuenta y moneda.
2. Mantener saldos en su moneda original.
3. Valorar cada saldo en la moneda principal con una cotización válida y compatible.
4. Si no hay cotización, mantener la cuenta visible y marcarla como pendiente.
5. Mostrar por separado total convertido automáticamente, total estimado manualmente y cuentas pendientes.
6. No etiquetar un total parcial como patrimonio completo.

### Movimientos históricos
Al registrar un movimiento multidivisa, guardar la equivalencia calculada con la cotización y fuente disponibles en ese momento. Si no existe una cotización confiable, no inventar una equivalencia histórica; permitir guardar el movimiento original y marcar su valoración como pendiente o solicitar una valoración manual explícita.

### Conversión entre pares sin cotización directa
Se permite una moneda intermedia solo si ambas cotizaciones son confiables, compatibles en fecha, mercado y metodología. Si no se puede demostrar compatibilidad, bloquear la conversión automática.

### Cambio de moneda principal
Recalcular la presentación del patrimonio con cotizaciones actuales. No modificar saldos, cuentas, movimientos ni equivalencias históricas.

### Precisión
Usar numeric/decimal exacto en persistencia y cálculos. Aplicar el redondeo según la moneda destino en el momento de presentar o liquidar una operación; conservar precisión suficiente y trazabilidad del cálculo.

## 6. Auditoría inicial del código en feature/mis-cuentas

### Implementado
- `financial_accounts` conserva moneda por cuenta.
- `movements` conserva importe y moneda, y puede vincularse a una cuenta.
- Existe validación SQL para impedir asociar movimientos a cuentas de otro usuario o de moneda distinta.
- El borrado de cuenta deja `account_id` en NULL para preservar movimientos históricos.
- Existe conversor con ARS, USD y EUR y fuentes de dólar oficial, MEP, blue y euro oficial.
- La API de cotizaciones ya distingue última modificación y última confirmación, y aplica estado de frescura/mercado cerrado para el euro.

### Limitaciones detectadas
- La migración versionada `202611180001_create_financial_accounts.sql` limita `financial_accounts.currency` a ARS, USD y EUR.
- Los selectores de monedas de cuentas, movimientos rápidos y onboarding están limitados a ARS, USD y EUR.
- El onboarding guarda `financial_profiles.currency` junto con el ingreso habitual; por su uso actual representa la moneda del ingreso declarado, no una preferencia separada y bien definida de moneda principal.
- El dashboard permite elegir una moneda entre las monedas presentes en movimientos, pero el selector es estado local y no realiza conversión ni persiste una moneda principal global.
- El perfil también filtra movimientos por moneda; no calcula patrimonio multidivisa.
- Los totales de Mis cuentas se muestran separados por moneda y explícitamente no se convierten.
- El conversor es una herramienta aislada: no hay evidencia en el código revisado de un motor compartido de cotizaciones/valoraciones para el balance.
- No se encontraron en el repositorio migraciones versionadas para el esquema base de `financial_profiles` y `movements`; su estructura real debe verificarse en Supabase antes de diseñar cambios SQL.

## 7. Riesgos y puntos a resolver antes de migrar

1. **Compatibilidad de datos existentes:** ampliar catálogo sin invalidar cuentas ni movimientos actuales.
2. **Semántica de `financial_profiles.currency`:** separar moneda del ingreso habitual y moneda principal; no reutilizar el campo ambiguo.
3. **Saldo inicial:** definir fecha y valoración de apertura para cuentas ya existentes, sin inventar historial.
4. **Movimientos existentes:** preservar sus importes/monedas; las equivalencias históricas antiguas no pueden reconstruirse si no se guardó la cotización.
5. **Transferencias:** definir cómo representar operaciones con dos patas y comisiones sin duplicar ingresos/gastos.
6. **Cotizaciones:** validar proveedores, pares, mercados, lados compra/venta, frescura y fallback antes de aprobarlos.
7. **Catálogo:** definir proceso de actualización y monedas retiradas, sin eliminar registros históricos.
8. **RLS y propiedad:** todas las tablas nuevas deben aislar datos por usuario y validar relaciones en servidor/base de datos.
9. **Pruebas:** cubrir decimales, redondeo, cotizaciones faltantes, cambio de moneda principal, mercado cerrado, transferencias, comisiones y aislamiento entre usuarios.

## 8. Plan de implementación por etapas

- Fase 0 — Confirmar esquema real de Supabase y respaldar/inspeccionar datos existentes.
- Fase 1 — Catálogo ISO y preferencias monetarias separadas.
- Fase 2 — Capa de proveedores, fuentes recomendadas y almacenamiento de cotizaciones.
- Fase 3 — Motor decimal de conversión y valoración.
- Fase 4 — Valoración histórica de movimientos y saldos de apertura.
- Fase 5 — Operaciones de conversión/transferencia con comisiones.
- Fase 6 — Balance multidivisa y estados de valoración incompleta.
- Fase 7 — Integración de estadísticas, perfil y VERA.
- Fase 8 — Auditoría de seguridad, pruebas y despliegue gradual en Preview.

## 9. Alcance de esta auditoría

Esta revisión es estática sobre el código y las migraciones versionadas de la rama `feature/mis-cuentas`. No se consultó directamente el esquema vivo de Supabase ni se ejecutaron consultas sobre datos de usuarios. Por tanto, no se afirma que el único esquema existente en la base sea el que aparece en el repositorio. Antes de cualquier migración se debe verificar el esquema real desde Supabase.

## 10. Restricciones de despliegue

- Trabajar solo en `feature/mis-cuentas`.
- No modificar Producción.
- No ejecutar migraciones hasta aprobar el diseño y verificar el esquema real.
- No sobrescribir archivos sin volver a leer su contenido y SHA actuales.
- No fusionar la rama ni desplegar a Producción sin autorización explícita.
