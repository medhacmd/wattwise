const TARIFF = 8.5;
const TARGET_BILL = 2500;
const MONTH_DAYS = 30;

const appliances = [
  { id: 'fridge', name: 'Refrigerator', short: 'Fridge', watts: 150, hours: 24, comfort: 28, icon: '▱', active: true },
  { id: 'wifi', name: 'Wi-Fi router', short: 'Wi-Fi', watts: 12, hours: 24, comfort: 15, icon: '⌁', active: true },
  { id: 'fan', name: 'Ceiling fan', short: 'Fan', watts: 75, hours: 10, comfort: 22, icon: '✣', active: true },
  { id: 'lights', name: 'LED lights', short: 'Lights', watts: 40, hours: 6, comfort: 12, icon: '✦', active: true },
  { id: 'laptop', name: 'Laptop', short: 'Laptop', watts: 65, hours: 8, comfort: 13, icon: '▣', active: true },
  { id: 'tv', name: 'Television', short: 'TV', watts: 110, hours: 4, comfort: 8, icon: '▤', active: false },
  { id: 'microwave', name: 'Microwave', short: 'Microwave', watts: 1000, hours: 0.3, comfort: 2, icon: '▦', active: false }
];

let powerCutActive = false;
let preCutActive = appliances.filter((item) => item.active).map((item) => item.id);
let powerCutSelection = [];
let powerCutBaselineBill = 0;
let toastTimer;

const $ = (id) => document.getElementById(id);
const byId = (id) => appliances.find((item) => item.id === id);
const money = (value) => `₹${Math.max(0, Math.round(value)).toLocaleString('en-IN')}`;
const icon = (item) => `<span class="choice-icon" aria-hidden="true">${item.icon}</span>`;

function getActiveItems() {
  return appliances.filter((item) => item.active);
}

function getEnergy(items = getActiveItems()) {
  const liveWatts = items.reduce((sum, item) => sum + item.watts, 0);
  const dailyKwh = items.reduce((sum, item) => sum + (item.watts * item.hours) / 1000, 0);
  const monthlyKwh = dailyKwh * MONTH_DAYS;
  const bill = monthlyKwh * TARIFF;
  return { liveWatts, dailyKwh, monthlyKwh, bill };
}

function renderAppliances() {
  $('applianceGrid').innerHTML = appliances.map((item, index) => `
    <button class="appliance-card ${item.active ? 'is-on' : 'is-off'}" type="button" data-appliance-id="${item.id}" aria-pressed="${item.active}" aria-label="Toggle ${item.name}, currently ${item.active ? 'on' : 'off'}">
      <div class="appliance-top"><span class="appliance-icon" aria-hidden="true">${item.icon}</span><span class="appliance-index">0${index + 1}</span></div>
      <h3>${item.name}</h3>
      <div class="appliance-meta"><span><strong>${item.watts} W</strong> · ${item.hours}h/day</span><span class="switch" aria-hidden="true"><i></i></span></div>
    </button>`).join('');
  document.querySelectorAll('[data-appliance-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.applianceId;
      if (powerCutActive) {
        showToast('Power-cut mode is locked to three. Use the choice rail to swap.');
        return;
      }
      const item = byId(id);
      item.active = !item.active;
      showToast(`${item.name} switched ${item.active ? 'on' : 'off'}.`);
      updateAll();
    });
  });
}

function renderContributors(items = getActiveItems()) {
  const sorted = items.map((item) => ({ ...item, cost: (item.watts * item.hours * MONTH_DAYS / 1000) * TARIFF })).sort((a, b) => b.cost - a.cost);
  const top = sorted.slice(0, 4);
  const max = top[0]?.cost || 1;
  $('contributors').innerHTML = top.length ? top.map((item) => `
    <div class="contributor"><div class="contributor-head"><span class="contributor-name">${item.name}</span><span class="contributor-value">${money(item.cost)} / mo</span></div><div class="contributor-bar"><span style="width:${Math.max(7, Math.round((item.cost / max) * 100))}%"></span></div></div>`).join('') : `<p class="empty-readout">Nothing is drawing power yet. A blank bill is a very quiet bill.</p>`;

  const leader = top[0];
  if (leader) {
    const share = Math.round((leader.cost / getEnergy(items).bill) * 100) || 0;
    $('insightTitle').textContent = `${leader.name} is your biggest lever.`;
    $('insightText').textContent = `${leader.name} accounts for ${share}% of your active monthly estimate. Small changes here move the needle fastest.`;
  } else {
    $('insightTitle').textContent = 'Quiet house, quiet bill.';
    $('insightText').textContent = 'Switch an appliance on to see which part of your routine costs the most.';
  }
}

function renderChoiceRail() {
  $('choiceGrid').innerHTML = appliances.map((item) => {
    const selected = powerCutSelection.includes(item.id);
    return `<button class="choice-card ${selected ? 'is-selected' : ''}" type="button" data-choice-id="${item.id}" aria-pressed="${selected}">${icon(item)}<span class="choice-name">${item.short}</span><span class="choice-watt">${item.watts} W · ${selected ? 'PROTECTED' : 'SWAP IN'}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-choice-id]').forEach((card) => card.addEventListener('click', () => swapPowerCutChoice(card.dataset.choiceId)));
}

function renderSelection() {
  const selected = powerCutSelection.map(byId);
  $('selectionList').innerHTML = selected.map((item) => `<div class="selection-chip">${icon(item)}<b>${item.short}</b><span>${item.watts} W protected</span></div>`).join('');
  $('selectionCount').textContent = `${selected.length} / 3 SECURED`;
  const comfort = selected.reduce((sum, item) => sum + item.comfort, 0);
  const score = Math.min(100, Math.round((comfort / 80) * 100));
  const currentBill = getEnergy(selected).bill;
  const saving = Math.max(0, powerCutBaselineBill - currentBill);
  $('comfortScore').textContent = score;
  $('savingScore').textContent = money(saving);
  const verdict = score >= 72 && saving >= 450 ? 'BALANCED' : score >= 55 ? 'LEAN + LIVEABLE' : 'LOW COST';
  $('verdictScore').textContent = verdict;
  $('stageTipText').textContent = verdict === 'BALANCED' ? 'Great call. You kept the essentials without letting comfort go dark.' : 'Select another card to swap it into your protected three.';
}

function updateSummary() {
  const energy = getEnergy();
  const bill = energy.bill;
  const buffer = TARGET_BILL - bill;
  const billStatus = bill > TARGET_BILL ? 'OVER TARGET' : bill > TARGET_BILL * .9 ? 'NEAR TARGET' : 'ON TARGET';
  $('liveWatts').textContent = energy.liveWatts.toLocaleString('en-IN');
  $('activeCount').textContent = getActiveItems().length;
  $('dailyKwh').textContent = energy.dailyKwh.toFixed(1);
  $('heroKwh').textContent = Math.round(energy.monthlyKwh).toLocaleString('en-IN');
  $('heroBill').textContent = Math.round(bill).toLocaleString('en-IN');
  $('billBuffer').textContent = buffer >= 0 ? money(buffer) : `−${money(Math.abs(buffer))}`;
  $('bufferDetail').textContent = buffer >= 0 ? 'before you hit target' : 'over your target';
  $('billStatusTag').textContent = billStatus;
  $('billStatusTag').style.color = bill > TARGET_BILL ? 'var(--orange)' : 'var(--mint)';
  $('billMeterFill').style.width = `${Math.min(100, Math.max(3, (bill / TARGET_BILL) * 85))}%`;
  $('meterCaption').textContent = bill > TARGET_BILL ? 'You are over target. Find a high-wattage lever.' : bill > TARGET_BILL * .9 ? 'You are close to the line. A little trim would help.' : 'You have room to keep the living room comfortable.';
  renderContributors();
}

function updateAll() {
  renderAppliances();
  updateSummary();
  if (powerCutActive) {
    renderChoiceRail();
    renderSelection();
  }
}

function enterPowerCut() {
  powerCutActive = true;
  preCutActive = appliances.filter((item) => item.active).map((item) => item.id);
  powerCutBaselineBill = getEnergy().bill;
  const ranked = [...appliances].sort((a, b) => b.comfort - a.comfort);
  powerCutSelection = ranked.slice(0, 3).map((item) => item.id);
  appliances.forEach((item) => { item.active = powerCutSelection.includes(item.id); });
  document.body.classList.add('power-cut-active');
  $('modeLabel').textContent = 'POWER-CUT MODE';
  $('powerButtonTitle').textContent = 'Restore normal mode';
  $('challengeStartLabel').textContent = 'Restore normal mode';
  $('challengeIntroText').textContent = 'The grid is quiet. You have exactly three slots — protect the essentials, then test your instinct.';
  $('stageStatus').textContent = 'OUTAGE SIMULATED';
  $('stagePrompt').textContent = 'Your trio is locked in.';
  $('stageSubprompt').textContent = 'Swap any card below to change the balance between comfort and cost.';
  $('stageCenter').classList.add('hidden');
  $('stageScore').classList.remove('hidden');
  $('stageTip').classList.remove('hidden');
  $('choiceRail').classList.remove('hidden');
  $('challengeSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateAll();
  showToast('Power cut mode is live — three slots only.');
}

function exitPowerCut() {
  powerCutActive = false;
  appliances.forEach((item) => { item.active = preCutActive.includes(item.id); });
  document.body.classList.remove('power-cut-active');
  $('modeLabel').textContent = 'NORMAL MODE';
  $('powerButtonTitle').textContent = 'Trigger power cut';
  $('challengeStartLabel').textContent = 'Enter power-cut mode';
  $('challengeIntroText').textContent = 'A simulated outage is coming. Choose the three appliances you would protect first — comfort and cost are both on the line.';
  $('stageStatus').textContent = 'WAITING FOR OUTAGE';
  $('stagePrompt').textContent = 'Ready when you are.';
  $('stageSubprompt').textContent = 'Your current household rhythm is comfortable, but can you make it lean?';
  $('stageCenter').classList.remove('hidden');
  $('stageScore').classList.add('hidden');
  $('stageTip').classList.add('hidden');
  $('choiceRail').classList.add('hidden');
  updateAll();
  showToast('Normal mode restored.');
}

function swapPowerCutChoice(id) {
  if (!powerCutActive || powerCutSelection.includes(id)) {
    showToast('That appliance is already protected. Pick another card to swap it in.');
    return;
  }
  const selectedItems = powerCutSelection.map(byId);
  const swapOut = selectedItems.reduce((lowest, item) => item.comfort < lowest.comfort ? item : lowest, selectedItems[0]);
  powerCutSelection = powerCutSelection.filter((selectedId) => selectedId !== swapOut.id).concat(id);
  appliances.forEach((item) => { item.active = powerCutSelection.includes(item.id); });
  updateAll();
  showToast(`${byId(id).name} swapped in for ${swapOut.name}.`);
}

function showToast(message) {
  clearTimeout(toastTimer);
  $('toastText').textContent = message;
  $('toast').classList.add('show');
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}

$('powerCutButton').addEventListener('click', () => powerCutActive ? exitPowerCut() : enterPowerCut());
$('challengeStartButton').addEventListener('click', () => powerCutActive ? exitPowerCut() : enterPowerCut());
$('helpButton').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpModal').classList.add('hidden'));
$('helpDone').addEventListener('click', () => $('helpModal').classList.add('hidden'));
$('helpModal').addEventListener('click', (event) => { if (event.target === $('helpModal')) $('helpModal').classList.add('hidden'); });
$('tariffButton').addEventListener('click', () => showToast('Demo assumption: ₹8.50 per kWh, fixed for a fair comparison.'));

updateAll();
