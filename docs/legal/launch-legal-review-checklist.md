# FINANCE.TRACK — Lista de control legal y privacidad previa al lanzamiento

**Estado:** bloqueante. Todos los puntos deben revisarse antes de publicar o habilitar contratación.

## Responsable y operación
- [ ] Definir quién será el responsable legal del servicio y quién operará la plataforma.
- [ ] Completar nombre legal, CUIT cuando corresponda, domicilio y correo de contacto.
- [ ] Confirmar países de operación y legislación aplicable.
- [ ] Revisar términos, política, contratos de adhesión y textos comerciales con asesoramiento jurídico local.
- [ ] Definir canal de soporte, reclamos, ejercicio de derechos y baja de cuenta.

## Datos personales y seguridad
- [ ] Inventariar datos realmente recogidos por cada pantalla, endpoint, tabla, log y proveedor.
- [ ] Confirmar finalidades, bases legales y permisos requeridos por categoría de datos.
- [ ] Confirmar proveedores y subencargados activos, países de procesamiento, transferencias y retención.
- [ ] Definir plazos de conservación y borrado para cuentas, datos financieros, documentos, conversaciones, memorias y registros técnicos.
- [ ] Verificar aislamiento de usuarios, RLS, autorización server-side, secretos, copias de seguridad y respuesta a incidentes.
- [ ] Diseñar proceso de acceso, rectificación, actualización, supresión y revocación de permisos.

## Menores y VERA
- [ ] Revisar con asesoría local el acceso de menores a funciones básicas de organización financiera y la intervención de representantes legales cuando corresponda.
- [ ] Mantener VERA y toda función restringida a mayores de edad detrás de verificación efectiva y controles server-side.
- [ ] No utilizar la aceptación general de términos ni el consentimiento de IA como prueba de mayoría de edad.
- [ ] Verificar que el consentimiento de IA sea independiente, específico, no premarcado y revocable.
- [ ] Confirmar que los proveedores y planes utilizados permiten el tratamiento informado de datos financieros y documentos.

## Funciones, datos externos y publicidad
- [ ] Confirmar licencias y derechos comerciales para mostrar precios, mercados, tipos de cambio y promociones.
- [ ] Mostrar fuente, moneda, presentación, hora de consulta y vigencia.
- [ ] No presentar estimaciones como datos verificados ni prometer ahorros o resultados financieros.
- [ ] Confirmar que no se venden datos personales ni se comparten datos financieros con comercios para publicidad.
- [ ] Revisar cookies, analítica, notificaciones y tecnologías de seguimiento.

## Planes y pagos
- [ ] Validar precios, moneda, impuestos, comisiones, renovación, facturación, cancelación y reembolsos.
- [ ] Identificar al proveedor de pagos y al titular legal habilitado de la cuenta.
- [ ] Confirmar que la contratación y los cobros cumplen requisitos de edad, identidad y capacidad.
- [ ] Mantener checkout deshabilitado hasta completar esta revisión.

## Coherencia técnica pendiente detectada
- [ ] Auditar el flujo de registro y confirmación de correo: el callback espera una fecha de nacimiento en metadatos, pero el formulario de registro actual no la solicita.
- [ ] Revisar la creación de `registration_acceptances`: el endpoint actual no inserta un registro inicial cuando no hay una aceptación previa y no se envía verificación de mayoría de edad.
- [ ] Auditar las políticas RLS y gates de VERA para asegurar que `age_eligible` no se trate como prueba de mayoría de edad cuando no hubo una verificación real.
- [ ] Corregir la redirección de cuentas con términos vencidos: el guard actual envía a `/perfil`; confirmar que exista una ruta clara de reaceptación.
- [ ] Mantener versiones de términos, privacidad y consentimiento IA sincronizadas entre frontend, endpoints, RLS y migraciones.
- [ ] No publicar ni desplegar hasta completar las verificaciones y probar los flujos con cuentas de prueba adecuadas.

**Nota:** esta lista no constituye una certificación de cumplimiento. La revisión debe contrastarse con la implementación y con la normativa vigente en cada jurisdicción.
