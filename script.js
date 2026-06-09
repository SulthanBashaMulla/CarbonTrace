const FACTORS = {
    car: 0.21,
    flight: 90,
    electricity: 0.82,
    diet: { 'meat-heavy': 150, 'average': 100, 'vegetarian': 55, 'vegan': 30 },
    shopping: 0.005,
    publicTransport: 0.04
  };

  const CATEGORIES  = ['Transport', 'Flight',  'Energy',  'Diet',    'Shopping'];
  const CAT_ICONS   = ['🚗',        '✈️',      '⚡',      '🍖',      '🛍️'];
  const CAT_COLORS  = ['#39ff8a',   '#ffb340', '#4cb8ff', '#c47aff', '#ff8c4c'];

  const COMPARISONS = [
    { name: 'You',        val: 0,    you: true },
    { name: 'India avg',  val: 133 },
    { name: 'Global avg', val: 375 },
    { name: 'EU avg',     val: 625 },
    { name: 'USA avg',    val: 1458 },
  ];

  const ALL_TIPS = {
    Transport: [
      { title: 'Switch to EV', body: 'Electric vehicles cut transport emissions by up to 70% on India\'s grid.' },
      { title: 'Carpool twice a week', body: 'Sharing a ride 2 days a week effectively halves your car emissions.' },
    ],
    Flight: [
      { title: 'Take the train', body: 'Rail emits ~80% less CO₂ than flying the equivalent route.' },
      { title: 'Offset your flights', body: 'Verified carbon offset programs can neutralise unavoidable air travel.' },
    ],
    Energy: [
      { title: 'Switch to LEDs', body: 'LED bulbs use 75% less energy and last 25× longer than incandescent.' },
      { title: 'Unplug standby devices', body: 'Phantom loads silently account for up to 10% of household electricity.' },
    ],
    Diet: [
      { title: 'Meatless Monday', body: 'One meat-free day per week saves roughly 330 kg CO₂ per year.' },
      { title: 'Eat local & seasonal', body: 'Local produce carries a fraction of the transport carbon cost.' },
    ],
    Shopping: [
      { title: 'Buy secondhand', body: 'Secondhand clothing has an 82% lower carbon impact than buying new.' },
      { title: 'Repair, don\'t replace', body: 'Repairing electronics instead of replacing them saves significant emissions.' },
    ],
  };

  function calculate() {
    const carKm     = parseFloat(document.getElementById('car-km').value)    || 0;
    const flightHrs = parseFloat(document.getElementById('flight-hrs').value) || 0;
    const elec      = parseFloat(document.getElementById('electricity').value) || 0;
    const diet      = document.getElementById('diet').value;
    const shopping  = parseFloat(document.getElementById('shopping').value)  || 0;
    const pubKm     = parseFloat(document.getElementById('public-km').value) || 0;

    const transport = (carKm * FACTORS.car) + (pubKm * FACTORS.publicTransport);
    const flight    = flightHrs * FACTORS.flight;
    const energy    = elec * FACTORS.electricity;
    const dietVal   = FACTORS.diet[diet];
    const shopVal   = shopping * FACTORS.shopping;
    const values    = [transport, flight, energy, dietVal, shopVal];
    const total     = values.reduce((a, b) => a + b, 0);

    // Number
    const numEl = document.getElementById('result-number');
    numEl.textContent = Math.round(total);
    numEl.className = 'result-number ' + (total < 200 ? 'low' : total < 500 ? 'medium' : 'high');

    // Verdict
    const lbl = document.getElementById('result-label');
    if (total < 133)      lbl.textContent = '🌿 Below India average — excellent!';
    else if (total < 375) lbl.textContent = '⚠️ Above India average — room to improve';
    else                  lbl.textContent = '🔴 High footprint — action needed';

    // Gauge
    const pct = Math.min(total / 800, 1);
    document.getElementById('gauge-fill').style.strokeDashoffset = 298 - (298 * pct);
    document.getElementById('gauge-needle').style.transform = `rotate(${-90 + pct * 180}deg)`;

    // Breakdown
    const maxCat = Math.max(...values, 1);
    document.getElementById('breakdown-rows').innerHTML = CATEGORIES.map((cat, i) => `
      <div class="breakdown-row">
        <span class="breakdown-icon">${CAT_ICONS[i]}</span>
        <span class="breakdown-name">${cat}</span>
        <div class="breakdown-bar-bg" role="progressbar" aria-valuenow="${Math.round(values[i])}" aria-valuemin="0" aria-valuemax="${Math.round(maxCat)}" aria-label="${cat}">
          <div class="breakdown-bar-fill" style="width:${(values[i]/maxCat*100).toFixed(1)}%; background:${CAT_COLORS[i]}; box-shadow:0 0 6px ${CAT_COLORS[i]}66"></div>
        </div>
        <span class="breakdown-val">${Math.round(values[i])} kg</span>
      </div>
    `).join('');

    // Tips
    const sorted  = values.map((v, i) => ({ cat: CATEGORIES[i], val: v })).sort((a, b) => b.val - a.val);
    const topCats = sorted.slice(0, 2).map(x => x.cat);
    const tips    = topCats.flatMap(cat => ALL_TIPS[cat] || []).slice(0, 4);
    document.getElementById('tips-grid').innerHTML = tips.map(t => `
      <div class="tip-card"><strong>${t.title}</strong><p>${t.body}</p></div>
    `).join('');

    // Compare
    COMPARISONS[0].val = Math.round(total);
    const maxComp = Math.max(...COMPARISONS.map(c => c.val), 1);
    document.getElementById('compare-bars').innerHTML = COMPARISONS.map(c => `
      <div class="compare-row">
        <span class="compare-name" style="${c.you ? 'color:var(--green);font-weight:600' : ''}">${c.name}</span>
        <div class="compare-bar-bg" role="progressbar" aria-valuenow="${c.val}" aria-valuemax="${maxComp}" aria-label="${c.name}">
          <div class="compare-bar-fill ${c.you ? 'you' : ''}" style="width:${(c.val/maxComp*100).toFixed(1)}%"></div>
        </div>
        <span class="compare-val">${c.val}</span>
      </div>
    `).join('');

    // Show
    const panel = document.getElementById('result-panel');
    panel.classList.add('visible');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function resetForm() {
    ['car-km','flight-hrs','electricity','shopping','public-km'].forEach((id, i) => {
      document.getElementById(id).value = [500,0,200,5000,100][i];
    });
    document.getElementById('diet').value = 'average';
    document.getElementById('result-panel').classList.remove('visible');
    document.getElementById('calc-section').scrollIntoView({ behavior: 'smooth' });
  }

  let pledgeCount = 247;
  function pledge(btn) {
    document.querySelectorAll('.pledge-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    pledgeCount++;
    document.getElementById('pledge-msg').textContent =
      `✓ Pledge accepted — you're one of ${pledgeCount} people acting this month.`;
  }
