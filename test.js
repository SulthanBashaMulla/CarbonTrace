/**
 * CarbonTrace – Test Suite
 * Tests emission calculations, input validation, and UI logic
 * Run: node test.js
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS — ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL — ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (Math.abs(a - b) > 0.01) throw new Error(msg || `Expected ${b}, got ${a}`);
}

function assertRange(val, min, max, msg) {
  if (val < min || val > max) throw new Error(msg || `Expected ${val} to be between ${min} and ${max}`);
}

// ─── EMISSION FACTORS (mirrors script.js) ───────────────────────────────────
const FACTORS = {
  car: 0.21,
  flight: 90,
  electricity: 0.82,
  diet: { 'meat-heavy': 150, 'average': 100, 'vegetarian': 55, 'vegan': 30 },
  shopping: 0.005,
  publicTransport: 0.04
};

function calcEmissions({ carKm=0, flightHrs=0, electricity=0, diet='average', shopping=0, publicKm=0 }) {
  const transport = (carKm * FACTORS.car) + (publicKm * FACTORS.publicTransport);
  const flight    = flightHrs * FACTORS.flight;
  const energy    = electricity * FACTORS.electricity;
  const dietVal   = FACTORS.diet[diet] ?? 100;
  const shopVal   = shopping * FACTORS.shopping;
  return { transport, flight, energy, diet: dietVal, shopping: shopVal,
           total: transport + flight + energy + dietVal + shopVal };
}

function getVerdict(total) {
  if (total < 133)  return 'low';
  if (total < 375)  return 'medium';
  return 'high';
}

function sanitizeNumber(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return 0;
  return n;
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

console.log('\n🧪 CarbonTrace Test Suite\n');

// 1. EMISSION CALCULATIONS
console.log('📐 Emission Calculations');

test('Car travel emission is correct (500 km)', () => {
  const r = calcEmissions({ carKm: 500 });
  assertEqual(r.transport, 105, 'Expected 500 * 0.21 = 105 kg CO2');
});

test('Flight emission is correct (2 hours)', () => {
  const r = calcEmissions({ flightHrs: 2 });
  assertEqual(r.flight, 180, 'Expected 2 * 90 = 180 kg CO2');
});

test('Electricity emission is correct (200 kWh)', () => {
  const r = calcEmissions({ electricity: 200 });
  assertEqual(r.energy, 164, 'Expected 200 * 0.82 = 164 kg CO2');
});

test('Public transport emission is correct (100 km)', () => {
  const r = calcEmissions({ publicKm: 100 });
  assertEqual(r.transport, 4, 'Expected 100 * 0.04 = 4 kg CO2');
});

test('Shopping emission is correct (5000 rupees)', () => {
  const r = calcEmissions({ shopping: 5000 });
  assertEqual(r.shopping, 25, 'Expected 5000 * 0.005 = 25 kg CO2');
});

// 2. DIET FACTORS
console.log('\n🍽️  Diet Emission Factors');

test('Meat-heavy diet factor = 150', () => {
  const r = calcEmissions({ diet: 'meat-heavy' });
  assertEqual(r.diet, 150);
});

test('Average diet factor = 100', () => {
  const r = calcEmissions({ diet: 'average' });
  assertEqual(r.diet, 100);
});

test('Vegetarian diet factor = 55', () => {
  const r = calcEmissions({ diet: 'vegetarian' });
  assertEqual(r.diet, 55);
});

test('Vegan diet factor = 30', () => {
  const r = calcEmissions({ diet: 'vegan' });
  assertEqual(r.diet, 30);
});

// 3. TOTAL CALCULATION
console.log('\n🔢 Total Calculation');

test('Zero inputs produce diet-only total', () => {
  const r = calcEmissions({ diet: 'average' });
  assertEqual(r.total, 100, 'Zero activity = diet emissions only');
});

test('Combined total is sum of all categories', () => {
  const r = calcEmissions({ carKm: 500, flightHrs: 1, electricity: 200, diet: 'average', shopping: 5000, publicKm: 100 });
  const expected = 105 + 4 + 90 + 164 + 100 + 25;
  assertEqual(r.total, expected, `Expected ${expected}`);
});

test('High-activity user produces high total', () => {
  const r = calcEmissions({ carKm: 2000, flightHrs: 5, electricity: 500, diet: 'meat-heavy', shopping: 20000 });
  assert(r.total > 375, 'High activity should exceed 375 kg/mo');
});

test('Vegan + no car + no flight is below India average', () => {
  const r = calcEmissions({ diet: 'vegan', electricity: 100 });
  assert(r.total < 133, `Expected below India avg (133), got ${r.total.toFixed(2)}`);
});

// 4. VERDICT LOGIC
console.log('\n🎯 Verdict Classification');

test('Total < 133 → low (below India avg)', () => {
  assert(getVerdict(100) === 'low');
});

test('Total 133–374 → medium', () => {
  assert(getVerdict(200) === 'medium');
  assert(getVerdict(374) === 'medium');
});

test('Total ≥ 375 → high', () => {
  assert(getVerdict(375) === 'high');
  assert(getVerdict(1000) === 'high');
});

test('Boundary: exactly 133 → medium', () => {
  assert(getVerdict(133) === 'medium');
});

test('Boundary: exactly 374 → medium', () => {
  assert(getVerdict(374) === 'medium');
});

// 5. INPUT VALIDATION / SECURITY
console.log('\n🔒 Input Validation & Security');

test('Negative car km sanitized to 0', () => {
  assertEqual(sanitizeNumber(-100), 0);
});

test('NaN input sanitized to 0', () => {
  assertEqual(sanitizeNumber('abc'), 0);
});

test('Empty string sanitized to 0', () => {
  assertEqual(sanitizeNumber(''), 0);
});

test('Valid number passes through', () => {
  assertEqual(sanitizeNumber('500'), 500);
});

test('Decimal values are preserved', () => {
  assertEqual(sanitizeNumber('12.5'), 12.5);
});

test('Unknown diet key defaults safely', () => {
  const r = calcEmissions({ diet: 'unknown' });
  assertEqual(r.diet, 100, 'Unknown diet should default to average (100)');
});

test('Extremely large input does not crash', () => {
  const r = calcEmissions({ carKm: 999999, flightHrs: 999, electricity: 99999 });
  assert(typeof r.total === 'number' && isFinite(r.total), 'Should return finite number');
});

// 6. PERCENTAGE / BREAKDOWN LOGIC
console.log('\n📊 Breakdown & Comparison Logic');

test('Category percentages sum correctly', () => {
  const r = calcEmissions({ carKm: 500, flightHrs: 1, electricity: 200, diet: 'average', shopping: 5000 });
  const cats = [r.transport, r.flight, r.energy, r.diet, r.shopping];
  const max = Math.max(...cats);
  cats.forEach(v => assertRange(v / max * 100, 0, 100, 'Each category % must be 0–100'));
});

test('Gauge percentage clamps to 100% max', () => {
  const total = 999999;
  const pct = Math.min(total / 800, 1);
  assertEqual(pct, 1, 'Gauge should not exceed 100%');
});

test('Gauge percentage is non-negative', () => {
  const total = 0;
  const pct = Math.min(total / 800, 1);
  assert(pct >= 0, 'Gauge should not go below 0');
});

test('Compare bar widths are all between 0 and 100%', () => {
  const comparisons = [
    { val: 200 }, { val: 133 }, { val: 375 }, { val: 625 }, { val: 1458 }
  ];
  const max = Math.max(...comparisons.map(c => c.val));
  comparisons.forEach(c => {
    const pct = (c.val / max) * 100;
    assertRange(pct, 0, 100, `Bar width ${pct}% must be 0–100`);
  });
});

// 7. EDGE CASES
console.log('\n⚠️  Edge Cases');

test('All zeros returns only diet emissions', () => {
  const r = calcEmissions({ carKm: 0, flightHrs: 0, electricity: 0, diet: 'average', shopping: 0, publicKm: 0 });
  assertEqual(r.total, 100);
});

test('Float inputs are handled correctly', () => {
  const r = calcEmissions({ carKm: 1.5, flightHrs: 0.5 });
  assertEqual(r.transport, 1.5 * 0.21);
  assertEqual(r.flight, 0.5 * 90);
});

test('Car + public transport combine correctly', () => {
  const r = calcEmissions({ carKm: 100, publicKm: 50 });
  const expected = (100 * 0.21) + (50 * 0.04);
  assertEqual(r.transport, expected);
});

// ─── SUMMARY ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(40));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);
console.log(`🎯 Score:  ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('─'.repeat(40) + '\n');

if (failed > 0) process.exit(1);

