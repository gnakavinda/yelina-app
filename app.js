import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { initializeVendorManager } from './vendor-manager.js';
import { initializeCalendar } from './calendar.js';
import { initializeCostCalculator, refreshCostCalculator } from './cost-calculator.js';

const DEFAULT_STEPS = [
  {
    id: 1,
    title: 'Concept & Trend Research',
    desc: 'Mood board creation, competitor analysis, and seasonal direction.',
    checklist: ['Curate mood boards & color palettes', 'Analyze target market trends for S-5XL', 'Select seasonal silhouette concepts', 'Check plus-size/older-women demand gaps in local market']
  },
  {
    id: 2,
    title: 'Design Sourcing & Adaptation',
    desc: 'Sourcing inspiration & adapting for LK weather/culture.',
    checklist: ['Evaluate tropical breathability', 'Ensure flattering fit for S to 5XL', 'Verify local fabric availability', 'Confirm modesty/cultural fit where relevant']
  },
  {
    id: 3,
    title: 'AI Technical Drawing & Spec Sheet',
    desc: 'Generate flat tech sketches and initial measurement charts.',
    checklist: ['Front & back flat visual', 'Seam and seam allowance callouts', 'Initial point-of-measurement (POM) table', 'Note fabric type & drape on spec sheet']
  },
  {
    id: 4,
    title: 'Technical Patterning & Grading',
    desc: 'Create master patterns and grade across S–5XL spectrum.',
    checklist: ['Grade bust/waist proportions proportionally', 'Verify armhole allowance for 3XL-5XL', 'Calculate initial fabric marker efficiency', "Confirm grading doesn't distort proportions at 4XL/5XL"]
  },
  {
    id: 5,
    title: 'Sampling & Fit Testing',
    desc: 'Fit sample creation, adjustments, and sign-off.',
    checklist: ['Test fit on actual plus-size models', 'Adjust drape, stretch points, and tension', 'Finalize pre-production sample (PPS)', 'Get fit feedback from a real plus-size/older customer, not just staff']
  },
  {
    id: 6,
    title: 'Photoshoot & Pre-Order Validation',
    desc: 'Shoot the 2 production samples, then validate demand before locking bulk quantities.',
    checklist: ['Produce 2 production samples (Medium & 2XL) for photoshoot', 'Shoot product photos/video on both samples', 'Include flat sketch, fabric swatch & size chart in content', 'Open pre-order/waitlist before finalizing bulk fabric quantities', 'Adjust per-size unit split based on pre-order demand']
  },
  {
    id: 7,
    title: 'Procurement (Fabric & Trims)',
    desc: 'Bulk sourcing of shell fabric, lining, zippers, and buttons.',
    checklist: ['Order production yardage with 5% buffer', 'Source quality zippers, thread & buttons', 'Inspect received fabric rolls for shrinkage/defects', 'Confirm accessory (button/zipper) sizing suits heavier fabrics if used']
  },
  {
    id: 8,
    title: 'Bulk Cutting & Production Preparation',
    desc: 'Marker laying, precision cutting, and bundling.',
    checklist: ['Prepare high-yield marker layouts', 'Bulk fabric cutting and component grouping', 'Distribute spec sheets to sewing line', 'Double-check size labels match bundle before sewing']
  },
  {
    id: 9,
    title: 'Assembly & In-Line QC',
    desc: 'Stitching, ironing, and quality assurance during production.',
    checklist: ['Check thread tension and seam strength', 'Verify size label & care tag accuracy', 'Perform end-of-line quality inspection', 'Check stress points (underarm, waist) hold up on larger sizes']
  },
  {
    id: 10,
    title: 'Finishing, Ironing & Packaging',
    desc: 'Final press, tagging, and eco-packaging.',
    checklist: ['Steam ironing and thread trimming', 'Attach hangtags and barcode stickers', 'Pack into protective poly/eco bags', 'Confirm packaging fits largest size without stretching']
  },
  {
    id: 11,
    title: 'E-Commerce & Launch Marketing',
    desc: 'Full-size-range photoshoot, listing, and launch campaign after bulk production.',
    checklist: ['Shoot full S-5XL model photos (post-bulk)', 'Upload product details to web store', 'Launch Instagram & Facebook teaser campaigns', 'Use real plus-size/older models in photos, not just standard sizing']
  }
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadWorkflowSteps() {
  try {
    const saved = JSON.parse(localStorage.getItem('yelina_workflow_steps') || 'null');
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map(step => ({
        ...step,
        checklist: Array.isArray(step.checklist) ? step.checklist : []
      }));
    }
  } catch (error) {
    console.warn('Failed to load workflow steps from localStorage', error);
  }

  return DEFAULT_STEPS.map(step => ({ ...step, checklist: [...step.checklist] }));
}

let STEPS = loadWorkflowSteps();
let designs = [];
let launchGroups = loadLaunchGroups();
let selectedDesignId = null;
let editingDesignId = null;
let editingLaunchId = null;
let expandedStepId = 1;
let db = null;
let selectedImagesBase64 = [];
const migratingDesignIds = new Set();

function loadLaunchGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem('yelina_launch_groups') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn('Failed to load launch groups from localStorage', error);
    return [];
  }
}

function saveLocalLaunchGroups() {
  try {
    localStorage.setItem('yelina_launch_groups', JSON.stringify(launchGroups));
  } catch (error) {
    console.warn('Failed to save launch groups to localStorage', error);
  }
}

const INJECTED_CONFIG = {
  apiKey: "ENV_FIREBASE_API_KEY",
  authDomain: "ENV_FIREBASE_PROJECT_ID.firebaseapp.com",
  projectId: "ENV_FIREBASE_PROJECT_ID",
  storageBucket: "ENV_FIREBASE_PROJECT_ID.appspot.com",
  messagingSenderId: "ENV_FIREBASE_SENDER_ID",
  appId: "ENV_FIREBASE_APP_ID"
};

function getConfig() {
  if (INJECTED_CONFIG.apiKey && !INJECTED_CONFIG.apiKey.startsWith("ENV_")) {
    return INJECTED_CONFIG;
  }
  if (window.NETLIFY_FIREBASE_CONFIG && window.NETLIFY_FIREBASE_CONFIG.apiKey) {
    return window.NETLIFY_FIREBASE_CONFIG;
  }
  const stored = localStorage.getItem('yelina_fb_cfg');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  return null;
}

function initDatabase() {
  const config = getConfig();

  if (config && config.apiKey && !config.apiKey.startsWith("ENV_")) {
    try {
      const app = initializeApp(config, "yelinaApp");
      db = getFirestore(app);

      let isInitialLaunchGroupSnapshot = true;
      onSnapshot(collection(db, 'yelina_launch_groups'), (snapshot) => {
        const cloudGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const localGroups = isInitialLaunchGroupSnapshot
          ? launchGroups.filter(group => !cloudGroups.some(cloudGroup => String(cloudGroup.id) === String(group.id)))
          : [];
        isInitialLaunchGroupSnapshot = false;
        launchGroups = [...cloudGroups, ...localGroups];
        localGroups.forEach(group => {
          setDoc(doc(db, 'yelina_launch_groups', group.id), group).then(() => {
            try {
              const cachedGroups = loadLaunchGroups().filter(item => String(item.id) !== String(group.id));
              localStorage.setItem('yelina_launch_groups', JSON.stringify(cachedGroups));
            } catch (error) {
              console.warn('Failed to clear synced launch group from local cache', error);
            }
          }, error => {
            console.error('Failed to sync local launch group to Firestore', error);
          });
        });
        renderLaunches();
        renderDesignSelector();
      }, (err) => {
        console.error('Firestore launch group listen error:', err);
        setOfflineState();
      });

      onSnapshot(collection(db, "yelina_launches"), (snapshot) => {
        designs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        migrateLegacyDesigns(designs);

        if (!selectedDesignId && designs.length > 0) {
          selectedDesignId = designs[0].id;
        } else if (selectedDesignId && !designs.some(l => l.id === selectedDesignId)) {
          selectedDesignId = designs[0]?.id || null;
        }

        renderDesignSelector();
        renderSteps();
        renderLaunches();
        renderTable();
      }, (err) => {
        console.error("Firestore Listen Error:", err);
        setOfflineState();
      });

      document.getElementById('sync-dot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
      document.getElementById('sync-text').innerText = 'Cloud Synced';
      document.getElementById('sync-status-btn').className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-medium shadow-sm';
    } catch (err) {
      console.error("Firebase Init Error:", err);
      setOfflineState();
    }
  } else {
    setOfflineState();
  }
}

function setOfflineState() {
  document.getElementById('sync-dot').className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
  document.getElementById('sync-text').innerText = 'Offline Local (Tap to Fix)';
  document.getElementById('sync-status-btn').className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium shadow-sm';
}

function migrateLegacyDesigns(currentDesigns) {
  if (!db) return;
  currentDesigns.filter(design => !design.launchId && !migratingDesignIds.has(design.id)).forEach(design => {
    migratingDesignIds.add(design.id);
    const launchId = `legacy-${design.id}`;
    const launchGroup = {
      name: `${design.name || design.code || 'Design'} Launch`,
      date: design.date || '',
      notes: '',
      migratedFromDesign: true
    };
    setDoc(doc(db, 'yelina_launch_groups', launchId), launchGroup, { merge: true })
      .then(() => updateDoc(doc(db, 'yelina_launches', design.id), { launchId }))
      .catch(error => console.error(`Failed to migrate design ${design.id} to a launch group`, error))
      .finally(() => migratingDesignIds.delete(design.id));
  });
}

function processImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.handleImageSelection = async (event) => {
  const files = Array.from(event.target.files);
  for (const file of files) {
    const base64 = await processImageFile(file);
    selectedImagesBase64.push(base64);
  }
  renderImagePreviews();
};

function renderImagePreviews() {
  const container = document.getElementById('image-preview-container');
  container.innerHTML = selectedImagesBase64.map((img, idx) => `
    <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-300 group">
      <img src="${img}" class="w-full h-full object-cover cursor-pointer" onclick="openLightbox('${img}', 'Preview Image')">
      <button onclick="removeImage(${idx})" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow">✕</button>
    </div>
  `).join('');
}

window.removeImage = (idx) => {
  selectedImagesBase64.splice(idx, 1);
  renderImagePreviews();
};

window.openLightbox = (imgSrc, caption = '') => {
  const modal = document.getElementById('modal-lightbox');
  document.getElementById('lightbox-img').src = imgSrc;
  document.getElementById('lightbox-caption').innerText = caption;
  modal.classList.remove('hidden');
};

window.closeLightbox = () => {
  document.getElementById('modal-lightbox').classList.add('hidden');
};

window.switchTab = (tab) => {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`view-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'font-semibold'));
  document.getElementById(`tab-${tab}`).classList.add('bg-white', 'shadow-sm', 'font-semibold');
};

window.toggleSettingsSection = (contentId, button) => {
  const content = document.getElementById(contentId);
  const expanded = button.getAttribute('aria-expanded') === 'true';
  const sectionName = contentId === 'workflow-settings-content' ? 'Workflow Process Settings' : 'Vendor Settings';
  content.classList.toggle('hidden', expanded);
  button.setAttribute('aria-expanded', String(!expanded));
  button.setAttribute('aria-label', `${expanded ? 'Expand' : 'Collapse'} ${sectionName}`);
  button.title = `${expanded ? 'Expand' : 'Collapse'} ${sectionName}`;
  button.innerText = expanded ? '▼' : '▲';
};

function renderAdminSteps() {
  const container = document.getElementById('admin-steps-container');
  if (!container) return;

  container.innerHTML = STEPS.map((step, index) => `
    <div class="border border-stone-200 rounded-2xl p-4 bg-stone-50">
      <div class="flex justify-between items-center mb-3">
        <div class="font-semibold text-stone-800">Process ${index + 1}</div>
        <button onclick="removeWorkflowStep(${step.id})" class="text-xs text-red-600 hover:text-red-700 font-medium">
          Remove
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-xs font-semibold uppercase text-stone-600 block mb-1">Title</label>
          <input value="${escapeHtml(step.title)}" oninput="updateWorkflowField(${step.id}, 'title', this.value)"
            class="w-full p-2.5 border border-stone-300 rounded-xl text-sm" />
        </div>

        <div>
          <label class="text-xs font-semibold uppercase text-stone-600 block mb-1">Description</label>
          <textarea rows="2" oninput="updateWorkflowField(${step.id}, 'desc', this.value)"
            class="w-full p-2.5 border border-stone-300 rounded-xl text-sm">${escapeHtml(step.desc)}</textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold uppercase text-stone-600">Checklist</label>
            <button onclick="addWorkflowChecklistItem(${step.id})" class="text-xs text-brand-goldDark font-medium">
              + Add item
            </button>
          </div>

          <div class="space-y-2">
            ${(step.checklist && step.checklist.length ? step.checklist : ['']).map((item, itemIndex) => `
              <div class="flex gap-2 items-center">
                <input value="${escapeHtml(item)}" oninput="updateWorkflowChecklistItem(${step.id}, ${itemIndex}, this.value)"
                  class="w-full p-2 border border-stone-300 rounded-xl text-sm" />
                <button onclick="removeWorkflowChecklistItem(${step.id}, ${itemIndex})" class="text-stone-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

window.updateWorkflowField = (id, field, value) => {
  const step = STEPS.find(item => item.id === id);
  if (!step) return;
  step[field] = value;
};

window.updateWorkflowChecklistItem = (id, itemIndex, value) => {
  const step = STEPS.find(item => item.id === id);
  if (!step || !Array.isArray(step.checklist)) return;
  step.checklist[itemIndex] = value;
};

window.addWorkflowChecklistItem = (id) => {
  const step = STEPS.find(item => item.id === id);
  if (!step) return;
  step.checklist.push('New checklist item');
  renderAdminSteps();
};

window.removeWorkflowChecklistItem = (id, itemIndex) => {
  const step = STEPS.find(item => item.id === id);
  if (!step || !Array.isArray(step.checklist)) return;
  step.checklist.splice(itemIndex, 1);
  if (step.checklist.length === 0) {
    step.checklist = ['Add a checklist item'];
  }
  renderAdminSteps();
};

window.addWorkflowStep = () => {
  const newStep = {
    id: Date.now(),
    title: 'New Workflow Process',
    desc: 'Describe this stage in the production workflow.',
    checklist: ['Add checklist item']
  };
  STEPS.push(newStep);
  renderAdminSteps();
};

window.removeWorkflowStep = (id) => {
  if (STEPS.length <= 1) {
    alert('At least one workflow process must remain.');
    return;
  }
  STEPS = STEPS.filter(step => step.id !== id);
  renderAdminSteps();
};

window.saveWorkflowChanges = () => {
  const cleaned = STEPS.map(step => ({
    id: Number(step.id) || Date.now() + Math.random(),
    title: String(step.title || 'Untitled Process').trim() || 'Untitled Process',
    desc: String(step.desc || '').trim(),
    checklist: Array.isArray(step.checklist) ? step.checklist.filter(item => item && String(item).trim()).map(item => String(item).trim()) : []
  }));

  STEPS = cleaned;
  localStorage.setItem('yelina_workflow_steps', JSON.stringify(STEPS));
  renderSteps();
  renderLaunches();
  renderTable();
  renderAdminSteps();
  alert('Workflow saved successfully.');
};

window.toggleStepInline = (id) => {
  expandedStepId = expandedStepId === id ? null : id;
  renderSteps();
};

window.changeSelectedDesign = (id) => {
  selectedDesignId = id;
  renderSteps();
};

function calculateStage(tasks) {
  if (!tasks) return 1;
  let highest = 1;
  for (let s of STEPS) {
    const allDone = s.checklist.every((_, idx) => !!tasks[`${s.id}_${idx}`]);
    if (allDone) {
      highest = Math.min(s.id + 1, 7);
    } else {
      break;
    }
  }
  return highest;
}

window.toggleChecklistItem = async (stepId, index) => {
  if (!selectedDesignId) return;
  const design = designs.find(l => l.id === selectedDesignId);
  if (!design) return;

  if (!design.completedTasks) design.completedTasks = {};
  const key = `${stepId}_${index}`;
  design.completedTasks[key] = !design.completedTasks[key];

  design.stage = calculateStage(design.completedTasks);

  if (db) {
    await updateDoc(doc(db, "yelina_launches", design.id), {
      completedTasks: design.completedTasks,
      stage: design.stage
    });
  } else {
    renderSteps();
    renderLaunches();
    renderTable();
  }
};

window.deleteDesign = async (id) => {
  if (!confirm("Are you sure you want to delete this design?")) return;
  if (db) {
    await deleteDoc(doc(db, "yelina_launches", id));
  } else {
    designs = designs.filter(l => l.id !== id);
    if (selectedDesignId === id) selectedDesignId = designs[0]?.id || null;
    renderDesignSelector();
    renderSteps();
    renderLaunches();
    renderTable();
  }
};

window.openLaunchModal = (id = null) => {
  const launch = launchGroups.find(item => item.id === id);
  editingLaunchId = launch?.id || null;
  document.getElementById('launch-modal-title').innerText = launch ? 'Edit Launch' : 'Create Launch';
  document.getElementById('launch-name').value = launch?.name || '';
  document.getElementById('launch-release-date').value = launch?.date || '';
  document.getElementById('launch-notes').value = launch?.notes || '';
  document.getElementById('modal-launch').classList.remove('hidden');
  document.getElementById('launch-name').focus();
};

window.closeLaunchModal = () => {
  document.getElementById('modal-launch').classList.add('hidden');
  editingLaunchId = null;
};

window.saveLaunchGroup = async (event) => {
  event.preventDefault();
  const name = document.getElementById('launch-name').value.trim();
  const date = document.getElementById('launch-release-date').value;
  if (!name || !date) return;

  const group = {
    name,
    date,
    notes: document.getElementById('launch-notes').value.trim()
  };

  if (editingLaunchId) {
    if (db) {
      await updateDoc(doc(db, 'yelina_launch_groups', editingLaunchId), group);
    } else {
      launchGroups = launchGroups.map(item => item.id === editingLaunchId ? { ...item, ...group } : item);
      saveLocalLaunchGroups();
      renderLaunches();
    }
  } else if (db) {
    await addDoc(collection(db, 'yelina_launch_groups'), group);
  } else {
    launchGroups.push({ id: String(Date.now()), ...group });
    saveLocalLaunchGroups();
    renderLaunches();
    renderDesignSelector();
  }
  closeLaunchModal();
};

window.deleteLaunchGroup = async (id) => {
  const launch = launchGroups.find(item => item.id === id);
  if (!launch) return;
  if (designs.some(design => design.launchId === id)) {
    alert('Move or remove this launch’s designs before deleting the launch.');
    return;
  }
  if (!confirm(`Delete the ${launch.name} launch?`)) return;
  if (db) {
    await deleteDoc(doc(db, 'yelina_launch_groups', id));
  } else {
    launchGroups = launchGroups.filter(item => item.id !== id);
    saveLocalLaunchGroups();
    renderLaunches();
    renderDesignSelector();
  }
};

function renderDesignLaunchOptions(selectedLaunchId = '') {
  const select = document.getElementById('design-launch-select');
  select.innerHTML = launchGroups.map(launch =>
    `<option value="${escapeHtml(launch.id)}">${escapeHtml(launch.name)} · ${escapeHtml(launch.date || 'Date not set')}</option>`
  ).join('');
  select.disabled = launchGroups.length === 0;
  select.value = launchGroups.some(launch => launch.id === selectedLaunchId) ? selectedLaunchId : launchGroups[0]?.id || '';
}

window.openConfigModal = () => document.getElementById('modal-config').classList.remove('hidden');
window.closeConfigModal = () => document.getElementById('modal-config').classList.add('hidden');

window.openAddModal = (launchId = '') => {
  if (launchGroups.length === 0) {
    alert('Create a launch before adding designs.');
    switchTab('pipeline');
    return;
  }
  editingDesignId = null;
  document.getElementById('modal-title').innerText = "Add New Garment Design";
  document.getElementById('add-name').value = '';
  document.getElementById('add-fabric').value = '';
  document.getElementById('add-cost').value = '';
  renderDesignLaunchOptions(launchId);
  selectedImagesBase64 = [];
  renderImagePreviews();
  document.getElementById('modal-add').classList.remove('hidden');
};

window.openEditModal = (id) => {
  const design = designs.find(l => l.id === id);
  if (!design) return;

  editingDesignId = id;
  document.getElementById('modal-title').innerText = `Edit Design: ${design.code}`;
  document.getElementById('add-name').value = design.name || '';
  document.getElementById('add-fabric').value = design.fabric || '';
  document.getElementById('add-cost').value = design.cost || '';
  renderDesignLaunchOptions(design.launchId);

  selectedImagesBase64 = [...(design.images || [])];
  renderImagePreviews();
  document.getElementById('modal-add').classList.remove('hidden');
};

window.closeAddModal = () => {
  document.getElementById('modal-add').classList.add('hidden');
  editingDesignId = null;
  selectedImagesBase64 = [];
  renderImagePreviews();
};

window.saveManualFirebaseConfig = () => {
  const input = document.getElementById('cfg-input').value.trim();
  try {
    const cfgObj = JSON.parse(input);
    localStorage.setItem('yelina_fb_cfg', JSON.stringify(cfgObj));
    location.reload();
  } catch (err) {
    alert("Invalid JSON format. Please paste a valid Firebase configuration JSON object.");
  }
};

window.saveDesign = async () => {
  const name = document.getElementById('add-name').value;
  const fabric = document.getElementById('add-fabric').value;
  const cost = Number(document.getElementById('add-cost').value);
  const launchId = document.getElementById('design-launch-select').value;
  if (!launchId) {
    alert('Select a launch for this design.');
    return;
  }

  if (editingDesignId) {
    const design = designs.find(l => l.id === editingDesignId);
    if (design) {
      const updatedFields = {
        name: name || design.name,
        fabric: fabric || design.fabric,
        cost: cost || design.cost,
        launchId,
        images: selectedImagesBase64
      };

      if (db) {
        await updateDoc(doc(db, "yelina_launches", editingDesignId), updatedFields);
      } else {
        Object.assign(design, updatedFields);
        renderDesignSelector();
        renderSteps();
        renderLaunches();
        renderTable();
      }
    }
  } else {
    const newDoc = {
      code: `YEL-0${designs.length + 1}`,
      name: name || 'New Garment Design',
      fabric: fabric || 'Cotton Blend',
      cost: cost || 3000,
      launchId,
      stage: 1,
      completedTasks: {},
      images: selectedImagesBase64
    };

    if (db) {
      const docRef = await addDoc(collection(db, "yelina_launches"), newDoc);
      selectedDesignId = docRef.id;
    } else {
      const id = String(Date.now());
      designs.push({ id, ...newDoc });
      selectedDesignId = id;
      renderDesignSelector();
      renderSteps();
      renderLaunches();
      renderTable();
    }
  }

  closeAddModal();
};

function renderDesignSelector() {
  const sel = document.getElementById('design-selector');
  if (designs.length === 0) {
    sel.innerHTML = '<option value="">No designs added yet</option>';
    refreshCostCalculator();
    return;
  }
  sel.innerHTML = designs.map(l => `<option value="${l.id}" ${l.id === selectedDesignId ? 'selected' : ''}>${l.code} - ${l.name}</option>`).join('');
  refreshCostCalculator();
}

function renderSteps() {
  const container = document.getElementById('steps-grid');
  const activeDesign = designs.find(l => l.id === selectedDesignId);
  const tasks = activeDesign?.completedTasks || {};

  container.innerHTML = STEPS.map(s => {
    const isExpanded = expandedStepId === s.id;
    const completedCount = s.checklist.filter((_, idx) => !!tasks[`${s.id}_${idx}`]).length;
    const totalCount = s.checklist.length;
    const isStepComplete = completedCount === totalCount && totalCount > 0;
    const isStepInProgress = completedCount > 0 && !isStepComplete;
    const statusText = isStepComplete ? 'Completed' : isStepInProgress ? 'In Progress' : 'Not Started';
    const badgeClasses = isStepComplete ? 'bg-emerald-100 text-emerald-800' : isStepInProgress ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700';
    const iconBg = isStepComplete ? 'bg-emerald-600' : isStepInProgress ? 'bg-amber-500' : 'bg-stone-400';
    const cardClass = isStepComplete ? 'bg-emerald-50 border-emerald-500 shadow-sm' : isStepInProgress ? 'bg-amber-50/60 border-amber-400 shadow-sm' : 'bg-stone-50 border-stone-200 hover:bg-stone-100';

    let stepCardClass = "p-4 border rounded-xl cursor-pointer transition flex items-center justify-between ";
    stepCardClass += cardClass;
    if (!isStepComplete && !isStepInProgress && isExpanded) {
      stepCardClass += ' bg-amber-50/30 border-brand-gold';
    }

    return `
      <div class="col-span-1 md:col-span-2 lg:col-span-4 transition-all">
        <div onclick="toggleStepInline(${s.id})" class="${stepCardClass}">
          <div class="flex items-center space-x-3">
            <span class="w-7 h-7 rounded-full ${iconBg} text-white text-xs font-bold flex items-center justify-center shadow-sm">
              ${isStepComplete ? '✓' : s.id}
            </span>
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-stone-900 text-sm">${s.title}</h4>
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeClasses}">${statusText}</span>
              </div>
              <p class="text-xs text-stone-500">${s.desc}</p>
            </div>
          </div>
          <span class="text-stone-400 font-bold text-sm">${isExpanded ? '▲' : '▼'}</span>
        </div>

        ${isExpanded ? `
          <div class="mt-2 p-5 bg-stone-900 text-white rounded-xl border border-stone-800 space-y-3 shadow-lg">
            <div class="flex justify-between items-center border-b border-stone-800 pb-2">
              <span class="text-xs font-semibold text-brand-gold uppercase tracking-wider">Step ${s.id} Checklist for:${activeDesign ? activeDesign.name : 'Selected Design'}</span>
              <span class="text-xs text-stone-400">Click item to toggle completion</span>
            </div>
            <div class="space-y-2">
              ${s.checklist.map((c, idx) => {
                const isDone = !!tasks[`${s.id}_${idx}`];
                return `
                  <label onclick="toggleChecklistItem(${s.id}, ${idx})" class="flex items-center space-x-3 p-2 rounded-lg bg-stone-800/60 hover:bg-stone-800 cursor-pointer transition text-sm">
                    <input type="checkbox" ${isDone ? 'checked' : ''} class="w-4 h-4 accent-emerald-500 rounded">
                    <span class="${isDone ? 'line-through text-stone-400' : 'text-stone-200'}">${c}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderLaunches() {
  const container = document.getElementById('launch-groups-container');
  if (!container) return;
  if (launchGroups.length === 0) {
    container.innerHTML = '<div class="bg-white border border-dashed border-stone-300 rounded-xl py-12 text-center"><p class="font-semibold text-stone-700">No launches yet</p><p class="mt-1 text-sm text-stone-500">Create a launch, then add the designs that will be released together.</p></div>';
    return;
  }
  container.innerHTML = launchGroups.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(launch => {
    const launchDesigns = designs.filter(design => design.launchId === launch.id);
    return `
      <article class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <header class="flex flex-col lg:flex-row lg:items-start justify-between gap-4 p-5 border-b border-stone-200">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="font-serif text-xl font-bold text-stone-900">${escapeHtml(launch.name)}</h3>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">Release ${escapeHtml(launch.date || 'Date not set')}</span>
            </div>
            ${launch.notes ? `<p class="mt-2 text-sm text-stone-600 whitespace-pre-wrap">${escapeHtml(launch.notes)}</p>` : ''}
            <p class="mt-2 text-xs text-stone-500">${launchDesigns.length} design${launchDesigns.length === 1 ? '' : 's'} in this launch</p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <button onclick="openAddModal('${escapeHtml(launch.id)}')" class="px-3 py-2 rounded-lg bg-brand-gold text-white text-sm font-medium hover:bg-brand-goldDark">+ Add Design</button>
            <button onclick="openLaunchModal('${escapeHtml(launch.id)}')" class="px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-700 hover:bg-stone-100">Edit Launch</button>
            <button onclick="deleteLaunchGroup('${escapeHtml(launch.id)}')" class="px-3 py-2 rounded-lg border border-red-200 text-sm text-red-700 hover:bg-red-50">Delete</button>
          </div>
        </header>
        <div class="divide-y divide-stone-100">
          ${launchDesigns.length ? launchDesigns.map(design => {
            const done = STEPS.reduce((count, step) => count + step.checklist.filter((_, index) => !!design.completedTasks?.[`${step.id}_${index}`]).length, 0);
            const total = STEPS.reduce((count, step) => count + step.checklist.length, 0);
            const progress = total ? Math.round(done / total * 100) : 0;
            return `
              <div class="flex flex-col lg:flex-row lg:items-center gap-3 p-4">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-mono font-bold text-brand-goldDark">${escapeHtml(design.code)}</span>
                    <h4 class="font-semibold text-stone-900">${escapeHtml(design.name)}</h4>
                  </div>
                  <p class="mt-1 text-xs text-stone-500">${escapeHtml(design.fabric || 'Fabric not set')} · ${progress}% production progress · ${STEPS.find(step => step.id === design.stage)?.title || 'In Development'}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-semibold text-stone-700">LKR ${Number(design.calculatedUnitCost ?? design.cost ?? 0).toLocaleString()}</span>
                  <button onclick="changeSelectedDesign('${escapeHtml(design.id)}'); switchTab('workflow')" class="px-3 py-1.5 rounded-lg border border-stone-300 text-sm text-stone-700 hover:bg-stone-100">Workflow</button>
                  <button onclick="openEditModal('${escapeHtml(design.id)}')" aria-label="Edit ${escapeHtml(design.name)}" title="Edit design" class="w-9 h-9 rounded-lg text-stone-500 hover:bg-stone-100">✎</button>
                  <button onclick="deleteDesign('${escapeHtml(design.id)}')" aria-label="Delete ${escapeHtml(design.name)}" title="Delete design" class="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50">×</button>
                </div>
              </div>
            `;
          }).join('') : '<p class="p-5 text-sm text-stone-500">No designs in this launch yet.</p>'}
        </div>
      </article>
    `;
  }).join('');
}

function renderTable() {
  const tbody = document.getElementById('database-tbody');
  if (designs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="p-6 text-center text-stone-400">Database is empty. Add designs to a launch.</td></tr>';
    return;
  }
  tbody.innerHTML = designs.map(l => `
    <tr class="hover:bg-stone-50 transition">
      <td class="p-3">
        ${l.images && l.images[0] ? `
          <img src="${l.images[0]}" onclick="openLightbox('${l.images[0]}', '${l.code} -${l.name}')" class="w-10 h-10 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-80 transition">
        ` : `<div class="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] text-stone-400">No img</div>`}
      </td>
      <td class="p-3 font-mono text-xs font-bold text-brand-goldDark">${l.code}</td>
      <td class="p-3 font-semibold text-stone-900">${l.name}</td>
      <td class="p-3 text-xs"><span class="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-medium">Step ${l.stage}: ${STEPS.find(s => s.id === l.stage)?.title}</span></td>
      <td class="p-3 text-stone-600">${escapeHtml(launchGroups.find(launch => launch.id === l.launchId)?.name || 'Unassigned')}</td>
      <td class="p-3 text-stone-600">${l.fabric}</td>
      <td class="p-3 text-stone-900">LKR ${Number(l.cost ?? 0).toLocaleString()}</td>
      <td class="p-3 text-stone-900 font-medium">${l.calculatedUnitCost == null ? '—' : `LKR ${Number(l.calculatedUnitCost).toLocaleString()}`}</td>
      <td class="p-3 text-stone-500 text-xs">${escapeHtml(launchGroups.find(launch => launch.id === l.launchId)?.date || '')}</td>
      <td class="p-3 text-right space-x-2">
        <button onclick="openEditModal('${l.id}')" title="Edit Design" class="text-stone-500 hover:text-stone-900 font-bold">✏️</button>
        <button onclick="deleteDesign('${l.id}')" title="Delete Design" class="text-stone-400 hover:text-red-600 font-bold">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.exportCSV = () => {
  const csvContent = "data:text/csv;charset=utf-8," + [
    "Code,Name,Launch,Stage,Fabric,Estimated_Cost_LKR,Calculated_Cost_LKR,Release_Date",
    ...designs.map(design => {
      const launch = launchGroups.find(item => item.id === design.launchId);
      return `${design.code},"${design.name}","${launch?.name || ''}",${design.stage},"${design.fabric}",${design.cost},${design.calculatedUnitCost ?? ''},${launch?.date || ''}`;
    })
  ].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "yelina_master_designs.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

initDatabase();
initializeVendorManager();
initializeCalendar(() => designs, () => db, () => launchGroups);
initializeCostCalculator(() => designs, async (designId, costBreakdown, calculatedUnitCost) => {
  const design = designs.find(item => String(item.id) === String(designId));
  if (!design) throw new Error('The selected design is no longer available.');
  if (db) {
    await updateDoc(doc(db, 'yelina_launches', designId), { costBreakdown, calculatedUnitCost });
  }
  design.costBreakdown = costBreakdown;
  design.calculatedUnitCost = calculatedUnitCost;
  renderLaunches();
  renderTable();
});
renderAdminSteps();
renderSteps();
renderLaunches();
renderTable();
