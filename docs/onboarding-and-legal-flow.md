# FINANCE.TRACK — Registro, PERFIL FINANCE y descubrimiento de planes

**Estado:** especificación funcional aprobada a nivel de producto; pendiente de implementación y validación.  
**Rama de trabajo:** `feature/finance-plus-unification`  
**No autoriza despliegues ni cambios en producción.**

## 1. Recorrido de primera entrada

1. **Registro / inicio de sesión.** Crear cuenta y verificar el correo cuando corresponda.
2. **Aceptación legal.** Leer y aceptar los Términos y la Política de Privacidad vigentes. El permiso para procesar datos mediante IA es independiente, opcional y revocable.
3. **PERFIL FINANCE obligatorio y guiado.** Antes del primer acceso al Panel, la persona completa un recorrido corto con los datos esenciales.
4. **Análisis inicial de FINANCE: ALGORITMO.** Solo después de que el perfil esté completo y existan permisos suficientes, el algoritmo prepara una primera lectura. Debe identificar datos faltantes y no inventar ingresos, cuentas, gastos ni resultados.
5. **Mini tutorial.** Presentación interactiva, breve y omitible, con posibilidad de volver a verla.
6. **Panel de Control.** Acceso a los módulos disponibles según plan y permisos.

## 2. PERFIL FINANCE obligatorio y guiado

El PERFIL FINANCE funciona como un proceso integrado, no como una colección de formularios desconectados. Debe explicar cada paso, mostrar el progreso, permitir volver atrás y guardar el avance.

### Secciones iniciales
- **Datos regionales:** país de residencia, país de origen cuando sea pertinente, moneda predeterminada.
- **Situación de ingresos:** frecuencia, fuentes y monto habitual; permitir “no tengo ingresos actualmente”.
- **Gastos esenciales:** vivienda, alimentación, educación, transporte, salud, servicios y otros; permitir omitir categorías inexistentes.
- **Compromisos:** cuotas, deudas, préstamos, suscripciones y otros compromisos; permitir indicar que no existen.
- **Reserva protegida:** monto reservado o deseado, con posibilidad de indicar cero o dejarlo para completar luego cuando no sea esencial.
- **Objetivos y prioridades:** se pueden incorporar como configuración guiada o completar progresivamente, según el diseño final.
- **Preferencias de FINANCE: ALGORITMO:** autonomía equilibrada, aprendizaje adaptativo y prioridad combinada (beneficio económico, metas, intereses y contexto). Explicar controles de personalización.
- **VERA:** explicar su disponibilidad separada y requisitos de edad. No mezclar el acceso a finanzas personales con la elegibilidad de VERA.
- **Privacidad y permisos:** explicar datos usados, finalidades, proveedores y controles. El consentimiento de IA nunca debe venir premarcado ni ser condición para utilizar módulos que no lo necesitan.

### Reglas de finalización
- El perfil es obligatorio antes del primer Panel de Control.
- Se requieren los datos esenciales para completar la configuración, no todos los campos posibles.
- Si la persona no tiene ingresos, cuentas, deudas u otro dato, puede indicarlo explícitamente.
- No se exige crear movimientos, cuentas bancarias ni conectar servicios externos para completar el perfil.
- Se permite guardar y continuar después, pero no acceder al Panel hasta completar los requisitos esenciales.
- Las configuraciones avanzadas pueden completarse posteriormente desde PERFIL.
- No usar datos opcionales como si fueran datos confirmados.

## 3. Mini tutorial inicial

Se muestra después del análisis inicial y antes del primer ingreso al Panel. Debe ser breve, visual, accesible y omitible. El usuario podrá volver a abrirlo desde ayuda o configuración.

Contenido propuesto:
1. Inicio y lectura del Panel de Control.
2. Cómo registrar cuentas y movimientos.
3. Cómo usar presupuestos y objetivos.
4. Cómo entender las oportunidades de ahorro.
5. Qué hace FINANCE: ALGORITMO y cómo controlar sus recomendaciones.
6. Cómo acceder a VERA y qué permisos requiere.

## 4. Descubrimiento de FINANCE PLUS

- Debajo del menú principal habrá un CTA destacado en dorado: **“Descubrí FINANCE PLUS”**.
- Los módulos Plus podrán mostrarse a usuarios Free en modo de vista previa, sin ejecutar funciones bloqueadas ni fingir que están disponibles.
- Cada vista previa explicará qué resuelve la función, qué datos necesita y qué resultado ofrece.
- Los CTA de Plus llevarán a una única página de comparación Free vs. Plus, con una matriz clara y marcas de funciones incluidas.
- La comparación debe explicar límites, diferencias y condiciones; no utilizar botones que sugieran que una función ya está activa si no lo está.
- El descubrimiento no debe forzar la compra ni impedir que Free use sus funciones incluidas.

### Precio provisional a validar

- Mensual: **USD 6,99**.
- Anual: **USD 59,99**.
- El precio anual equivale a aproximadamente **28,5% menos** que doce pagos mensuales (USD 83,88). La comunicación correcta es “casi 30% de descuento”, no “30% exacto”.
- Estos valores son hipótesis de producto y no deben publicarse como oferta hasta validar costos, impuestos, comisiones, facturación, condiciones de renovación/cancelación, proveedor de pagos y requisitos legales.
- Checkout y contratos con proveedores de pago permanecen deshabilitados hasta completar la revisión correspondiente y contar con una persona o entidad legalmente habilitada como titular.

## 5. Principios de experiencia

- Explicar antes de pedir datos.
- No bloquear por falta de datos que la persona no posee.
- Guardar el progreso sin permitir saltarse los requisitos esenciales.
- Mantener separadas la aceptación legal, las preferencias y los consentimientos opcionales.
- Evitar presión comercial, mensajes alarmistas o patrones oscuros.
- Mostrar siempre qué funciones son actuales, cuáles son vistas previas y cuáles están en desarrollo.
- Permitir modificar preferencias, revisar permisos y consultar nuevamente el tutorial.

## 6. Criterios de aceptación funcional

- Una cuenta nueva no entra al Panel hasta completar PERFIL FINANCE esencial.
- El usuario puede indicar “sin ingresos”, “sin cuentas” y “sin deudas”.
- El proceso conserva el progreso y explica los campos pendientes.
- El mini tutorial se puede omitir y volver a abrir.
- El CTA “Descubrí FINANCE PLUS” aparece debajo del menú y conduce a la comparación única.
- Las vistas previas no exponen endpoints o datos Plus ni simulan resultados reales.
- Las recomendaciones de ALGORITMO distinguen datos confirmados, estimaciones y datos faltantes.
- Ninguna acción financiera se ejecuta sin confirmación explícita.
- No se inicia ningún deploy como parte de esta especificación.
