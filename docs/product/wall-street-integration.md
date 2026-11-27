# Wall Street — integración de datos de mercado

**Estado:** interfaz y contrato de proveedor definidos; proveedor/API comercial todavía no seleccionado ni habilitado.
**Primera entrega acordada:** cierres diarios, no cotizaciones en tiempo real.

## Alcance

- Índices iniciales: S&P 500, Nasdaq Composite y Dow Jones Industrial Average.
- Directorio de empresas, búsqueda y seguimiento/favoritos.
- Gráficos históricos diarios y alertas futuras sobre instrumentos seguidos.
- Mostrar símbolo, bolsa, moneda, último cierre, fecha/hora efectiva, fuente, frecuencia y antigüedad.
- Mantener el proveedor intercambiable mediante el contrato MarketDataProvider de lib/markets/provider.ts.

## Requisitos del proveedor

Antes de publicar cotizaciones, elegir un proveedor y confirmar por escrito que el plan contratado permite exhibición pública/externa dentro de FINANCE.TRACK, con el alcance geográfico y comercial previsto. Se evaluaron Twelve Data, Financial Modeling Prep y Alpha Vantage; sus niveles gratuitos no deben asumirse aptos para redistribución pública.

No publicar muestras como cotizaciones, completar cierres faltantes, presentar datos vencidos como actuales, ocultar demoras ni incorporar claves API al cliente o al repositorio.

## Configuración protegida

Variables de servidor previstas: MARKET_DATA_PROVIDER, MARKET_DATA_API_KEY y MARKET_DATA_PUBLIC_DISPLAY_LICENSE=true. La última solo debe habilitarse después de verificar la licencia. No hay claves API ni proveedor seleccionado en esta entrega; por lo tanto, Wall Street continúa sin cotizaciones y no inventa valores.

## Implementación por etapas

1. Seleccionar proveedor y confirmar derechos de exhibición pública.
2. Implementar su adaptador server-side para cierres diarios.
3. Validar símbolos, bolsas, monedas, cobertura y fechas reales.
4. Añadir caché, política de frescura y errores explícitos.
5. Conectar gráficos, búsqueda, favoritos y alertas a cotizaciones validadas.
6. Evaluar tiempo real solo si licencia y costes lo justifican.
