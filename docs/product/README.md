# FINANCE.TRACK — Índice de decisiones y especificaciones

Este índice reúne la documentación funcional y comercial de FINANCE.TRACK / VERA. Los documentos describen objetivos y decisiones de diseño; no significan que todas las funciones estén implementadas.

## Producto y planes
- [FINANCE PLUS — plan e implementación](../finance-plus-product-plan.md)
- [Matriz FINANCE FREE vs. FINANCE PLUS](./free-vs-plus-matrix.md)
- [VERA: Modo Ahorro](./modo-ahorro-spec.md)
- [FINANCE: ALGORITMO](./finance-algorithm-spec.md)

## Experiencia y crecimiento
- [Registro y PERFIL FINANCE obligatorio y guiado](../onboarding-and-legal-flow.md)
- [Adquisición, marketing, personalización y notificaciones](../marketing/plus-acquisition-and-personalization.md)

## Legal y privacidad — borradores
- [Términos y condiciones](../legal/terms-and-conditions-draft.md)
- [Política de privacidad](../legal/privacy-policy-draft.md)
- [Lista de revisión legal antes del lanzamiento](../legal/launch-legal-review-checklist.md)

## Reglas de trabajo y lanzamiento
- Rama de trabajo: `feature/finance-plus-unification`.
- No hacer merge a `main` ni deploy sin autorización explícita.
- No modificar producción como parte de estas tareas de documentación.
- Antes de lanzar: revisar build, pruebas, RLS, aislamiento de usuarios, entitlements server-side, migraciones, legal, proveedores, costes y checkout.
- Confirmar que cada función descrita como disponible esté realmente implementada y probada.
