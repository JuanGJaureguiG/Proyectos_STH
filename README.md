# Tablero de Proyectos · UNIMINUTO Sede Tolima-Huila

Tablero de control de los proyectos con financiación externa (contratos y convenios) de la Sede Tolima-Huila, vigencias 2021–2026.

**Pestañas:** Resumen · Financiadores · Ejecución y avance · Portafolio de proyectos · Nota metodológica
**Filtros:** Vigencia, Categoría, Origen de los recursos, Tipo de entidad, Entidad financiadora, Instrumento y Estado.

## Archivos
| Archivo | Uso |
|---|---|
| `index.html` | Estructura del tablero |
| `styles.css` | Estilos (mismo sistema visual de los tableros STH) |
| `app.js` | Lógica, filtros y gráficos (Chart.js 4.4.1) |
| `data.json` | Datos agregados de los proyectos (sin datos personales) |
| `build_data.py` | Regenera `data.json` desde el Excel |

## Actualizar los datos
```bash
pip install pandas openpyxl
python build_data.py "Datos Proyectos 6-10-2026.xlsx" 2026-10-06
```
El segundo argumento es la fecha de corte (define qué proyectos quedan como *Pendiente de cierre*).
Luego sube el nuevo `data.json` al repositorio con **Add file → Upload files** (reemplaza el anterior).
