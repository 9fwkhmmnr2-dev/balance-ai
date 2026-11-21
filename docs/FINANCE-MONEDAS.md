# FINANCE:MONEDAS — Especificación técnica y auditoría inicial

Estado: especificación aprobada conceptualmente; esquema real de tablas base confirmado.
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

## 7. Esquema real de Supabase confirmado

El usuario ejecutó una consulta de solo lectura a `information_schema.columns` en el esquema `public`. Se confirmó la existencia y las columnas de estas tablas:

### `financial_accounts` — 9 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `name text NOT NULL`
- `type text NOT NULL`
- `currency text NOT NULL`
- `initial_balance numeric(14,2) NOT NULL`
- `is_archived boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `financial_profiles` — 10 columnas
- `user_id uuid NOT NULL`
- `pay_frequency text NOT NULL`
- `typical_income numeric(14,2) NULL`
- `currency text NOT NULL`
- `next_pay_date date NULL`
- `income_sources ARRAY NOT NULL`
- `expense_categories ARRAY NOT NULL`
- `onboarding_completed boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `movements` — 10 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `description text NOT NULL`
- `amount numeric(14,2) NOT NULL`
- `currency text NOT NULL`
- `category text NOT NULL`
- `movement_date date NOT NULL`
- `created_at timestamptz NOT NULL`
- `account_id uuid NULL`
- `type text NOT NULL`

Total confirmado: 29 columnas.


### Auditoría estructural y de seguridad confirmada

El usuario proporcionó resultados de consultas de solo lectura sobre las tres tablas. Los siguientes datos quedan confirmados para el esquema `public`.

#### Índices — 6

Se identificaron estos índices (las definiciones completas no fueron visibles en el resultado recibido, por lo que aquí se registra únicamente el nombre):

- `financial_accounts_pkey`
- `financial_accounts_user_id_idx`
- `financial_profiles_pkey`
- `movements_account_id_idx`
- `movements_user_date_idx`
- `movements_pkey`

#### RLS

RLS está habilitado en las tres tablas y no está forzado:

| Tabla | RLS enabled | RLS forced |
|---|---:|---:|
| `financial_accounts` | true | false |
| `financial_profiles` | true | false |
| `movements` | true | false |

#### Políticas — 11

Todas las políticas recibidas son PERMISSIVE.

| Tabla | Política | Rol | Comando | Condición confirmada |
|---|---|---|---|---|
| `financial_accounts` | Users can create their own financial accounts | public | INSERT | WITH CHECK: `auth.uid() = user_id` |
| `financial_accounts` | Users can delete their own financial accounts | public | DELETE | USING: `auth.uid() = user_id` |
| `financial_accounts` | Users can update their own financial accounts | public | UPDATE | USING y WITH CHECK: `auth.uid() = user_id` |
| `financial_accounts` | Users can view their own financial accounts | public | SELECT | USING: `auth.uid() = user_id` |
| `financial_profiles` | Users can insert own financial profile | authenticated | INSERT | WITH CHECK: `auth.uid() = user_id` |
| `financial_profiles` | Users can update own financial profile | authenticated | UPDATE | USING y WITH CHECK: `auth.uid() = user_id` |
| `financial_profiles` | Users can view own financial profile | authenticated | SELECT | USING: `auth.uid() = user_id` |
| `movements` | Users can delete own movements | authenticated | DELETE | USING: `auth.uid() = user_id` |
| `movements` | Users can insert own movements | authenticated | INSERT | WITH CHECK: `auth.uid() = user_id` |
| `movements` | Users can update own movements | authenticated | UPDATE | USING y WITH CHECK: `auth.uid() = user_id` |
| `movements` | Users can view own movements | authenticated | SELECT | USING: `auth.uid() = user_id` |

Nota de auditoría: las políticas de `financial_accounts` están asignadas al rol `public`, mientras que las de perfiles y movimientos están asignadas a `authenticated`. No se modifica esta configuración en esta fase. Conviene evaluar el principio de mínimo privilegio antes de cualquier cambio.

#### Restricciones y claves — 16

**`financial_accounts`**
- `financial_accounts_currency_check`: limita actualmente `currency` a `ARS`, `USD` y `EUR`.
- `financial_accounts_name_check`: exige que el nombre, luego de TRIM, tenga al menos un carácter. La definición completa recibida estaba cortada; no se documentan aquí condiciones adicionales.
- `financial_accounts_type_check`: limita `type` a una lista de valores. La lista completa recibida estaba cortada y queda pendiente de recuperar.
- `financial_accounts_user_id_fkey`: `user_id` referencia `auth.users(id)` con `ON DELETE CASCADE`.
- `financial_accounts_pkey`: clave primaria `(id)`.

**`financial_profiles`**
- `financial_profiles_currency_check`: exige que `currency` cumpla la expresión `^[A-Z]{3}# FINANCE:MONEDAS — Especificación técnica y auditoría inicial

Estado: especificación aprobada conceptualmente; esquema real de tablas base confirmado.
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

## 7. Esquema real de Supabase confirmado

El usuario ejecutó una consulta de solo lectura a `information_schema.columns` en el esquema `public`. Se confirmó la existencia y las columnas de estas tablas:

### `financial_accounts` — 9 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `name text NOT NULL`
- `type text NOT NULL`
- `currency text NOT NULL`
- `initial_balance numeric(14,2) NOT NULL`
- `is_archived boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `financial_profiles` — 10 columnas
- `user_id uuid NOT NULL`
- `pay_frequency text NOT NULL`
- `typical_income numeric(14,2) NULL`
- `currency text NOT NULL`
- `next_pay_date date NULL`
- `income_sources ARRAY NOT NULL`
- `expense_categories ARRAY NOT NULL`
- `onboarding_completed boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `movements` — 10 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `description text NOT NULL`
- `amount numeric(14,2) NOT NULL`
- `currency text NOT NULL`
- `category text NOT NULL`
- `movement_date date NOT NULL`
- `created_at timestamptz NOT NULL`
- `account_id uuid NULL`
- `type text NOT NULL`

.
- `financial_profiles_pay_frequency_check`: limita `pay_frequency` a una lista de valores. La lista completa recibida estaba cortada y queda pendiente de recuperar.
- `financial_profiles_typical_income_check`: permite NULL o valores mayores o iguales a cero.
- `financial_profiles_user_id_fkey`: `user_id` referencia `auth.users(id)` con `ON DELETE CASCADE`.
- `financial_profiles_pkey`: clave primaria `(user_id)`.

**`movements`**
- `movements_amount_check`: exige `amount > 0`.
- `movements_currency_check`: exige que `currency` cumpla la expresión `^[A-Z]{3}# FINANCE:MONEDAS — Especificación técnica y auditoría inicial

Estado: especificación aprobada conceptualmente; esquema real de tablas base confirmado.
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

## 7. Esquema real de Supabase confirmado

El usuario ejecutó una consulta de solo lectura a `information_schema.columns` en el esquema `public`. Se confirmó la existencia y las columnas de estas tablas:

### `financial_accounts` — 9 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `name text NOT NULL`
- `type text NOT NULL`
- `currency text NOT NULL`
- `initial_balance numeric(14,2) NOT NULL`
- `is_archived boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `financial_profiles` — 10 columnas
- `user_id uuid NOT NULL`
- `pay_frequency text NOT NULL`
- `typical_income numeric(14,2) NULL`
- `currency text NOT NULL`
- `next_pay_date date NULL`
- `income_sources ARRAY NOT NULL`
- `expense_categories ARRAY NOT NULL`
- `onboarding_completed boolean NOT NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

### `movements` — 10 columnas
- `id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `description text NOT NULL`
- `amount numeric(14,2) NOT NULL`
- `currency text NOT NULL`
- `category text NOT NULL`
- `movement_date date NOT NULL`
- `created_at timestamptz NOT NULL`
- `account_id uuid NULL`
- `type text NOT NULL`

.
- `movements_type_check`: limita `type` a `income` y `expense`.
- `movements_account_id_fkey`: `account_id` referencia `financial_accounts(id)` con `ON DELETE SET NULL`.
- `movements_user_id_fkey`: `user_id` referencia `auth.users(id)` con `ON DELETE CASCADE`.
- `movements_pkey`: clave primaria `(id)`.

#### Trigger y función de validación

Se confirmó un trigger en `public.movements`:

- Nombre: `movements_validate_account_owner`.
- Función: `public.validate_movement_account_owner()`.
- El detalle completo de la definición DDL del trigger (eventos y momento exacto) no quedó visible en la salida recibida.
- El cuerpo completo de la función sí fue recuperado:

```sql
begin
  if new.account_id is not null and not exists (
    select 1
    from public.financial_accounts a
    where a.id = new.account_id
    and a.user_id = new.user_id
    and a.currency = new.currency
  ) then
    raise exception 'La cuenta seleccionada no pertenece al usuario o usa otra moneda'
    using errcode = '23514';
  end if;
  return new;
end;
```

Por lo tanto, cuando el movimiento tiene `account_id`, la función exige que exista una cuenta con ese ID, perteneciente al mismo `user_id` y con la misma moneda. Si no se cumple, rechaza la operación con SQLSTATE `23514`. Si `account_id` es NULL, esta validación no busca una cuenta.

#### Distribución de monedas en los datos existentes

Consulta agrupada por tabla y moneda; el resultado completo recibido tuvo cuatro filas:

| Tabla | Moneda | Registros |
|---|---|---:|
| `financial_accounts` | ARS | 1 |
| `financial_accounts` | EUR | 1 |
| `financial_profiles` | ARS | 2 |
| `movements` | ARS | 8 |

Total observado: 12 registros distribuidos en esas cuatro combinaciones. No se observaron otros códigos de moneda en el resultado. La cuenta EUR existente debe preservarse en cualquier futura migración.

#### Consecuencias confirmadas para FINANCE:MONEDAS

- La restricción `financial_accounts_currency_check` es el bloqueo actual que impide guardar en cuentas monedas distintas de ARS, USD y EUR.
- Los CHECK de `financial_profiles.currency` y `movements.currency` solo validan el formato de tres letras mayúsculas; no garantizan que el código exista en ISO 4217.
- La función del trigger también exige igualdad exacta entre `financial_accounts.currency` y `movements.currency` cuando un movimiento está vinculado a una cuenta.
- La FK `movements_account_id_fkey` preserva movimientos al eliminar una cuenta, dejando `account_id` en NULL.
- Las tres columnas monetarias de importes confirmadas previamente siguen siendo `numeric(14,2)`; la compatibilidad con monedas de 0 o 3 dígitos fraccionarios requiere diseño antes de cambiar tipos o validaciones.
- No se deben alterar ni reescribir los 12 registros existentes como parte de la ampliación del catálogo.

### Consecuencias técnicas
- Las tres tablas base ya existen: no hay que recrearlas.
- `financial_profiles.currency` debe conservar su significado actual para el ingreso habitual; la moneda principal necesita un campo separado o una tabla de preferencias.
- `financial_accounts.currency` y `movements.currency` son campos de texto no restringidos por el tipo de columna; no obstante, la migración versionada agrega un CHECK en cuentas que actualmente limita los valores a ARS/USD/EUR. Hay que ampliar esa restricción de forma segura.
- `initial_balance`, `typical_income` y `movements.amount` tienen escala 2. No se debe cambiar su precisión todavía: primero hay que definir si se admitirá registrar monedas ISO con 0 o 3 decimales y diseñar una migración compatible con los datos existentes.
- Las columnas, índices (por nombre), restricciones, claves foráneas, estado RLS, políticas, trigger y distribución de monedas descritos en la sección de auditoría estructural ya fueron inspeccionados mediante consultas de solo lectura. Las definiciones completas de algunos CHECK, las definiciones completas de índices y el DDL completo del trigger no quedaron visibles en los resultados recibidos.

## 7.1 Auditoría de importes y monedas en TypeScript

Revisión de solo lectura de los archivos de la rama `feature/mis-cuentas`:

### Parser compartido

Archivo: `lib/parse-localized-amount.ts`

- `parseLocalizedAmount(raw)` devuelve `number | null`, no una cadena decimal.
- Interpreta formatos habituales de Argentina, como `160.000`, `160.000,50` y `160,50`.
- No recibe un código de moneda y no valida cuántos dígitos fraccionarios permite la moneda.
- Por lo tanto, no distingue entre monedas de 0, 2 o 3 dígitos fraccionarios ni garantiza aritmética decimal exacta después de convertir a `number`.

### Cuentas

Archivo: `components/accounts-view.tsx`

- El tipo TypeScript `Currency` está limitado a `"ARS" | "USD" | "EUR"`.
- El selector de moneda ofrece únicamente ARS, USD y EUR.
- El saldo inicial se procesa mediante `parseLocalizedAmount` y se envía como número.
- Los saldos se reconstruyen y suman mediante operaciones de JavaScript `number`.
- El formateador de cuentas configura `maximumFractionDigits: 2`.

### Movimientos

Archivos: `components/quick-movement.tsx` y `components/movements-manager.tsx`

- Ambos formularios usan `parseLocalizedAmount` y envían el importe como número.
- Los selectores de moneda están limitados a ARS, USD y EUR.
- El movimiento rápido filtra las cuentas disponibles para exigir coincidencia entre la moneda elegida y la cuenta.
- La función SQL del trigger vuelve a verificar esa coincidencia y la pertenencia de la cuenta al usuario.
- El formateo de movimientos usa `Intl.NumberFormat` con el código de moneda.

### Perfil / onboarding

Archivo: `components/onboarding-gate.tsx`

- El importe de ingreso habitual se procesa con el mismo parser y se guarda como número en `typical_income`.
- El selector de moneda del ingreso ofrece ARS, USD y EUR.
- El campo `financial_profiles.currency` sigue representando la moneda del ingreso habitual en este flujo; no es una preferencia global de moneda principal.

### Dashboard

Archivo: `components/dashboard-stats.tsx`

- La moneda preferida inicial se lee de `financial_profiles.currency`.
- El selector local se construye con esa moneda y las monedas presentes en los movimientos.
- Las estadísticas filtran movimientos por moneda; no convierten importes entre monedas.
- Los importes se suman usando JavaScript `number`.
- El formateador principal del dashboard fija `maximumFractionDigits: 0`, por lo que la vista de resumen no muestra fracciones aunque el movimiento original las tenga.

### Conclusión técnica

La expansión multidivisa no debe limitarse a agregar códigos a los selectores ni a quitar el CHECK de cuentas. Antes hay que definir y probar:

1. Una representación decimal exacta de importes en el límite de entrada, cálculos y persistencia; evitar conversiones prematuras a JavaScript `number`.
2. Una regla de precisión por moneda basada en el catálogo ISO 4217.
3. Validación de fracciones permitidas para cada moneda en los formularios y en el servidor/base de datos.
4. Formateo por moneda en cuentas, movimientos, perfil y dashboard, sin truncar fracciones válidas.
5. Una estrategia de migración compatible con los campos actuales `numeric(14,2)`.

No se modificó ninguno de estos archivos durante la auditoría.

## 8. Riesgos y puntos a resolver antes de migrar

1. **Compatibilidad de datos existentes:** ampliar catálogo sin invalidar cuentas ni movimientos actuales.
2. **Semántica de `financial_profiles.currency`:** separar moneda del ingreso habitual y moneda principal; no reutilizar el campo ambiguo.
3. **Precisión monetaria:** definir estrategia compatible para monedas con 0, 2 o 3 decimales antes de alterar numeric(14,2).
4. **Saldo inicial:** definir fecha y valoración de apertura para cuentas ya existentes, sin inventar historial.
5. **Movimientos existentes:** preservar sus importes/monedas; las equivalencias históricas antiguas no pueden reconstruirse si no se guardó la cotización.
6. **Transferencias:** definir cómo representar operaciones con dos patas y comisiones sin duplicar ingresos/gastos.
7. **Cotizaciones:** validar proveedores, pares, mercados, lados compra/venta, frescura y fallback antes de aprobarlos.
8. **Catálogo:** definir proceso de actualización y monedas retiradas, sin eliminar registros históricos.
9. **RLS y propiedad:** todas las tablas nuevas deben aislar datos por usuario y validar relaciones en servidor/base de datos.
10. **Pruebas:** cubrir decimales, redondeo, cotizaciones faltantes, cambio de moneda principal, mercado cerrado, transferencias, comisiones y aislamiento entre usuarios.

## 9. Próximo paso de auditoría

La inspección estructural y de seguridad de las tres tablas base está completada con los resultados documentados en la sección 7. Antes de proponer migraciones todavía queda:
1. Recuperar, si hace falta para modificar restricciones, las definiciones completas de `financial_accounts_name_check`, `financial_accounts_type_check` y `financial_profiles_pay_frequency_check`, que llegaron cortadas.
2. Revisar las validaciones y precisión monetaria de la capa TypeScript.
3. Revisar los defaults de las columnas y las definiciones completas de índices/DDL del trigger si una futura modificación depende de esos detalles.
4. Diseñar y revisar el catálogo ISO 4217 y la estrategia de precisión decimal.

No se ejecutaron migraciones ni se modificaron datos.

## 10. Plan de implementación por etapas

- Fase 0 — Confirmar esquema real de Supabase, constraints, seguridad y datos existentes.
- Fase 1 — Catálogo ISO y preferencias monetarias separadas.
- Fase 2 — Capa de proveedores, fuentes recomendadas y almacenamiento de cotizaciones.
- Fase 3 — Motor decimal de conversión y valoración.
- Fase 4 — Valoración histórica de movimientos y saldos de apertura.
- Fase 5 — Operaciones de conversión/transferencia con comisiones.
- Fase 6 — Balance multidivisa y estados de valoración incompleta.
- Fase 7 — Integración de estadísticas, perfil y VERA.
- Fase 8 — Auditoría de seguridad, pruebas y despliegue gradual en Preview.

## 11. Restricciones de despliegue

- Trabajar solo en `feature/mis-cuentas`.
- No modificar Producción.
- No ejecutar migraciones hasta aprobar el diseño y verificar constraints, RLS y datos existentes.
- No sobrescribir archivos sin volver a leer su contenido y SHA actuales.
- No fusionar la rama ni desplegar a Producción sin autorización explícita.

## 12. Contrato del motor decimal — diseño aprobado

Esta sección documenta las decisiones aprobadas durante el diseño. Su aprobación es conceptual: **no autoriza cambios de código, migraciones ni modificaciones de datos**.

### 12.1 Representación de importes

- En los límites de la aplicación, los importes monetarios se transportan como cadenas decimales, nunca como JavaScript `number`.
- La entrada localizada del usuario se interpreta y normaliza antes de validarse; por ejemplo, `"1.500,75"` puede normalizarse a `"1500.75"`.
- Los cálculos internos utilizan objetos `Decimal` de `decimal.js`.
- Los valores enviados a Supabase se serializan como cadenas decimales canónicas, con punto como separador decimal y sin separadores de miles.
- Las respuestas estructuradas de VERA que contengan importes deben conservar la representación decimal como texto.
- No se utiliza `Number()` para operaciones monetarias ni se convierte anticipadamente un importe decimal a punto flotante binario.
- No se redondean resultados intermedios sin una necesidad explícita definida por la operación.

### 12.2 Política de redondeo

Regla general aprobada: `ROUND_HALF_UP`.

- Sumas y restas conservan la precisión disponible y no redondean cada paso.
- Multiplicaciones y divisiones mantienen precisión interna durante el cálculo.
- Los importes ingresados se validan contra la cantidad de dígitos fraccionarios permitida por la moneda; el exceso se rechaza, no se corrige silenciosamente.
- Las conversiones se redondean al final según la precisión de la moneda destino.
- Las comisiones se validan y redondean según la precisión de su propia moneda.
- La presentación respeta los dígitos fraccionarios definidos para la moneda y la configuración regional.
- Redondear y truncar son operaciones distintas; el motor no debe truncar importes como sustituto del redondeo.

### 12.3 Validación y errores

El comportamiento aprobado es estricto y explícito:

- Texto vacío o inválido: rechazar la entrada.
- División por cero: devolver un error controlado y no producir un resultado financiero.
- Exceso de dígitos fraccionarios para la moneda: rechazar el importe.
- Desbordamiento o incumplimiento de límites numéricos: rechazar la operación antes de persistir.
- Los resultados negativos pueden existir en cálculos internos cuando el contexto lo permita.
- Los movimientos registrados mantienen importe positivo; el sentido se expresa mediante el tipo de movimiento existente.
- Un valor faltante o nulo nunca se convierte automáticamente en cero.
- Si falla un cálculo, no se persiste parcialmente la operación financiera.
- Los errores deben ser identificables mediante tipos/códigos estables para que cada interfaz pueda presentar mensajes comprensibles.

### 12.4 Catálogo y fuente de precisión monetaria

- La fuente de referencia aprobada para el catálogo es SIX Group, que publica información del estándar ISO 4217.
- El catálogo del producto será versionado y mantenible.
- El alcance funcional incluye monedas fiat activas; fondos, metales y códigos especiales deben permanecer clasificados por separado y no incorporarse automáticamente como monedas fiat.
- Cada entrada del catálogo debe identificar, como mínimo, código ISO, nombre, dígitos fraccionarios y estado/vigencia.
- Los códigos retirados deben conservarse para interpretar registros históricos, pero no ofrecerse como opciones nuevas.
- La cantidad de dígitos fraccionarios se determina por moneda; no se presupone que todas tengan dos.
- La disponibilidad de una moneda para mantener saldos es independiente de que exista una cotización confiable para convertirla.

### 12.5 Precisión propuesta para evaluación técnica

Los siguientes parámetros fueron aceptados como base de diseño para verificar, no como límites definitivos ya implementados:

- `decimal.js`: precisión de 40 dígitos significativos.
- Importes persistidos: evaluar `NUMERIC(24,8)`.
- Cotizaciones: evaluar hasta 12 dígitos decimales.
- La precisión de importes, cotizaciones y cálculos intermedios debe mantenerse separada.
- Antes de fijar los tipos SQL definitivos, verificar el catálogo completo, magnitudes máximas, compatibilidad con los datos existentes y reglas de redondeo.
- Los 40 dígitos de `decimal.js` representan precisión significativa, no 40 decimales fijos.
- `NUMERIC(24,8)`, si se adopta, permitiría hasta 16 dígitos enteros y 8 fraccionarios; debe comprobarse que sea suficiente para los casos admitidos.

### 12.6 Contrato de funciones propuesto

El motor será la única autoridad para operaciones monetarias. La API conceptual aprobada incluye:

- `parseMoney`: interpretar y normalizar una entrada decimal.
- `validateMoney`: validar formato, moneda, precisión permitida y límites.
- `addMoney` / `subtractMoney`: sumar y restar importes compatibles.
- `multiplyMoney` / `divideMoney`: operaciones matemáticas decimales con validación de dominio.
- `roundMoney`: aplicar la regla y escala de redondeo correspondiente.
- `formatMoney`: presentar un importe con la moneda y configuración regional correspondientes.
- `convertMoney`: convertir únicamente con cotizaciones confiables, compatibles y verificadas.

Contrato general:
- Entradas y salidas en los límites públicos: cadenas decimales canónicas y metadatos explícitos de moneda.
- Representación interna: `Decimal`.
- Errores: tipados y controlados; no devolver importes ficticios o valores por defecto ante errores.
- Ningún módulo, estadística ni respuesta de VERA puede realizar cálculos monetarios por fuera de este motor.
- Las operaciones deben declarar moneda de origen/destino cuando corresponda; nunca sumar directamente cantidades de monedas diferentes.

### 12.7 Pruebas obligatorias antes de considerar terminada la implementación

La implementación deberá superar pruebas automatizadas que cubran:

1. Monedas con 0, 2, 3 y 4 dígitos fraccionarios, incluyendo validación de precisión.
2. Sumas y restas con muchos dígitos decimales.
3. Multiplicaciones y divisiones, incluida división por cero.
4. Conversiones ARS → USD, USD → EUR y EUR → ARS con cotizaciones de prueba explícitas.
5. Importes grandes, límites de precisión y desbordamiento.
6. Casos de redondeo `ROUND_HALF_UP`, incluidos valores justo por debajo, en y por encima del punto medio.
7. Entradas vacías, inválidas, nulas y con separadores regionales.
8. Comisiones denominadas en monedas distintas y prevención de doble descuento.
9. Cotizaciones ausentes, vencidas o incompatibles, que deben impedir la conversión automática.
10. Fallos transaccionales: verificar que una operación fallida no deje persistencia parcial ni modifique saldos.

Las pruebas deben verificar tanto los resultados numéricos como la integridad de los datos y la ausencia de efectos secundarios indebidos.

### 12.8 Estado de implementación

Todo lo descrito en esta sección es un contrato de diseño aprobado. No implica que `decimal.js` esté instalado, que las funciones existan, que las columnas SQL hayan sido alteradas ni que las pruebas ya estén implementadas o ejecutadas. Esos trabajos requieren una autorización y planificación posteriores, dentro de `feature/mis-cuentas`, sin tocar Producción.
