const DEFAULT_VENDOR_CATEGORIES = ['Fabric', 'Trims & Accessories', 'Manufacturing', 'Packaging', 'Logistics', 'Other'];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadVendors() {
  try {
    const saved = JSON.parse(localStorage.getItem('yelina_vendors') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn('Failed to load vendors from localStorage', error);
    return [];
  }
}

function loadVendorCategories(savedVendors) {
  let categories = DEFAULT_VENDOR_CATEGORIES;
  try {
    const saved = JSON.parse(localStorage.getItem('yelina_vendor_categories') || 'null');
    if (Array.isArray(saved)) categories = saved;
  } catch (error) {
    console.warn('Failed to load vendor categories from localStorage', error);
  }

  return [...new Set([
    ...categories.map(category => String(category || '').trim()).filter(Boolean),
    ...savedVendors.map(vendor => String(vendor.category || '').trim()).filter(Boolean)
  ])];
}

let vendors = [];
let vendorCategories = [];
let vendorSearchQuery = '';
let vendorCategoryFilter = '';
let editingVendorId = null;
let editingVendorCategory = null;
let selectedVendorRating = 0;

function renderVendorRatingInput() {
  const container = document.getElementById('vendor-rating-input');
  container.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const rating = index + 1;
    const selected = rating <= selectedVendorRating;
    return `<button type="button" onclick="setVendorRating(${rating})" aria-label="Rate ${rating} out of 5" aria-pressed="${selected}" class="text-2xl leading-none ${selected ? 'text-amber-500' : 'text-stone-300'} hover:text-amber-500">${selected ? '★' : '☆'}</button>`;
  }).join('') + `<button type="button" onclick="setVendorRating(0)" aria-label="Clear rating" class="ml-2 text-xs text-stone-500 hover:text-stone-900">Clear</button>`;
}

window.setVendorRating = (rating) => {
  selectedVendorRating = Math.max(0, Math.min(5, Number(rating) || 0));
  renderVendorRatingInput();
};

window.openVendorModal = (id = null) => {
  const vendor = vendors.find(item => item.id === id);
  editingVendorId = vendor?.id || null;
  selectedVendorRating = vendor?.rating || 0;
  document.getElementById('vendor-modal-title').innerText = vendor ? 'Edit Vendor' : 'Add Vendor';
  document.getElementById('vendor-name').value = vendor?.name || '';
  renderVendorCategoryOptions();
  document.getElementById('vendor-category').value = vendor?.category || vendorCategories[0] || '';
  document.getElementById('vendor-notes').value = vendor?.notes || '';
  renderVendorRatingInput();
  document.getElementById('modal-vendor').classList.remove('hidden');
  document.getElementById('vendor-name').focus();
};

window.closeVendorModal = () => {
  document.getElementById('modal-vendor').classList.add('hidden');
  editingVendorId = null;
};

window.saveVendor = (event) => {
  event.preventDefault();
  const name = document.getElementById('vendor-name').value.trim();
  const category = document.getElementById('vendor-category').value.trim();
  if (!name || !category) return;

  const vendor = {
    id: editingVendorId || String(Date.now()),
    name,
    category,
    rating: selectedVendorRating,
    notes: document.getElementById('vendor-notes').value.trim()
  };
  const existingIndex = vendors.findIndex(item => item.id === editingVendorId);
  if (existingIndex >= 0) {
    vendors[existingIndex] = vendor;
  } else {
    vendors.push(vendor);
  }

  try {
    localStorage.setItem('yelina_vendors', JSON.stringify(vendors));
  } catch (error) {
    alert('Unable to save vendors in this browser. Check available storage and try again.');
    return;
  }
  renderVendors();
  renderVendorCategories();
  closeVendorModal();
};

window.removeVendor = (id) => {
  const vendor = vendors.find(item => item.id === id);
  if (!vendor || !confirm(`Remove ${vendor.name} from your vendor list?`)) return;
  vendors = vendors.filter(item => item.id !== id);
  localStorage.setItem('yelina_vendors', JSON.stringify(vendors));
  renderVendors();
  renderVendorCategories();
};

function renderVendors() {
  const container = document.getElementById('vendor-list');
  if (!container) return;
  renderVendorCategoryOptions();
  const controls = document.getElementById('vendor-controls');
  const categorySelect = document.getElementById('vendor-category-filter');
  controls.classList.toggle('hidden', vendors.length === 0);
  const categories = [...new Set(vendors.map(vendor => String(vendor.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  categorySelect.innerHTML = '<option value="">All categories</option>' + categories.map(category =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join('');
  if (!categories.includes(vendorCategoryFilter)) vendorCategoryFilter = '';
  categorySelect.value = vendorCategoryFilter;

  if (vendors.length === 0) {
    container.innerHTML = '<div class="col-span-full bg-white rounded-xl border border-dashed border-stone-300 py-12 text-center"><p class="font-semibold text-stone-700">No vendors added yet</p><p class="mt-1 text-sm text-stone-500">Add a vendor to keep their category, rating, and notes together.</p></div>';
    return;
  }

  const query = vendorSearchQuery.trim().toLocaleLowerCase();
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = !query || [vendor.name, vendor.category, vendor.notes]
      .some(value => String(value || '').toLocaleLowerCase().includes(query));
    return matchesSearch && (!vendorCategoryFilter || vendor.category === vendorCategoryFilter);
  });

  if (filteredVendors.length === 0) {
    container.innerHTML = '<div class="col-span-full bg-white rounded-xl border border-dashed border-stone-300 py-10 text-center"><p class="font-semibold text-stone-700">No matching vendors</p><p class="mt-1 text-sm text-stone-500">Try another search or category.</p></div>';
    return;
  }

  container.innerHTML = filteredVendors.map(vendor => {
    const rating = Math.max(0, Math.min(5, Number(vendor.rating) || 0));
    const stars = rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : 'Not rated';
    return `
      <article class="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col gap-4">
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold text-stone-900 break-words">${escapeHtml(vendor.name)}</h3>
            <span class="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">${escapeHtml(vendor.category)}</span>
          </div>
          <div class="text-right shrink-0" aria-label="${rating ? `${rating} out of 5 stars` : 'Not rated'}">
            <span class="text-amber-500">${rating ? '★'.repeat(rating) : ''}</span><span class="text-stone-300">${rating ? '☆'.repeat(5 - rating) : ''}</span>
            ${rating ? '' : `<span class="text-xs text-stone-500">${stars}</span>`}
          </div>
        </div>
        <p class="text-sm text-stone-600 whitespace-pre-wrap break-words min-h-5">${escapeHtml(vendor.notes || 'No notes')}</p>
        <div class="flex justify-end gap-2 border-t border-stone-100 pt-3">
          <button onclick="openVendorModal('${escapeHtml(vendor.id)}')" class="px-3 py-1.5 rounded-lg border border-stone-300 text-sm text-stone-700 hover:bg-stone-100">Edit</button>
          <button onclick="removeVendor('${escapeHtml(vendor.id)}')" class="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-700 hover:bg-red-50">Remove</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderVendorCategoryOptions() {
  const select = document.getElementById('vendor-category');
  if (!select) return;
  if (vendorCategories.length === 0) {
    select.innerHTML = '<option value="">Add a category in Settings first</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = vendorCategories.map(category =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join('');
}

function renderVendorCategories() {
  const container = document.getElementById('vendor-categories-container');
  if (!container) return;
  if (vendorCategories.length === 0) {
    container.innerHTML = '<p class="py-5 text-sm text-stone-500">No categories yet. Add one above to use it for vendors.</p>';
    return;
  }

  container.innerHTML = vendorCategories.map(category => `
    <div data-category="${escapeHtml(category)}" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
      <div>
        <span class="font-medium text-stone-800">${escapeHtml(category)}</span>
        <span class="ml-2 text-xs text-stone-500">${vendors.filter(vendor => vendor.category === category).length} vendors</span>
      </div>
      <div class="flex gap-2">
        <button onclick="editVendorCategory(this.closest('[data-category]').dataset.category)" class="px-3 py-1.5 rounded-lg border border-stone-300 text-sm text-stone-700 hover:bg-stone-100">Rename</button>
        <button onclick="removeVendorCategory(this.closest('[data-category]').dataset.category)" class="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-700 hover:bg-red-50">Remove</button>
      </div>
    </div>
  `).join('');
}

function persistVendorSettings(nextVendors, nextCategories) {
  try {
    localStorage.setItem('yelina_vendors', JSON.stringify(nextVendors));
    localStorage.setItem('yelina_vendor_categories', JSON.stringify(nextCategories));
    vendors = nextVendors;
    vendorCategories = nextCategories;
    return true;
  } catch (error) {
    alert('Unable to save vendor settings in this browser. Check available storage and try again.');
    return false;
  }
}

window.saveVendorCategory = (event) => {
  event.preventDefault();
  const input = document.getElementById('vendor-category-name');
  const category = input.value.trim();
  if (!category) return;
  if (vendorCategories.some(item => item.toLocaleLowerCase() === category.toLocaleLowerCase() && item !== editingVendorCategory)) {
    alert('A vendor category with this name already exists.');
    return;
  }

  const nextCategories = editingVendorCategory
    ? vendorCategories.map(item => item === editingVendorCategory ? category : item)
    : [...vendorCategories, category];
  const nextVendors = editingVendorCategory
    ? vendors.map(vendor => vendor.category === editingVendorCategory ? { ...vendor, category } : vendor)
    : vendors;

  if (!persistVendorSettings(nextVendors, nextCategories)) return;
  cancelVendorCategoryEdit();
  renderVendorCategories();
  renderVendorCategoryOptions();
  renderVendors();
};

window.editVendorCategory = (category) => {
  editingVendorCategory = category;
  document.getElementById('vendor-category-name').value = category;
  document.getElementById('vendor-category-submit').innerText = 'Update Category';
  document.getElementById('vendor-category-cancel').classList.remove('hidden');
  document.getElementById('vendor-category-name').focus();
};

window.cancelVendorCategoryEdit = () => {
  editingVendorCategory = null;
  document.getElementById('vendor-category-name').value = '';
  document.getElementById('vendor-category-submit').innerText = 'Add Category';
  document.getElementById('vendor-category-cancel').classList.add('hidden');
};

window.removeVendorCategory = (category) => {
  if (vendors.some(vendor => vendor.category === category)) {
    alert('This category is assigned to vendors. Reassign those vendors before removing it.');
    return;
  }
  if (!confirm(`Remove the ${category} category?`)) return;
  const nextCategories = vendorCategories.filter(item => item !== category);
  if (!persistVendorSettings(vendors, nextCategories)) return;
  if (vendorCategoryFilter === category) vendorCategoryFilter = '';
  renderVendorCategories();
  renderVendorCategoryOptions();
  renderVendors();
};

window.searchVendors = (query) => {
  vendorSearchQuery = query;
  renderVendors();
};

window.filterVendorsByCategory = (category) => {
  vendorCategoryFilter = category;
  renderVendors();
};

export function initializeVendorManager() {
  vendors = loadVendors();
  vendorCategories = loadVendorCategories(vendors);
  renderVendors();
  renderVendorCategories();
}