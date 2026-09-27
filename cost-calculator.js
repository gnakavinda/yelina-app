const COST_COMPONENTS = [
  { key: 'fabric', label: 'Fabric' },
  { key: 'trims', label: 'Trims & accessories' },
  { key: 'labor', label: 'Labor' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'overhead', label: 'Other overhead' }
];

let getDesigns = () => [];
let saveDesignCosts = async () => {};
let selectedCostDesignId = '';

function currentDesign() {
  return getDesigns().find(design => String(design.id) === String(selectedCostDesignId));
}

function renderCostCalculator() {
  const designs = getDesigns();
  const select = document.getElementById('cost-design-select');
  const emptyState = document.getElementById('cost-calculator-empty');
  const form = document.getElementById('cost-calculator-form');

  select.innerHTML = designs.map(design =>
    `<option value="${String(design.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${String(design.code || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')} - ${String(design.name || 'Untitled design').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`
  ).join('');

  if (!designs.some(design => String(design.id) === String(selectedCostDesignId))) {
    selectedCostDesignId = designs[0]?.id || '';
  }
  select.value = selectedCostDesignId;
  emptyState.classList.toggle('hidden', designs.length > 0);
  form.classList.toggle('hidden', designs.length === 0);
  select.disabled = designs.length === 0;
  if (!designs.length) return;

  const design = currentDesign();
  COST_COMPONENTS.forEach(({ key }) => {
    document.getElementById(`cost-${key}`).value = design.costBreakdown?.[key] ?? '';
  });
  document.getElementById('cost-save-status').textContent = design.costBreakdown
    ? `Saved for ${design.code || design.name}`
    : 'No saved breakdown';
  updateCostTotal();
}

function getCostBreakdown() {
  return Object.fromEntries(COST_COMPONENTS.map(({ key }) => {
    const value = Number(document.getElementById(`cost-${key}`).value);
    return [key, Number.isFinite(value) && value > 0 ? value : 0];
  }));
}

window.selectCostDesign = (designId) => {
  selectedCostDesignId = designId;
  renderCostCalculator();
};

window.updateCostTotal = () => {
  const total = Object.values(getCostBreakdown()).reduce((sum, amount) => sum + amount, 0);
  document.getElementById('cost-total').textContent = `LKR ${total.toFixed(2)}`;
  const design = currentDesign();
  document.getElementById('cost-save-status').textContent = design?.costBreakdown
    ? 'Unsaved changes'
    : 'Not saved yet';
};

window.saveDesignCost = async () => {
  const design = currentDesign();
  if (!design) return;

  const breakdown = getCostBreakdown();
  const total = Object.values(breakdown).reduce((sum, amount) => sum + amount, 0);
  const button = document.getElementById('cost-save-button');
  button.disabled = true;
  document.getElementById('cost-save-status').textContent = 'Saving...';
  try {
    await saveDesignCosts(design.id, breakdown, total);
    document.getElementById('cost-save-status').textContent = `Saved for ${design.code || design.name}`;
  } catch (error) {
    console.error('Failed to save design cost breakdown', error);
    document.getElementById('cost-save-status').textContent = 'Save failed. Please try again.';
  } finally {
    button.disabled = false;
  }
};

export function initializeCostCalculator(designProvider, saveCallback) {
  getDesigns = designProvider;
  saveDesignCosts = saveCallback;
  renderCostCalculator();
}

export function refreshCostCalculator() {
  renderCostCalculator();
}