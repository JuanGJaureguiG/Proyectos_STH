"""
build_data.py — Tablero de Proyectos · UNIMINUTO Sede Tolima-Huila
Genera data.json a partir de la exportación "Datos Proyectos <fecha>.xlsx" (hoja PROYECTOS).

Uso:
    python build_data.py "Datos Proyectos 6-10-2026.xlsx" 2026-10-06

El segundo argumento (opcional) es la fecha de corte; si se omite se usa la fecha de hoy.
Solo se publican datos contractuales agregados de proyectos (sin datos personales).
"""
import json
import re
import sys
from datetime import date, datetime

import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else "Datos Proyectos 6-10-2026.xlsx"
CORTE = (datetime.strptime(sys.argv[2], "%Y-%m-%d").date()
         if len(sys.argv) > 2 else date.today())

TIPO_ENTIDAD = {
    "Gobernación del Tolima": "Departamental",
    "Alcaldía de Ibagué": "Municipal",
    "Alcaldía Honda Tolima": "Municipal",
    "Alcaldía de Dolores Tolima": "Municipal",
    "Alcaldía de Neiva": "Municipal",
    "Alcaldía de Pitalito": "Municipal",
    "Alcaldía de Puerto Boyacá": "Municipal",
    "Fuerza Aeroespacial Colombiana": "Nacional",
    "Ministerio de Defensa Nacional": "Nacional",
    "SENA": "Nacional",
    "Mansarovar Energy Ltd.": "Privada / gremial",
    "Cámara de comercio de Ibagué": "Privada / gremial",
    "FIDUPREVISORA": "Privada / gremial",
}


def clean(s):
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    s = str(s).replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip('"“” ')


def money(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d,.-]", "", str(v))
    s = s.replace(".", "").replace(",", ".")  # formato colombiano $ 1.234.567,00
    return float(s) if s else 0.0


def instrumento(nombre):
    n = nombre.lower()
    if "adici" in n:
        return "Adición contractual"
    if "convenio" in n or n.startswith("conv "):
        return "Convenio"
    if "interés público" in n or "interes publico" in n:
        return "Contrato de interés público"
    if "consultor" in n:
        return "Contrato de consultoría"
    if "orden de servicio" in n or "aceptación oferta" in n or "obras por impuestos" in n:
        return "Orden / aceptación de oferta"
    return "Contrato"


df = pd.read_excel(SRC, sheet_name=0)
df = df[df["Nombre Del Proyecto"].notna() & df["Presupuesto"].notna()].copy()

proyectos = []
for _, r in df.iterrows():
    nombre = clean(r["Nombre Del Proyecto"])
    pres = money(r["Presupuesto"])
    prop = money(r["Recursos Propios"])
    ext = money(r["Recursos Externos"])
    if abs(prop + ext - pres) > 1:  # se respeta el presupuesto como cifra de control
        ext = pres - prop
    ini = pd.to_datetime(r["Fecha Acta De Inicio"]).date()
    fin = pd.to_datetime(r["Fecha Finalización"]).date()
    av = float(r["% De Avance"]) if pd.notna(r["% De Avance"]) else 0.0
    if av >= 0.9999:
        estado = "Ejecutado"
    elif fin < CORTE:
        estado = "Pendiente de cierre"
    else:
        estado = "En ejecución"
    entidad = clean(r["Entidad Financiadora"])
    vig = int(str(r["Control"])[-4:]) if pd.notna(r["Control"]) else ini.year
    proyectos.append({
        "n": int(r["No."]),
        "nombre": nombre,
        "objetivo": clean(r["Objetivo"]),
        "cat": clean(r["Categoría"]),
        "vig": vig,
        "anioFin": int(r["Año Ejecución"]) if pd.notna(r["Año Ejecución"]) else fin.year,
        "ini": ini.isoformat(),
        "fin": fin.isoformat(),
        "dur": (fin - ini).days,
        "pres": round(pres),
        "prop": round(prop),
        "ext": round(ext),
        "entidad": entidad,
        "tipoEnt": TIPO_ENTIDAD.get(entidad, "Otra"),
        "rec": clean(r["Recursos"]),
        "inst": instrumento(nombre),
        "obs": clean(r["Observaciones"]),
        "av": round(av, 4),
        "estado": estado,
    })

out = {
    "corte": CORTE.isoformat(),
    "fuente": "Base de proyectos Sede Tolima-Huila (" + SRC.split("/")[-1] + ")",
    "proyectos": proyectos,
}
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

tot = sum(p["pres"] for p in proyectos)
print(f"{len(proyectos)} proyectos · presupuesto total ${tot:,.0f} · corte {CORTE}")
