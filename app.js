/* =====================================================================
   Tablero de Proyectos · UNIMINUTO Sede Tolima-Huila
   Datos: data.json (generado con build_data.py desde la base de proyectos)
   ===================================================================== */

const COL = {
  sede: '#E2962B', teal: '#2F7A6D', nat: '#8A9BAE',
  ink: '#16324F', purple: '#8A5FBF', danger: '#C1432B',
  grid: '#EDEFEC', muted: '#6B7280'
};
const CAT_COLORS = {
  'Financiación Pública': COL.teal,
  'Financiación Privada': COL.sede,
  'Manejado Por Operación': COL.purple
};
const TIPO_COLORS = {
  'Departamental': COL.ink,
  'Municipal': COL.teal,
  'Nacional': COL.sede,
  'Privada / gremial': COL.purple
};
const REC_COLORS = { 'Públicos': COL.teal, 'Privados': COL.sede };
const EST_COLORS = {
  'Ejecutado': COL.teal,
  'En ejecución': COL.ink,
  'Pendiente de cierre': COL.sede
};
const EST_CLASS = { 'Ejecutado': 'ok', 'En ejecución': 'run', 'Pendiente de cierre': 'mid' };
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'financiadores', label: 'Financiadores' },
  { id: 'ejecucion', label: 'Ejecución y avance' },
  { id: 'portafolio', label: 'Portafolio de proyectos' },
  { id: 'metodologia', label: 'Nota metodológica' }
];

let DATA = null, ALL = [];
const STATE = { tab: 'resumen', search: '', sortKey: 'n', sortDir: 1, open: new Set() };
const SEL = {};          // dimensión -> Set de valores seleccionados
const DIMS = [];         // definición de filtros
const charts = {};

/* ---------------- Formato ---------------- */
const nf = (d = 0) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, d = 0) => nf(d).format(v || 0);
const fmtM = (v, d = 0) => '$' + fmt((v || 0) / 1e6, d) + ' M';
const fmtMM = v => '$' + fmt((v || 0) / 1e9, 1) + ' mil millones';
const fmtP = (v, d = 1) => fmt(v, d) + '%';
const fmtDate = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const sum = (arr, k) => arr.reduce((a, p) => a + (typeof k === 'function' ? k(p) : p[k]), 0);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const uniq = (arr) => [...new Set(arr)];

/* ---------------- Chart.js: defaults y plugins ---------------- */
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = COL.muted;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#16324F';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleFont = { family: "'Space Grotesk', sans-serif", weight: '600', size: 12 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 11.5 };
Chart.defaults.plugins.tooltip.cornerRadius = 3;
Chart.defaults.animation.duration = 350;

/* Etiquetas en línea (sin plugins externos) */
const InlineLabels = {
  id: 'inlineLabels',
  descriptors: { _scriptable: false, _indexable: false },
  afterDatasetsDraw(chart) {
    const o = chart.options.plugins.inlineLabels;
    if (!o || !o.enabled) return;
    const { ctx } = chart;
    const horiz = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.font = "600 10.5px 'Space Grotesk', sans-serif";
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || (o.datasets && !o.datasets.includes(di))) return;
      meta.data.forEach((el, i) => {
        const v = ds.data[i];
        if (v == null || v === 0) return;
        const txt = o.fmt ? o.fmt(v, i, di) : String(v);
        if (!txt) return;
        if (o.inside) {
          const w = horiz ? Math.abs(el.x - el.base) : Math.abs(el.base - el.y);
          if (w < ctx.measureText(txt).width + 8 || (!horiz && w < 16)) return;
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          horiz ? ctx.fillText(txt, (el.x + el.base) / 2, el.y) : ctx.fillText(txt, el.x, (el.y + el.base) / 2);
        } else {
          ctx.fillStyle = '#16324F';
          if (horiz) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x + 6, el.y); }
          else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - 5); }
        }
      });
    });
    ctx.restore();
  }
};
/* Totales sobre barras apiladas */
const StackTotals = {
  id: 'stackTotals',
  descriptors: { _scriptable: false, _indexable: false },
  afterDatasetsDraw(chart) {
    const o = chart.options.plugins.stackTotals;
    if (!o || !o.enabled) return;
    const { ctx } = chart;
    const horiz = chart.options.indexAxis === 'y';
    const n = chart.data.labels.length;
    ctx.save();
    ctx.font = "600 10.5px 'Space Grotesk', sans-serif";
    ctx.fillStyle = '#16324F';
    for (let i = 0; i < n; i++) {
      let tot = 0, edge = null;
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        tot += ds.data[i] || 0;
        const el = meta.data[i];
        if (!el) return;
        if (horiz) edge = edge == null ? el.x : Math.max(edge, el.x);
        else edge = edge == null ? el.y : Math.min(edge, el.y);
      });
      if (!tot || edge == null) continue;
      const el0 = chart.getDatasetMeta(0).data[i];
      const txt = o.fmt ? o.fmt(tot, i) : String(tot);
      if (horiz) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, edge + 6, el0.y); }
      else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el0.x, edge - 5); }
    }
    ctx.restore();
  }
};
/* Línea de fecha de corte (cronograma) */
const CutLine = {
  id: 'cutLine',
  descriptors: { _scriptable: false, _indexable: false },
  afterDatasetsDraw(chart) {
    const o = chart.options.plugins.cutLine;
    if (!o || o.value == null) return;
    const x = chart.scales.x.getPixelForValue(o.value);
    const { top, bottom } = chart.chartArea;
    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = COL.danger; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.danger; ctx.font = "600 10.5px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('Corte', x - 4, top + 2);
    ctx.restore();
  }
};
Chart.register(InlineLabels, StackTotals, CutLine);

const axisX = (extra = {}) => ({ grid: { display: false }, border: { color: '#D6DAD5' }, ticks: { color: COL.muted }, ...extra });
const axisY = (extra = {}) => ({ grid: { color: COL.grid }, border: { display: false }, ticks: { color: COL.muted }, beginAtZero: true, ...extra });

function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return null;
  charts[id] = new Chart(el, cfg);
  return charts[id];
}

/* ---------------- Filtros (sidebar) ---------------- */
function defineDims() {
  const years = uniq(ALL.map(p => p.vig)).sort();
  const countBy = k => ALL.reduce((m, p) => (m[p[k]] = (m[p[k]] || 0) + 1, m), {});
  const ordered = (k, pref) => {
    const c = countBy(k);
    const keys = Object.keys(c);
    return pref ? pref.filter(x => keys.includes(x)).concat(keys.filter(x => !pref.includes(x)))
                : keys.sort((a, b) => c[b] - c[a] || a.localeCompare(b));
  };
  DIMS.push(
    { key: 'vig', label: 'Vigencia', type: 'chips', values: years.map(String), open: true },
    { key: 'cat', label: 'Categoría', type: 'check', values: ordered('cat', Object.keys(CAT_COLORS)), colors: CAT_COLORS, open: true },
    { key: 'rec', label: 'Origen de los recursos', type: 'check', values: ordered('rec', ['Públicos', 'Privados']), colors: REC_COLORS, open: true },
    { key: 'tipoEnt', label: 'Tipo de entidad', type: 'check', values: ordered('tipoEnt', Object.keys(TIPO_COLORS)), colors: TIPO_COLORS, open: true },
    { key: 'entidad', label: 'Entidad financiadora', type: 'check', values: ordered('entidad'), open: false },
    { key: 'inst', label: 'Instrumento', type: 'check', values: ordered('inst'), open: false },
    { key: 'estado', label: 'Estado', type: 'check', values: ordered('estado', Object.keys(EST_COLORS)), colors: EST_COLORS, open: true }
  );
  DIMS.forEach(d => { d.counts = countBy(d.key); SEL[d.key] = new Set(d.values); });
}

function buildSidebar() {
  const host = document.getElementById('filters');
  host.innerHTML = '';
  DIMS.forEach(d => {
    const g = document.createElement('details');
    g.className = 'filter-group';
    if (d.open) g.open = true;
    const nSel = SEL[d.key].size, nAll = d.values.length;
    g.innerHTML = `<summary><span>${d.label}${nSel < nAll ? `<span class="count-badge">${nSel}/${nAll}</span>` : ''}</span><span class="chev">▶</span></summary>`;
    if (d.type === 'chips') {
      const list = document.createElement('div');
      list.className = 'chip-list';
      d.values.forEach(v => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (SEL[d.key].has(v) ? ' active' : '');
        b.textContent = v;
        b.setAttribute('aria-pressed', SEL[d.key].has(v));
        b.onclick = () => { toggle(d.key, v); };
        list.appendChild(b);
      });
      g.appendChild(list);
    } else {
      const list = document.createElement('div');
      list.className = 'check-list';
      d.values.forEach(v => {
        const lab = document.createElement('label');
        lab.className = 'check-row';
        const sw = d.colors ? `<span class="sw" style="background:${d.colors[v] || COL.nat}"></span>` : '';
        lab.innerHTML = `<input type="checkbox" ${SEL[d.key].has(v) ? 'checked' : ''}>${sw}<span>${esc(v)}</span><span class="n">${d.counts[v] || 0}</span>`;
        lab.querySelector('input').onchange = () => toggle(d.key, v);
        list.appendChild(lab);
      });
      g.appendChild(list);
    }
    const q = document.createElement('div');
    q.className = 'quick';
    q.innerHTML = `<button type="button">Todos</button><button type="button">Ninguno</button>`;
    const [bAll, bNone] = q.querySelectorAll('button');
    bAll.onclick = () => { SEL[d.key] = new Set(d.values); refresh(); };
    bNone.onclick = () => { SEL[d.key] = new Set(); refresh(); };
    g.appendChild(q);
    g.addEventListener('toggle', () => { d.open = g.open; });
    host.appendChild(g);
  });
}

function toggle(key, v) {
  SEL[key].has(v) ? SEL[key].delete(v) : SEL[key].add(v);
  refresh();
}

function filtered() {
  return ALL.filter(p => DIMS.every(d => SEL[d.key].has(String(p[d.key]))));
}

function filterSummary(rows) {
  const parts = DIMS.filter(d => SEL[d.key].size < d.values.length).map(d => {
    const s = [...SEL[d.key]];
    return `${d.label}: <b>${s.length ? (s.length <= 3 ? s.map(esc).join(', ') : s.length + ' seleccionados') : 'ninguno'}</b>`;
  });
  document.getElementById('filterSummary').innerHTML =
    `Mostrando <b>${rows.length}</b> de <b>${ALL.length}</b> proyectos` + (parts.length ? ' · ' + parts.join(' · ') : ' · sin filtros aplicados');
}

/* ---------------- Tabs ---------------- */
function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = TABS.map(t => `<button class="tab${t.id === STATE.tab ? ' active' : ''}" role="tab" data-tab="${t.id}">${t.label}</button>`).join('');
  nav.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    STATE.tab = b.dataset.tab;
    nav.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    render();
  });
}

/* ---------------- Agregaciones ---------------- */
function groupBy(rows, key) {
  const m = new Map();
  rows.forEach(p => {
    const k = typeof key === 'function' ? key(p) : p[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  });
  return m;
}
const YEARS = () => DIMS[0].values.filter(y => SEL.vig.has(y)).map(Number);

function kpiHTML(items) {
  return items.map(k => `<div class="kpi"><div class="label">${k.label}</div><div class="num">${k.num}</div><div class="delta">${k.delta || ''}</div></div>`).join('');
}

function emptyState(msg = 'No hay proyectos con los filtros seleccionados.') {
  return `<div class="empty-state">${msg}</div>`;
}

/* ================= VISTA: RESUMEN ================= */
function renderResumen(rows) {
  const pres = sum(rows, 'pres'), ext = sum(rows, 'ext'), prop = sum(rows, 'prop');
  const nProp = rows.filter(p => p.prop > 0).length;
  const nEj = rows.filter(p => p.estado === 'Ejecutado').length;
  document.getElementById('kpiResumen').innerHTML = kpiHTML([
    { label: 'Proyectos gestionados', num: fmt(rows.length), delta: `${fmt(nEj)} ejecutados · ${fmt(rows.length - nEj)} con avance < 100%` },
    { label: 'Presupuesto gestionado', num: fmtM(pres), delta: rows.length ? `≈ ${fmtMM(pres)} · ticket promedio ${fmtM(pres / rows.length)}` : '—' },
    { label: 'Recursos externos', num: fmtM(ext), delta: pres ? `<span class="up">${fmtP(ext / pres * 100)}</span> del presupuesto total` : '—' },
    { label: 'Contrapartida UNIMINUTO', num: fmtM(prop), delta: `${fmt(nProp)} proyectos con recursos propios${pres ? ' · ' + fmtP(prop / pres * 100) : ''}` }
  ]);

  const years = YEARS();
  const byY = groupBy(rows, 'vig');
  const ys = years.map(String);
  mkChart('chVigencia', {
    type: 'bar',
    data: {
      labels: ys,
      datasets: [
        { label: 'Recursos externos', data: years.map(y => sum(byY.get(y) || [], 'ext') / 1e6), backgroundColor: COL.sede, borderRadius: { topLeft: 0, topRight: 0 }, borderSkipped: false, maxBarThickness: 46, borderColor: '#fff', borderWidth: { top: 2 } },
        { label: 'Recursos propios', data: years.map(y => sum(byY.get(y) || [], 'prop') / 1e6), backgroundColor: COL.teal, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 46 }
      ]
    },
    options: {
      scales: { x: axisX({ stacked: true }), y: axisY({ stacked: true, grace: '10%', ticks: { callback: v => '$' + fmt(v) } }) },
      plugins: {
        stackTotals: { enabled: true, fmt: v => '$' + fmt(v) + ' M' },
        tooltip: { mode: 'index', callbacks: {
          label: c => ` ${c.dataset.label}: ${fmtM(c.raw * 1e6)}`,
          footer: items => 'Total: ' + fmtM(items.reduce((a, i) => a + i.raw, 0) * 1e6)
        } }
      }
    }
  });

  mkChart('chVigN', {
    type: 'bar',
    data: { labels: ys, datasets: [{ label: 'Proyectos', data: years.map(y => (byY.get(y) || []).length), backgroundColor: COL.ink, borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      scales: { x: axisX(), y: axisY({ grace: '12%', ticks: { precision: 0 } }) },
      plugins: {
        inlineLabels: { enabled: true, fmt: v => fmt(v) },
        tooltip: { callbacks: {
          label: c => {
            const g = byY.get(years[c.dataIndex]) || [];
            return [` ${fmt(c.raw)} proyectos`, ` Presupuesto: ${fmtM(sum(g, 'pres'))}`, ` Ticket promedio: ${g.length ? fmtM(sum(g, 'pres') / g.length) : '—'}`];
          }
        } }
      }
    }
  });

  const tipos = Object.keys(TIPO_COLORS).filter(t => rows.some(p => p.tipoEnt === t));
  const byT = groupBy(rows, 'tipoEnt');
  const tVals = tipos.map(t => sum(byT.get(t), 'pres') / 1e6);
  mkChart('chTipoEnt', {
    type: 'bar',
    data: { labels: tipos, datasets: [{ data: tVals, backgroundColor: tipos.map(t => TIPO_COLORS[t]), borderRadius: 4, borderSkipped: 'left', maxBarThickness: 34 }] },
    options: {
      indexAxis: 'y',
      layout: { padding: { right: 110 } },
      scales: { x: axisY({ ticks: { callback: v => '$' + fmt(v), maxRotation: 0 } }), y: axisX({ ticks: { color: '#16324F', font: { weight: '500' } } }) },
      plugins: {
        inlineLabels: { enabled: true, fmt: v => `$${fmt(v)} M · ${fmtP(v * 1e6 / pres * 100)}` },
        tooltip: { callbacks: { label: c => {
          const g = byT.get(tipos[c.dataIndex]);
          return [` ${fmtM(c.raw * 1e6)} (${fmtP(c.raw * 1e6 / pres * 100)})`, ` ${g.length} proyectos · ${uniq(g.map(p => p.entidad)).length} entidades`];
        } } }
      }
    }
  });

  const insts = [...groupBy(rows, 'inst').entries()].sort((a, b) => sum(b[1], 'pres') - sum(a[1], 'pres')).map(e => e[0]);
  const cats = Object.keys(CAT_COLORS).filter(c => rows.some(p => p.cat === c));
  mkChart('chInst', {
    type: 'bar',
    data: {
      labels: insts,
      datasets: cats.map((c, ci) => ({
        label: c,
        data: insts.map(i => sum(rows.filter(p => p.inst === i && p.cat === c), 'pres') / 1e6),
        backgroundColor: CAT_COLORS[c], borderColor: '#fff', borderWidth: { right: 2 }, borderSkipped: false,
        borderRadius: 0, maxBarThickness: 30
      }))
    },
    options: {
      indexAxis: 'y',
      layout: { padding: { right: 70 } },
      scales: { x: axisY({ stacked: true, ticks: { callback: v => '$' + fmt(v), maxRotation: 0, maxTicksLimit: 6 } }), y: axisX({ stacked: true, ticks: { color: '#16324F' } }) },
      plugins: {
        legend: { display: true, position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, color: COL.muted } },
        stackTotals: { enabled: true, fmt: v => '$' + fmt(v) + ' M' },
        tooltip: { callbacks: { label: c => c.raw ? ` ${c.dataset.label}: ${fmtM(c.raw * 1e6)} · ${rows.filter(p => p.inst === insts[c.dataIndex] && p.cat === c.dataset.label).length} proy.` : null } }
      }
    }
  });

  document.getElementById('insights').innerHTML = rows.length ? buildInsights(rows, years, byY, pres) : '<li>No hay proyectos con los filtros seleccionados.</li>';
}

function buildInsights(rows, years, byY, pres) {
  const out = [];
  const yTot = years.map(y => ({ y, v: sum(byY.get(y) || [], 'pres'), n: (byY.get(y) || []).length })).filter(o => o.n);
  if (yTot.length) {
    const best = [...yTot].sort((a, b) => b.v - a.v)[0];
    out.push(`La vigencia con mayor presupuesto gestionado es <b>${best.y}</b>, con <b>${fmtM(best.v)}</b> en ${best.n} proyectos (${fmtP(best.v / pres * 100)} del total filtrado).`);
  }
  const corteY = Number(DATA.corte.slice(0, 4));
  const prev = yTot.find(o => o.y === corteY - 1), prev2 = yTot.find(o => o.y === corteY - 2);
  if (prev && prev2) {
    const ch = (prev.v / prev2.v - 1) * 100;
    out.push(`Entre ${prev2.y} y ${prev.y} el presupuesto gestionado ${ch >= 0 ? 'creció' : 'cayó'} <b class="${ch >= 0 ? 'up' : 'down'}">${fmtP(Math.abs(ch))}</b> (${fmtM(prev2.v)} → ${fmtM(prev.v)}) y el número de proyectos pasó de ${prev2.n} a ${prev.n}.`);
  }
  const cur = yTot.find(o => o.y === corteY);
  if (cur) out.push(`En la vigencia <b>${corteY}</b> (corte ${fmtDate(DATA.corte)}) se registran <b>${cur.n} proyectos</b> por <b>${fmtM(cur.v)}</b>; la vigencia aún está en curso.`);
  const ents = [...groupBy(rows, 'entidad').entries()].map(([e, g]) => ({ e, v: sum(g, 'pres'), n: g.length })).sort((a, b) => b.v - a.v);
  if (ents.length) {
    const t = ents[0];
    out.push(`<b>${esc(t.e)}</b> es el principal financiador: ${t.n} proyectos y <b>${fmtM(t.v)}</b> (${fmtP(t.v / pres * 100)}).` +
      (ents.length > 1 ? ` Junto con ${esc(ents[1].e)} concentran el <b>${fmtP((t.v + ents[1].v) / pres * 100)}</b> de los recursos.` : ''));
  }
  const conv = rows.filter(p => p.prop > 0);
  if (conv.length) out.push(`En <b>${conv.length}</b> proyectos UNIMINUTO aporta contrapartida, por <b>${fmtM(sum(conv, 'prop'))}</b>; en promedio representa el ${fmtP(sum(conv, 'prop') / sum(conv, 'pres') * 100)} del valor de esos proyectos.`);
  const pend = rows.filter(p => p.estado === 'Pendiente de cierre');
  if (pend.length) out.push(`<b>${pend.length}</b> proyectos tienen la fecha de finalización cumplida y un avance reportado inferior al 100% (${fmtM(sum(pend, 'pres'))}); conviene revisar su cierre o actualizar el avance en la base.`);
  const big = [...rows].sort((a, b) => b.pres - a.pres)[0];
  out.push(`El proyecto de mayor valor es <b>${esc(big.nombre)}</b> (${esc(big.entidad)}, vigencia ${big.vig}) por <b>${fmtM(big.pres)}</b>.`);
  return out.map(s => `<li>${s}</li>`).join('');
}

/* ================= VISTA: FINANCIADORES ================= */
function renderFinanciadores(rows) {
  const pres = sum(rows, 'pres');
  const ents = [...groupBy(rows, 'entidad').entries()].map(([e, g]) => ({
    e, g, v: sum(g, 'pres'), ext: sum(g, 'ext'), prop: sum(g, 'prop'), n: g.length, tipo: g[0].tipoEnt,
    years: new Set(g.map(p => p.vig))
  })).sort((a, b) => b.v - a.v);

  const call = document.getElementById('concCallout');
  if (!ents.length) {
    call.innerHTML = 'No hay proyectos con los filtros seleccionados.';
  } else {
    const top2 = ents.slice(0, 2), s2 = sum(top2, 'v');
    const pubShare = sum(rows.filter(p => p.rec === 'Públicos'), 'pres') / pres * 100;
    call.innerHTML = `<b>${ents.length}</b> entidades financiadoras. ` +
      (ents.length > 1 ? `<b>${top2.map(t => esc(t.e)).join('</b> y <b>')}</b> concentran el <b>${fmtP(s2 / pres * 100)}</b> del presupuesto gestionado. ` : '') +
      `El <b>${fmtP(pubShare)}</b> de los recursos proviene de fuentes públicas.`;
  }

  document.getElementById('wrapEnt').style.height = Math.max(220, ents.length * 32 + 50) + 'px';
  mkChart('chEntidad', {
    type: 'bar',
    data: { labels: ents.map(t => t.e), datasets: [{ data: ents.map(t => t.v / 1e6), backgroundColor: ents.map(t => TIPO_COLORS[t.tipo]), borderRadius: 4, borderSkipped: 'left', maxBarThickness: 22 }] },
    options: {
      indexAxis: 'y',
      layout: { padding: { right: 120 } },
      scales: { x: axisY({ ticks: { callback: v => '$' + fmt(v), maxRotation: 0 } }), y: axisX({ ticks: { color: '#16324F', font: { size: 11.5 } } }) },
      plugins: {
        inlineLabels: { enabled: true, fmt: v => `$${fmt(v)} M · ${fmtP(v * 1e6 / pres * 100)}` },
        tooltip: { callbacks: { label: c => {
          const t = ents[c.dataIndex];
          return [` ${fmtM(t.v)} · ${t.n} proyectos`, ` Tipo: ${t.tipo}`, ` Ticket promedio: ${fmtM(t.v / t.n)}`];
        } } }
      }
    }
  });
  // leyenda de tipos en la parte superior del panel
  const panel = document.getElementById('wrapEnt').parentElement;
  let lg = panel.querySelector('.legend');
  if (!lg) { lg = document.createElement('div'); lg.className = 'legend'; panel.insertBefore(lg, document.getElementById('wrapEnt')); }
  lg.innerHTML = Object.entries(TIPO_COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('');

  const allYears = DIMS[0].values.map(Number);
  const tbl = document.getElementById('tblEntidad');
  if (!ents.length) { tbl.innerHTML = `<tr><td>${emptyState()}</td></tr>`; return; }
  const maxV = ents[0].v;
  tbl.innerHTML = `<thead><tr>
      <th>Entidad financiadora</th><th class="r">Proyectos</th><th class="r">Presupuesto</th><th class="r">Participación</th>
      <th class="r">Ticket promedio</th><th class="r">Contrapartida</th><th>Vigencias con proyectos</th></tr></thead>
    <tbody>${ents.map(t => `<tr>
      <td class="name">${esc(t.e)}<small>${t.tipo}</small></td>
      <td class="r cell-sc">${t.n}</td>
      <td class="r cell-sc">${fmtM(t.v)}</td>
      <td class="r"><div class="barcell"><span class="cell-sc">${fmtP(t.v / pres * 100)}</span><div class="bt"><div class="bf" style="width:${t.v / maxV * 100}%"></div></div></div></td>
      <td class="r">${fmtM(t.v / t.n)}</td>
      <td class="r">${t.prop ? fmtM(t.prop) : '<span class="flat">—</span>'}</td>
      <td>${allYears.map(y => `<span class="yr ${t.years.has(y) ? 'on' : 'off'}" title="${y}: ${t.g.filter(p => p.vig === y).length} proyectos">${String(y).slice(2)}</span>`).join('')}</td>
    </tr>`).join('')}
    <tr class="total"><td>Total</td><td class="r">${rows.length}</td><td class="r">${fmtM(pres)}</td><td class="r">100%</td>
      <td class="r">${fmtM(pres / rows.length)}</td><td class="r">${fmtM(sum(rows, 'prop'))}</td><td></td></tr></tbody>`;
}

/* ================= VISTA: EJECUCIÓN ================= */
function renderEjecucion(rows) {
  const pres = sum(rows, 'pres');
  const by = k => rows.filter(p => p.estado === k);
  const ej = by('Ejecutado'), run = by('En ejecución'), pend = by('Pendiente de cierre');
  const avW = pres ? sum(rows, p => p.av * p.pres) / pres * 100 : 0;
  document.getElementById('kpiEjec').innerHTML = kpiHTML([
    { label: 'Proyectos ejecutados (100%)', num: fmt(ej.length), delta: rows.length ? `${fmtP(ej.length / rows.length * 100)} de los proyectos · ${fmtM(sum(ej, 'pres'))}` : '—' },
    { label: 'Avance ponderado por presupuesto', num: fmtP(avW), delta: `Promedio simple: ${rows.length ? fmtP(sum(rows, 'av') / rows.length * 100) : '—'}` },
    { label: 'En ejecución', num: fmt(run.length), delta: run.length ? `${fmtM(sum(run, 'pres'))} · fecha final posterior al corte` : 'Sin proyectos en curso con este filtro' },
    { label: 'Pendientes de cierre', num: fmt(pend.length), delta: pend.length ? `<span class="down">${fmtM(sum(pend, 'pres'))}</span> · fecha cumplida, avance < 100%` : 'Sin pendientes' }
  ]);

  const corte = new Date(DATA.corte + 'T00:00:00');
  const open = rows.filter(p => p.av < 0.9999).sort((a, b) => a.fin.localeCompare(b.fin));
  const tp = document.getElementById('tblPend');
  tp.innerHTML = open.length ? `<thead><tr><th class="r">Nº</th><th>Proyecto</th><th class="c">Vigencia</th><th>Acta de inicio</th><th>Finalización</th>
      <th class="r">Presupuesto</th><th class="r">Avance</th><th>Estado</th><th class="r">Días respecto al corte</th></tr></thead>
    <tbody>${open.map(p => {
      const d = Math.round((new Date(p.fin + 'T00:00:00') - corte) / 864e5);
      return `<tr><td class="r flat">${p.n}</td>
        <td class="name">${esc(short(p.nombre, 70))}<small>${esc(p.entidad)}</small></td>
        <td class="c">${p.vig}</td><td>${fmtDate(p.ini)}</td><td>${fmtDate(p.fin)}</td>
        <td class="r cell-sc">${fmtM(p.pres)}</td>
        <td class="r"><div class="barcell"><span class="cell-sc">${fmtP(p.av * 100, 0)}</span><div class="bt"><div class="bf" style="width:${p.av * 100}%;background:${EST_COLORS[p.estado]}"></div></div></div></td>
        <td><span class="st ${EST_CLASS[p.estado]}">${p.estado}</span></td>
        <td class="r ${d < 0 ? 'down' : 'up'}">${d < 0 ? `vencido hace ${fmt(-d)} días` : `faltan ${fmt(d)} días`}</td></tr>`;
    }).join('')}</tbody>` : `<tr><td>${emptyState('Todos los proyectos filtrados reportan 100% de avance.')}</td></tr>`;

  const years = YEARS();
  const byY = groupBy(rows, 'vig');
  mkChart('chDur', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [{ data: years.map(y => { const g = byY.get(y); return g ? sum(g, 'dur') / g.length / 30.44 : null; }), backgroundColor: COL.teal, borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      scales: { x: axisX(), y: axisY({ grace: '12%', ticks: { callback: v => fmt(v) + ' m' } }) },
      plugins: {
        inlineLabels: { enabled: true, fmt: v => fmt(v, 1) + ' meses' },
        tooltip: { callbacks: { label: c => { const g = byY.get(years[c.dataIndex]) || []; return [` ${fmt(c.raw, 1)} meses en promedio`, ` ${g.length} proyectos`, g.length ? ` Rango: ${fmt(Math.min(...g.map(p => p.dur)) / 30.44, 1)} – ${fmt(Math.max(...g.map(p => p.dur)) / 30.44, 1)} meses` : '']; } } }
      }
    }
  });

  const mCount = MESES.map((_, i) => rows.filter(p => Number(p.ini.slice(5, 7)) === i + 1).length);
  const mPres = MESES.map((_, i) => sum(rows.filter(p => Number(p.ini.slice(5, 7)) === i + 1), 'pres'));
  mkChart('chMes', {
    type: 'bar',
    data: { labels: MESES, datasets: [{ data: mCount, backgroundColor: COL.ink, borderRadius: 4, maxBarThickness: 34 }] },
    options: {
      scales: { x: axisX(), y: axisY({ grace: '12%', ticks: { precision: 0 } }) },
      plugins: {
        inlineLabels: { enabled: true, fmt: v => fmt(v) },
        tooltip: { callbacks: { label: c => [` ${c.raw} proyectos iniciados`, ` Presupuesto: ${fmtM(mPres[c.dataIndex])}`] } }
      }
    }
  });

  // Cronograma
  const g = [...rows].sort((a, b) => a.ini.localeCompare(b.ini) || a.n - b.n);
  document.getElementById('ganttLegend').innerHTML = Object.entries(EST_COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${k} (${rows.filter(p => p.estado === k).length})</span>`).join('') + `<span><i class="dash"></i>Fecha de corte</span>`;
  document.getElementById('wrapGantt').style.height = Math.max(200, g.length * 19 + 60) + 'px';
  const t = s => new Date(s + 'T00:00:00').getTime();
  const minX = g.length ? new Date(Math.min(...g.map(p => t(p.ini)))).getFullYear() : 2021;
  const maxX = g.length ? Math.max(new Date(Math.max(...g.map(p => t(p.fin)))).getFullYear(), corte.getFullYear()) + 1 : 2027;
  mkChart('chGantt', {
    type: 'bar',
    data: {
      labels: g.map(p => `${p.n}. ${short(p.nombre, 42)}`),
      datasets: [{ data: g.map(p => [t(p.ini), t(p.fin)]), backgroundColor: g.map(p => EST_COLORS[p.estado]), borderRadius: 3, borderSkipped: false, barPercentage: 0.78, categoryPercentage: 0.9 }]
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: { type: 'linear', position: 'top', min: new Date(minX, 0, 1).getTime(), max: new Date(maxX, 0, 1).getTime(),
             grid: { color: COL.grid }, border: { display: false },
             afterBuildTicks: ax => { ax.ticks = []; for (let y = minX; y <= maxX; y++) ax.ticks.push({ value: new Date(y, 0, 1).getTime() }); },
             ticks: { callback: v => new Date(v).getFullYear(), color: COL.muted } },
        y: axisX({ ticks: { color: '#16324F', font: { size: 10.5 }, autoSkip: false } })
      },
      plugins: {
        cutLine: { value: corte.getTime() },
        tooltip: { callbacks: {
          title: items => g[items[0].dataIndex].nombre,
          label: c => { const p = g[c.dataIndex]; return [` ${p.entidad}`, ` ${fmtDate(p.ini)} → ${fmtDate(p.fin)} (${fmt(p.dur / 30.44, 1)} meses)`, ` ${fmtM(p.pres)} · avance ${fmtP(p.av * 100, 0)} · ${p.estado}`]; }
        } }
      }
    }
  });
}

/* ================= VISTA: PORTAFOLIO ================= */
const PCOLS = [
  { k: 'n', label: 'Nº', cls: 'r' },
  { k: 'nombre', label: 'Proyecto' },
  { k: 'vig', label: 'Vigencia', cls: 'c' },
  { k: 'pres', label: 'Presupuesto', cls: 'r' },
  { k: 'ext', label: 'Externos', cls: 'r' },
  { k: 'prop', label: 'Propios', cls: 'r' },
  { k: 'av', label: 'Avance', cls: 'r' },
  { k: 'estado', label: 'Estado' }
];
function renderPortafolio(rows) {
  const q = STATE.search.trim().toLowerCase();
  let r = q ? rows.filter(p => (p.nombre + ' ' + p.entidad + ' ' + p.objetivo + ' ' + p.n).toLowerCase().includes(q)) : rows.slice();
  const { sortKey: k, sortDir: d } = STATE;
  r.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) : a[k] - b[k]) * d || a.n - b.n);
  document.getElementById('portSub').textContent = `${r.length} proyectos · haz clic en una fila para ver el objetivo y el detalle`;
  const tbl = document.getElementById('tblPort');
  const head = `<thead><tr>${PCOLS.map(c => `<th class="sortable ${c.cls || ''} ${k === c.k ? 'sorted' : ''}" data-k="${c.k}">${c.label}<span class="arr">${k === c.k ? (d > 0 ? '▲' : '▼') : '↕'}</span></th>`).join('')}</tr></thead>`;
  if (!r.length) { tbl.innerHTML = head + `<tbody><tr><td colspan="${PCOLS.length}">${emptyState('No hay proyectos que coincidan con la búsqueda.')}</td></tr></tbody>`; bindSort(); return; }
  tbl.innerHTML = head + `<tbody>${r.map(p => {
    const op = STATE.open.has(p.n);
    return `<tr class="proj${op ? ' open' : ''}" data-n="${p.n}" tabindex="0" aria-expanded="${op}">
      <td class="r flat">${p.n}</td>
      <td class="name"><span class="caret">▶</span>${esc(p.nombre)}<small>${esc(p.entidad)} · ${esc(p.cat)}</small></td>
      <td class="c">${p.vig}</td>
      <td class="r cell-sc">${fmtM(p.pres)}</td>
      <td class="r">${fmtM(p.ext)}</td>
      <td class="r">${p.prop ? fmtM(p.prop) : '<span class="flat">—</span>'}</td>
      <td class="r"><div class="barcell"><span class="cell-sc">${fmtP(p.av * 100, 0)}</span><div class="bt"><div class="bf" style="width:${p.av * 100}%;background:${EST_COLORS[p.estado]}"></div></div></div></td>
      <td><span class="st ${EST_CLASS[p.estado]}">${p.estado}</span></td></tr>` +
      (op ? `<tr class="detail"><td colspan="${PCOLS.length}"><b>Objetivo:</b> ${esc(p.objetivo || 'Sin objetivo registrado.')}
        <div class="dgrid">
          <div><span>Instrumento</span><b>${esc(p.inst)}</b></div>
          <div><span>Tipo de entidad</span><b>${esc(p.tipoEnt)} · recursos ${esc(p.rec.toLowerCase())}</b></div>
          <div><span>Ejecución</span><b>${fmtDate(p.ini)} → ${fmtDate(p.fin)}</b> (${fmt(p.dur / 30.44, 1)} meses)</div>
          <div><span>Observaciones</span><b>${esc(p.obs || '—')}</b></div>
        </div></td></tr>` : '');
  }).join('')}
  <tr class="total"><td></td><td>Total (${r.length} proyectos)</td><td></td><td class="r">${fmtM(sum(r, 'pres'))}</td><td class="r">${fmtM(sum(r, 'ext'))}</td><td class="r">${fmtM(sum(r, 'prop'))}</td><td></td><td></td></tr></tbody>`;
  tbl.querySelectorAll('tr.proj').forEach(tr => {
    const tg = () => { const n = Number(tr.dataset.n); STATE.open.has(n) ? STATE.open.delete(n) : STATE.open.add(n); renderPortafolio(filtered()); };
    tr.onclick = tg;
    tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tg(); } };
  });
  bindSort();
}
function bindSort() {
  document.querySelectorAll('#tblPort th.sortable').forEach(th => th.onclick = () => {
    const k = th.dataset.k;
    if (STATE.sortKey === k) STATE.sortDir *= -1;
    else { STATE.sortKey = k; STATE.sortDir = ['pres', 'ext', 'prop', 'av'].includes(k) ? -1 : 1; }
    renderPortafolio(filtered());
  });
}

/* ---------------- Render principal ---------------- */
function render() {
  const rows = filtered();
  filterSummary(rows);
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + STATE.tab));
  if (STATE.tab === 'resumen') renderResumen(rows);
  if (STATE.tab === 'financiadores') renderFinanciadores(rows);
  if (STATE.tab === 'ejecucion') renderEjecucion(rows);
  if (STATE.tab === 'portafolio') renderPortafolio(rows);
}
function refresh() { buildSidebar(); render(); }

function init(data) {
  DATA = data; ALL = data.proyectos;
  defineDims();
  document.getElementById('asOf').textContent = fmtDate(data.corte);
  document.getElementById('fuenteTxt').innerHTML = `${esc(data.fuente)}, con corte al <b>${fmtDate(data.corte)}</b>. Incluye ${ALL.length} proyectos con vigencias ${DIMS[0].values[0]}–${DIMS[0].values.at(-1)}.`;
  document.getElementById('footSrc').textContent = `Fuente: ${data.fuente} · corte ${fmtDate(data.corte)}.`;
  document.getElementById('clearAll').onclick = () => { DIMS.forEach(d => SEL[d.key] = new Set(d.values)); STATE.search = ''; document.getElementById('search').value = ''; refresh(); };
  document.getElementById('search').addEventListener('input', e => { STATE.search = e.target.value; renderPortafolio(filtered()); });
  buildTabs();
  refresh();
}

if (window.__DATA__) init(window.__DATA__);
else fetch('data.json').then(r => r.json()).then(init).catch(err => {
  document.querySelector('.main').insertAdjacentHTML('afterbegin', `<div class="callout">No fue posible cargar <b>data.json</b> (${esc(err.message)}). Si abriste el archivo localmente, publícalo en GitHub Pages o usa un servidor local.</div>`);
});
