/**
 * @fileoverview CarbonTrace – Carbon Footprint Awareness Platform
 * @description  Calculates monthly CO₂ emissions from user activity inputs,
 *               renders visual breakdowns, personalised tips, global comparisons,
 *               and manages a climate pledge interaction.
 * @version      3.0.0
 * @author       SulthanBashaMulla
 * @license      MIT
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
   All data objects are deeply frozen to prevent accidental mutation and allow
   JavaScript engines to apply hidden-class optimisations.
───────────────────────────────────────────────────────────────────────────── */

/**
 * CO₂ emission factors per unit of activity.
 * Sources: IPCC AR6 (2022), IEA Emissions Factors (2023), CEA India Grid 2023.
 * @constant {Object}
 */
const FACTORS = Object.freeze({
  /** kg CO₂ per kilometre driven (average petrol car) */
  car: 0.21,
  /** kg CO₂ per hour of flight (economy, short-haul average) */
  flight: 90,
  /** kg CO₂ per kWh of electricity (India grid average) */
  electricity: 0.82,
  /** kg CO₂ per month by diet type */
  diet: Object.freeze({
    'meat-heavy':  150,
    'average':     100,
    'vegetarian':  55,
    'vegan':       30,
  }),
  /** kg CO₂ per rupee spent on goods */
  shopping: 0.005,
  /** kg CO₂ per kilometre on public transport */
  publicTransport: 0.04,
});

/**
 * Display labels for each emission category (order matches FACTORS keys).
 * @constant {ReadonlyArray<string>}
 */
const CATEGORIES = Object.freeze(['Transport', 'Flight', 'Energy', 'Diet', 'Shopping']);

/**
 * Emoji icons corresponding to each category.
 * @constant {ReadonlyArray<string>}
 */
const CAT_ICONS = Object.freeze(['🚗', '✈️', '⚡', '🍖', '🛍️']);

/**
 * Hex colour codes for category progress bars.
 * @constant {ReadonlyArray<string>}
 */
const CAT_COLORS = Object.freeze(['#39ff8a', '#ffb340', '#4cb8ff', '#c47aff', '#ff8c4c']);

/**
 * Reference monthly emissions (kg CO₂) for global comparison bars.
 * @constant {ReadonlyArray<{name: string, val: number, you?: boolean}>}
 */
const COMPARISONS = Object.freeze([
  { name: 'You',        val: 0,    you: true },
  { name: 'India avg',  val: 133 },
  { name: 'Global avg', val: 375 },
  { name: 'EU avg',     val: 625 },
  { name: 'USA avg',    val: 1458 },
]);

/**
 * Actionable reduction tips keyed by emission category.
 * Each category holds up to two tip objects with a title and body.
 * @constant {Object.<string, ReadonlyArray<{title: string, body: string}>>}
 */
const ALL_TIPS = Object.freeze({
  Transport: Object.freeze([
    { title: 'Switch to EV',         body: "Electric vehicles cut transport emissions by up to 70% on India's grid." },
    { title: 'Carpool twice a week', body: 'Sharing a ride 2 days a week effectively halves your car emissions.' },
  ]),
  Flight: Object.freeze([
    { title: 'Take the train',      body: 'Rail emits ~80% less CO₂ than flying the equivalent route.' },
    { title: 'Offset your flights', body: 'Verified carbon offset programs can neutralise unavoidable air travel.' },
  ]),
  Energy: Object.freeze([
    { title: 'Switch to LEDs',         body: 'LED bulbs use 75% less energy and last 25× longer than incandescent.' },
    { title: 'Unplug standby devices', body: 'Phantom loads silently account for up to 10% of household electricity.' },
  ]),
  Diet: Object.freeze([
    { title: 'Meatless Monday',      body: 'One meat-free day per week saves roughly 330 kg CO₂ per year.' },
    { title: 'Eat local & seasonal', body: 'Local produce carries a fraction of the transport carbon cost.' },
  ]),
  Shopping: Object.freeze([
    { title: 'Buy secondhand',         body: 'Secondhand clothing has an 82% lower carbon impact than buying new.' },
    { title: "Repair, don't replace",  body: 'Repairing electronics instead of replacing them saves significant emissions.' },
  ]),
});

/**
 * Default values restored when the user resets the form.
 * @constant {Object.<string, number>}
 */
const FIELD_DEFAULTS = Object.freeze({
  'car-km':      500,
  'flight-hrs':  0,
  'electricity': 200,
  'shopping':    5000,
  'public-km':   100,
});

/**
 * Maximum accepted values for each numeric input (server-side style validation).
 * @constant {Object.<string, number>}
 */
const FIELD_MAX = Object.freeze({
  'car-km':      50000,
  'flight-hrs':  720,
  'electricity': 99999,
  'shopping':    9999999,
  'public-km':   50000,
});

/**
 * Whitelist of accepted diet values to prevent injection via manipulated DOM.
 * @constant {ReadonlyArray<string>}
 */
const DIET_ALLOWED = Object.freeze(['meat-heavy', 'average', 'vegetarian', 'vegan']);

/* ─────────────────────────────────────────────────────────────────────────────
   DOM CACHE
   All getElementById calls are executed once at module load time.
   Re-using cached references avoids repeated DOM traversal on every interaction.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Frozen map of cached DOM element references.
 * @constant {Object.<string, HTMLElement>}
 */
const DOM = (() => {
  /**
   * Shorthand wrapper around getElementById with a non-null assertion log.
   * @param {string} id - Element ID to query.
   * @returns {HTMLElement|null}
   */
  const g = id => {
    const el = document.getElementById(id);
    if (!el) console.warn(`CarbonTrace: element #${id} not found in DOM.`);
    return el;
  };

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

/* ─────────────────────────────────────────────────────────────────────────────
   SECURITY UTILITIES
───────────────────────────────────────────────────────────────────────────── */

/**
 * Sanitizes a raw input value into a non-negative finite number.
 * Returns 0 for NaN, Infinity, or negative inputs.
 * Optionally clamps the result to a maximum value.
 *
 * @param {string|number} val - Raw value from an input element.
 * @param {number}        [max] - Optional upper bound to clamp the result.
 * @returns {number} Sanitized, non-negative number.
 */
function sanitizeNumber(val, max) {
  const n = parseFloat(val);
  if (!isFinite(n) || n < 0) return 0;
  return (max !== undefined) ? Math.min(n, max) : n;
}

/**
 * Validates a diet string against the allowed whitelist.
 * Falls back to 'average' for any unrecognised or tampered value.
 *
 * @param {string} val - Value from the diet <select> element.
 * @returns {string} A valid diet key guaranteed to exist in FACTORS.diet.
 */
function sanitizeDiet(val) {
  return DIET_ALLOWED.includes(val) ? val : 'average';
}

/**
 * Escapes HTML special characters to prevent XSS when setting innerHTML.
 * Prefer textContent where possible; use this only when HTML context is required.
 *
 * @param {string|number} str - Input to escape.
 * @returns {string} HTML-safe string.
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/* ─────────────────────────────────────────────────────────────────────────────
   CORE CALCULATION
───────────────────────────────────────────────────────────────────────────── */

/**
 * Pure function that calculates monthly CO₂ emissions from sanitized inputs.
 * Has no side effects and returns a frozen result object.
 *
 * @param {{
 *   carKm:       number,
 *   flightHrs:   number,
 *   electricity: number,
 *   diet:        string,
 *   shopping:    number,
 *   publicKm:    number
 * }} inputs - Sanitized activity values.
 *
 * @returns {{
 *   values: ReadonlyArray<number>,
 *   total:  number
 * }} Frozen object with per-category values array and total kg CO₂.
 */
function calcEmissions(inputs) {
  const transport = (inputs.carKm * FACTORS.car) + (inputs.publicKm * FACTORS.publicTransport);
  const flight    = inputs.flightHrs   * FACTORS.flight;
  const energy    = inputs.electricity * FACTORS.electricity;
  const dietVal   = FACTORS.diet[inputs.diet] ?? FACTORS.diet['average'];
  const shopVal   = inputs.shopping    * FACTORS.shopping;

  return Object.freeze({
    values: Object.freeze([transport, flight, energy, dietVal, shopVal]),
    total:  transport + flight + energy + dietVal + shopVal,
  });
}

/**
 * Maps a total kg CO₂ value to a CSS class string for colour coding.
 *
 * @param {number} total - Monthly CO₂ total in kg.
 * @returns {'low'|'medium'|'high'} Severity level string.
 */
function getSeverity(total) {
  if (total < 200) return 'low';
  if (total < 500) return 'medium';
  return 'high';
}

/**
 * Returns a human-readable verdict string for a given total.
 *
 * @param {number} total - Monthly CO₂ total in kg.
 * @returns {string} Verdict message with emoji prefix.
 */
function getVerdict(total) {
  if (total < 133) return '🌿 Below India average — excellent!';
  if (total < 375) return '⚠️ Above India average — room to improve';
  return '🔴 High footprint — action needed';
}

/* ─────────────────────────────────────────────────────────────────────────────
   DOM RENDERERS
   Each renderer builds its output in a DocumentFragment (off-screen) before
   inserting it, ensuring a single reflow per render call.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Renders the per-category emissions breakdown bars into the DOM.
 * Bars animate from 0% to their target width via requestAnimationFrame
 * to avoid layout thrashing.
 *
 * @param {ReadonlyArray<number>} values - Per-category kg CO₂ values (5 elements).
 * @returns {void}
 */
function renderBreakdown(values) {
  const maxCat = Math.max(...values, 1);
  const frag   = document.createDocumentFragment();

  CATEGORIES.forEach((cat, i) => {
    const pct  = ((values[i] / maxCat) * 100).toFixed(1);

    const row  = document.createElement('div');
    row.className = 'breakdown-row';

    const icon = document.createElement('span');
    icon.className = 'breakdown-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = CAT_ICONS[i];

    const name = document.createElement('span');
    name.className = 'breakdown-name';
    name.textContent = cat;

    const barBg = document.createElement('div');
    barBg.className = 'breakdown-bar-bg';
    barBg.setAttribute('role', 'progressbar');
    barBg.setAttribute('aria-valuenow',  String(Math.round(values[i])));
    barBg.setAttribute('aria-valuemin',  '0');
    barBg.setAttribute('aria-valuemax',  String(Math.round(maxCat)));
    barBg.setAttribute('aria-label',     `${cat} emissions`);

    const fill = document.createElement('div');
    fill.className = 'breakdown-bar-fill';
    fill.style.cssText = `width:0%; background:${CAT_COLORS[i]}; box-shadow:0 0 6px ${CAT_COLORS[i]}66`;
    barBg.appendChild(fill);

    const valSpan = document.createElement('span');
    valSpan.className = 'breakdown-val';
    valSpan.textContent = `${Math.round(values[i])} kg`;

    row.append(icon, name, barBg, valSpan);
    frag.appendChild(row);

    // Defer width update to next paint cycle to trigger CSS transition
    requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
  });

  DOM.breakdownRows.replaceChildren(frag);
}

/**
 * Renders personalised reduction tips based on the top-2 emission categories.
 * Tips are built via DOM API (not innerHTML) to prevent XSS.
 *
 * @param {ReadonlyArray<number>} values - Per-category kg CO₂ values (5 elements).
 * @returns {void}
 */
function renderTips(values) {
  const sorted  = values
    .map((v, i) => ({ cat: CATEGORIES[i], val: v }))
    .sort((a, b) => b.val - a.val);

  const topCats = sorted.slice(0, 2).map(x => x.cat);
  const tips    = topCats.flatMap(cat => ALL_TIPS[cat] ?? []).slice(0, 4);
  const frag    = document.createDocumentFragment();

  tips.forEach(tip => {
    const card   = document.createElement('div');
    card.className = 'tip-card';

    const strong = document.createElement('strong');
    strong.textContent = tip.title;

    const p = document.createElement('p');
    p.textContent = tip.body;

    card.append(strong, p);
    frag.appendChild(card);
  });

  DOM.tipsGrid.replaceChildren(frag);
}

/**
 * Renders the global comparison bar chart with the user's result highlighted.
 * Creates a local copy of COMPARISONS to avoid mutating the frozen constant.
 *
 * @param {number} userTotal - The user's calculated monthly CO₂ total in kg.
 * @returns {void}
 */
function renderCompare(userTotal) {
  const comps   = COMPARISONS.map(c => c.you ? { ...c, val: Math.round(userTotal) } : { ...c });
  const maxComp = Math.max(...comps.map(c => c.val), 1);
  const frag    = document.createDocumentFragment();

  comps.forEach(c => {
    const pct = ((c.val / maxComp) * 100).toFixed(1);

    const row = document.createElement('div');
    row.className = 'compare-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'compare-name';
    if (c.you) nameSpan.style.cssText = 'color:var(--green);font-weight:600';
    nameSpan.textContent = c.name;

    const barBg = document.createElement('div');
    barBg.className = 'compare-bar-bg';
    barBg.setAttribute('role',          'progressbar');
    barBg.setAttribute('aria-valuenow', String(c.val));
    barBg.setAttribute('aria-valuemax', String(maxComp));
    barBg.setAttribute('aria-label',    c.name);

    const fill = document.createElement('div');
    fill.className = `compare-bar-fill${c.you ? ' you' : ''}`;
    fill.style.width = '0%';
    barBg.appendChild(fill);

    const valSpan = document.createElement('span');
    valSpan.className = 'compare-val';
    valSpan.textContent = String(c.val);

    row.append(nameSpan, barBg, valSpan);
    frag.appendChild(row);

    requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
  });

  DOM.compareBars.replaceChildren(frag);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC API  (called from HTML onclick attributes)
───────────────────────────────────────────────────────────────────────────── */

/**
 * Entry point triggered by the "Calculate footprint" button.
 * Reads, sanitizes, and validates all form inputs, then orchestrates
 * the full calculation and rendering pipeline.
 *
 * @returns {void}
 */
function calculate() {
  // 1. Sanitize all inputs before use
  const inputs = {
    carKm:       sanitizeNumber(DOM.carKm.value,       FIELD_MAX['car-km']),
    flightHrs:   sanitizeNumber(DOM.flightHrs.value,   FIELD_MAX['flight-hrs']),
    electricity: sanitizeNumber(DOM.electricity.value, FIELD_MAX['electricity']),
    diet:        sanitizeDiet(DOM.diet.value),
    shopping:    sanitizeNumber(DOM.shopping.value,    FIELD_MAX['shopping']),
    publicKm:    sanitizeNumber(DOM.publicKm.value,    FIELD_MAX['public-km']),
  };

  // 2. Run pure calculation
  const { values, total } = calcEmissions(inputs);

  // 3. Update result number and severity class
  DOM.resultNumber.textContent = String(Math.round(total));
  DOM.resultNumber.className   = `result-number ${getSeverity(total)}`;

  // 4. Update verdict text
  DOM.resultLabel.textContent = getVerdict(total);

  // 5. Animate gauge — batched in a single rAF to prevent layout thrashing
  const gaugePct = Math.min(total / 800, 1);
  requestAnimationFrame(() => {
    DOM.gaugeFill.style.strokeDashoffset = String(298 - (298 * gaugePct));
    DOM.gaugeNeedle.style.transform      = `rotate(${-90 + gaugePct * 180}deg)`;
  });

  // 6. Render data panels
  renderBreakdown(values);
  renderTips(values);
  renderCompare(total);

  // 7. Reveal result section and scroll into view
  DOM.resultPanel.classList.add('visible');
  setTimeout(() => DOM.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/**
 * Resets all form inputs to their default values and hides the result panel.
 * Triggered by the "Reset" button.
 *
 * @returns {void}
 */
function resetForm() {
  DOM.carKm.value       = FIELD_DEFAULTS['car-km'];
  DOM.flightHrs.value   = FIELD_DEFAULTS['flight-hrs'];
  DOM.electricity.value = FIELD_DEFAULTS['electricity'];
  DOM.shopping.value    = FIELD_DEFAULTS['shopping'];
  DOM.publicKm.value    = FIELD_DEFAULTS['public-km'];
  DOM.diet.value        = 'average';

  DOM.resultPanel.classList.remove('visible');
  DOM.calcSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Handles pledge chip selection in the pledge section.
 * Deactivates all chips, activates the selected one, increments the
 * pledge counter, and updates the confirmation message.
 *
 * @param {HTMLButtonElement} btn - The clicked pledge chip button element.
 * @returns {void}
 */
let pledgeCount = 247;
function pledge(btn) {
  document.querySelectorAll('.pledge-chip').forEach(chip => chip.classList.remove('active'));
  btn.classList.add('active');
  pledgeCount += 1;
  DOM.pledgeMsg.textContent = `✓ Pledge accepted — you're one of ${pledgeCount} people acting this month.`;
     }

       
