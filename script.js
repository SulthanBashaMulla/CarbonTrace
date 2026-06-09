'use strict';

/* ── CONSTANTS: frozen to prevent mutation ───────────────────────────────── */
const FACTORS = Object.freeze({
  car: 0.21,
  flight: 90,
  electricity: 0.82,
  diet: Object.freeze({ 'meat-heavy': 150, 'average': 100, 'vegetarian': 55, 'vegan': 30 }),
  shopping: 0.005,
  publicTransport: 0.04
});

const CATEGORIES = Object.freeze(['Transport', 'Flight', 'Energy', 'Diet', 'Shopping']);
const CAT_ICONS  = Object.freeze(['🚗', '✈️', '⚡', '🍖', '🛍️']);
const CAT_COLORS = Object.freeze(['#39ff8a', '#ffb340', '#4cb8ff', '#c47aff', '#ff8c4c']);

const COMPARISONS = Object.freeze([
  { name: 'You',        val: 0,   you: true },
  { name: 'India avg',  val: 133 },
  { name: 'Global avg', val: 375 },
  { name: 'EU avg',     val: 625 },
  { name: 'USA avg',    val: 1458 },
]);

const ALL_TIPS = Object.freeze({
  Transport: Object.freeze([
    { title: 'Switch to EV',         body: 'Electric vehicles cut transport emissions by up to 70% on India\'s grid.' },
    { title: 'Carpool twice a week', body: 'Sharing a ride 2 days a week effectively halves your car emissions.' },
  ]),
  Flight: Object.freeze([
    { title: 'Take the train',       body: 'Rail emits ~80% less CO₂ than flying the equivalent route.' },
    { title: 'Offset your flights',  body: 'Verified carbon offset programs can neutralise unavoidable air travel.' },
  ]),
  Energy: Object.freeze([
    { title: 'Switch to LEDs',          body: 'LED bulbs use 75% less energy and last 25× longer than incandescent.' },
    { title: 'Unplug standby devices',  body: 'Phantom loads silently account for up to 10% of household electricity.' },
  ]),
  Diet: Object.freeze([
    { title: 'Meatless Monday',      body: 'One meat-free day per week saves roughly 330 kg CO₂ per year.' },
    { title: 'Eat local & seasonal', body: 'Local produce carries a fraction of the transport carbon cost.' },
  ]),
  Shopping: Object.freeze([
    { title: 'Buy secondhand',        body: 'Secondhand clothing has an 82% lower carbon impact than buying new.' },
    { title: 'Repair, don\'t replace', body: 'Repairing electronics instead of replacing them saves significant emissions.' },
  ]),
});

/* ── FIELD CONFIG ────────────────────────────────────────────────────────── */
const FIELD_DEFAULTS = Object.freeze({ 'car-km': 500, 'flight-hrs': 0, 'electricity': 200, 'shopping': 5000, 'public-km': 100 });
const FIELD_MAX      = Object.freeze({ 'car-km': 50000, 'flight-hrs': 720, 'electricity': 99999, 'shopping': 9999999, 'public-km': 50000 });
const DIET_ALLOWED   = Object.freeze(['meat-heavy', 'average', 'vegetarian', 'vegan']);

/* ── CACHED DOM REFS (queried once, reused) ──────────────────────────────── */
const DOM = (() => {
  const g = id => document.getElementById(id);
  return Object.freeze({
    carKm:         g('car-km'),
    flightHrs:     g('flight-hrs'),
    electricity:   g('electricity'),
    diet:          g('diet'),
    shopping:      g('shopping'),
    publicKm:      g('public-km'),
    resultPanel:   g('result-panel'),
    resultNumber:  g('result-number'),
    resultLabel:   g('result-label'),
    gaugeFill:     g('gauge-fill'),
    gaugeNeedle:   g('gauge-needle'),
    breakdownRows: g('breakdown-rows'),
    tipsGrid:      g('tips-grid'),
    compareBars:   g('compare-bars'),
    pledgeMsg:     g('pledge-msg'),
    calcSection:   g('calc-section'),
  });
})();

/* ── SECURITY: sanitize & validate ──────────────────────────────────────── */
function sanitizeNumber(val, max) {
  const n = parseFloat(val);
  if (!isFinite(n) || n < 0) return 0;
  return max !== undefined ? Math.min(n, max) : n;
}

function sanitizeDiet(val) {
  return DIET_ALLOWED.includes(val) ? val : 'average';
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── CALCULATION (pure function — no side effects) ───────────────────────── */
function calcEmissions(inputs) {
  const transport = (inputs.carKm * FACTORS.car) + (inputs.publicKm * FACTORS.publicTransport);
  const flight    = inputs.flightHrs * FACTORS.flight;
  const energy    = inputs.electricity * FACTORS.electricity;
  const dietVal   = FACTORS.diet[inputs.diet] ?? FACTORS.diet['average'];
  const shopVal   = inputs.shopping * FACTORS.shopping;
  return Object.freeze({
    values: [transport, flight, energy, dietVal, shopVal],
    total:  transport + flight + energy + dietVal + shopVal
  });
}

/* ── EFFICIENT DOM RENDERERS (DocumentFragment — single reflow) ──────────── */
function renderBreakdown(values) {
  const maxCat = Math.max(...values, 1);
  const frag   = document.createDocumentFragment();

  CATEGORIES.forEach((cat, i) => {
    const pct = ((values[i] / maxCat) * 100).toFixed(1);
    const row = document.createElement('div');
    row.className = 'breakdown-row';

    const icon  = document.createElement('span');
    icon.className = 'breakdown-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = CAT_ICONS[i];

    const name  = document.createElement('span');
    name.className = 'breakdown-name';
    name.textContent = cat;

    const barBg = document.createElement('div');
    barBg.className = 'breakdown-bar-bg';
    barBg.setAttribute('role', 'progressbar');
    barBg.setAttribute('aria-valuenow', Math.round(values[i]));
    barBg.setAttribute('aria-valuemin', '0');
    barBg.setAttribute('aria-valuemax', Math.round(maxCat));
    barBg.setAttribute('aria-label', cat + ' emissions');

    const fill  = document.createElement('div');
    fill.className = 'breakdown-bar-fill';
    fill.style.cssText = `width:0%; background:${CAT_COLORS[i]}; box-shadow:0 0 6px ${CAT_COLORS[i]}66`;
    barBg.appendChild(fill);

    const val   = document.createElement('span');
    val.className = 'breakdown-val';
    val.textContent = Math.round(values[i]) + ' kg';

    row.append(icon, name, barBg, val);
    frag.appendChild(row);

    // Animate after paint — avoids layout thrashing
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
  });

  DOM.breakdownRows.replaceChildren(frag);
}

function renderTips(values) {
  const sorted  = values.map((v, i) => ({ cat: CATEGORIES[i], val: v })).sort((a, b) => b.val - a.val);
  const topCats = sorted.slice(0, 2).map(x => x.cat);
  const tips    = topCats.flatMap(cat => ALL_TIPS[cat] || []).slice(0, 4);
  const frag    = document.createDocumentFragment();

  tips.forEach(t => {
    const card   = document.createElement('div');
    card.className = 'tip-card';

    const strong = document.createElement('strong');
    strong.textContent = t.title;

    const p      = document.createElement('p');
    p.textContent = t.body;

    card.append(strong, p);
    frag.appendChild(card);
  });

  DOM.tipsGrid.replaceChildren(frag);
}

function renderCompare(userTotal) {
  const comps   = COMPARISONS.map(c => c.you ? { ...c, val: Math.round(userTotal) } : c);
  const maxComp = Math.max(...comps.map(c => c.val), 1);
  const frag    = document.createDocumentFragment();

  comps.forEach(c => {
    const pct = ((c.val / maxComp) * 100).toFixed(1);
    const row = document.createElement('div');
    row.className = 'compare-row';

    const name = document.createElement('span');
    name.className = 'compare-name';
    if (c.you) name.style.cssText = 'color:var(--green);font-weight:600';
    name.textContent = c.name;

    const barBg = document.createElement('div');
    barBg.className = 'compare-bar-bg';
    barBg.setAttribute('role', 'progressbar');
    barBg.setAttribute('aria-valuenow', c.val);
    barBg.setAttribute('aria-valuemax', maxComp);
    barBg.setAttribute('aria-label', c.name);

    const fill  = document.createElement('div');
    fill.className = 'compare-bar-fill' + (c.you ? ' you' : '');
    fill.style.width = '0%';
    barBg.appendChild(fill);

    const val   = document.createElement('span');
    val.className = 'compare-val';
    val.textContent = c.val;

    row.append(name, barBg, val);
    frag.appendChild(row);

    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
  });

  DOM.compareBars.replaceChildren(frag);
}

/* ── MAIN CALCULATE ──────────────────────────────────────────────────────── */
function calculate() {
  // Sanitize all inputs
  const inputs = {
    carKm:       sanitizeNumber(DOM.carKm.value,       FIELD_MAX['car-km']),
    flightHrs:   sanitizeNumber(DOM.flightHrs.value,   FIELD_MAX['flight-hrs']),
    electricity: sanitizeNumber(DOM.electricity.value, FIELD_MAX['electricity']),
    diet:        sanitizeDiet(DOM.diet.value),
    shopping:    sanitizeNumber(DOM.shopping.value,    FIELD_MAX['shopping']),
    publicKm:    sanitizeNumber(DOM.publicKm.value,    FIELD_MAX['public-km']),
  };

  const { values, total } = calcEmissions(inputs);

  // Result number
  DOM.resultNumber.textContent = Math.round(total);
  DOM.resultNumber.className   = 'result-number ' + (total < 200 ? 'low' : total < 500 ? 'medium' : 'high');

  // Verdict
  if      (total < 133) DOM.resultLabel.textContent = '🌿 Below India average — excellent!';
  else if (total < 375) DOM.resultLabel.textContent = '⚠️ Above India average — room to improve';
  else                  DOM.resultLabel.textContent = '🔴 High footprint — action needed';

  // Gauge — single rAF to batch style changes
  const pct = Math.min(total / 800, 1);
  requestAnimationFrame(() => {
    DOM.gaugeFill.style.strokeDashoffset = 298 - (298 * pct);
    DOM.gaugeNeedle.style.transform      = `rotate(${-90 + pct * 180}deg)`;
  });

  renderBreakdown(values);
  renderTips(values);
  renderCompare(total);

  DOM.resultPanel.classList.add('visible');
  setTimeout(() => DOM.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/* ── RESET ───────────────────────────────────────────────────────────────── */
function resetForm() {
  Object.entries(FIELD_DEFAULTS).forEach(([id, val]) => {
    DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] && 
      (document.getElementById(id).value = val);
  });
  // Direct assignment for mapped IDs
  DOM.carKm.value       = FIELD_DEFAULTS['car-km'];
  DOM.flightHrs.value   = FIELD_DEFAULTS['flight-hrs'];
  DOM.electricity.value = FIELD_DEFAULTS['electricity'];
  DOM.shopping.value    = FIELD_DEFAULTS['shopping'];
  DOM.publicKm.value    = FIELD_DEFAULTS['public-km'];
  DOM.diet.value        = 'average';
  DOM.resultPanel.classList.remove('visible');
  DOM.calcSection.scrollIntoView({ behavior: 'smooth' });
}

/* ── PLEDGE ──────────────────────────────────────────────────────────────── */
let pledgeCount = 247;
function pledge(btn) {
  document.querySelectorAll('.pledge-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  pledgeCount++;
  DOM.pledgeMsg.textContent = `✓ Pledge accepted — you're one of ${pledgeCount} people acting this month.`;
        }
