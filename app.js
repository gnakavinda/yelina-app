import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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
let launches = [];
let selectedDesignId = null;
let editingDesignId = null;
let expandedStepId = 1;
let db = null;
let selectedImagesBase64 = [];

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

      onSnapshot(collection(db, "yelina_launches"), (snapshot) => {
        launches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!selectedDesignId && launches.length > 0) {
          selectedDesignId = launches[0].id;
        } else if (selectedDesignId && !launches.some(l => l.id === selectedDesignId)) {
          selectedDesignId = launches[0]?.id || null;
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
  const design = launches.find(l => l.id === selectedDesignId);
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
    launches = launches.filter(l => l.id !== id);
    if (selectedDesignId === id) selectedDesignId = launches[0]?.id || null;
    renderDesignSelector();
    renderSteps();
    renderLaunches();
    renderTable();
  }
};

window.openConfigModal = () => document.getElementById('modal-config').classList.remove('hidden');
window.closeConfigModal = () => document.getElementById('modal-config').classList.add('hidden');

window.openAddModal = () => {
  editingDesignId = null;
  document.getElementById('modal-title').innerText = "Add New Garment Design";
  document.getElementById('add-name').value = '';
  document.getElementById('add-fabric').value = '';
  document.getElementById('add-cost').value = '';
  document.getElementById('add-date').value = '';
  selectedImagesBase64 = [];
  renderImagePreviews();
  document.getElementById('modal-add').classList.remove('hidden');
};

window.openEditModal = (id) => {
  const design = launches.find(l => l.id === id);
  if (!design) return;

  editingDesignId = id;
  document.getElementById('modal-title').innerText = `Edit Design: ${design.code}`;
  document.getElementById('add-name').value = design.name || '';
  document.getElementById('add-fabric').value = design.fabric || '';
  document.getElementById('add-cost').value = design.cost || '';
  document.getElementById('add-date').value = design.date || '';

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
  const date = document.getElementById('add-date').value;

  if (editingDesignId) {
    const design = launches.find(l => l.id === editingDesignId);
    if (design) {
      const updatedFields = {
        name: name || design.name,
        fabric: fabric || design.fabric,
        cost: cost || design.cost,
        date: date || design.date,
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
      code: `YEL-0${launches.length + 1}`,
      name: name || 'New Garment Design',
      fabric: fabric || 'Cotton Blend',
      cost: cost || 3000,
      date: date || '2026-12-01',
      stage: 1,
      completedTasks: {},
      images: selectedImagesBase64
    };

    if (db) {
      const docRef = await addDoc(collection(db, "yelina_launches"), newDoc);
      selectedDesignId = docRef.id;
    } else {
      const id = String(Date.now());
      launches.push({ id, ...newDoc });
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
  if (launches.length === 0) {
    sel.innerHTML = '<option value="">No designs added yet</option>';
    return;
  }
  sel.innerHTML = launches.map(l => `<option value="${l.id}" ${l.id === selectedDesignId ? 'selected' : ''}>${l.code} - ${l.name}</option>`).join('');
}

function renderSteps() {
  const container = document.getElementById('steps-grid');
  const activeDesign = launches.find(l => l.id === selectedDesignId);
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
  const container = document.getElementById('pipeline-cards');
  if (launches.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-center py-12 text-stone-400">No active launches. Click "+ Add New Design" to start.</div>';
    return;
  }
  container.innerHTML = launches.map(l => {
    const totalCompleted = STEPS.reduce((acc, s) => {
      const done = s.checklist.filter((_, idx) => !!l.completedTasks?.[`${s.id}_${idx}`]).length;
      return acc + done;
    }, 0);
    const totalChecklistItems = STEPS.reduce((acc, s) => acc + s.checklist.length, 0);
    const progressPct = Math.round((totalCompleted / totalChecklistItems) * 100);

    return `
      <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3 relative group flex flex-col justify-between">
        <div class="space-y-3">
          ${l.images && l.images.length > 0 ? `
            <div class="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              ${l.images.map(img => `<img src="${img}" onclick="openLightbox('${img}', '${l.code} - ${l.name}')" class="w-20 h-20 object-cover rounded-xl border border-stone-200 shadow-sm flex-shrink-0 cursor-pointer hover:opacity-90 transition">`).join('')}
            </div>
          ` : ''}

          <div class="flex justify-between items-start">
            <span class="text-xs font-mono font-bold text-brand-goldDark bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">${l.code}</span>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-medium text-stone-500">Target: ${l.date}</span>
              <button onclick="openEditModal('${l.id}')" title="Edit Design Block" class="text-stone-400 hover:text-brand-goldDark transition text-sm font-bold">✏️</button>
              <button onclick="deleteDesign('${l.id}')" title="Delete Design" class="text-stone-400 hover:text-red-600 transition text-sm font-bold">🗑️</button>
            </div>
          </div>
          <h3 class="font-serif font-bold text-lg text-stone-900">${l.name}</h3>
          <div class="text-xs text-stone-600 space-y-1">
            <div><span class="font-semibold">Fabric:</span> ${l.fabric}</div>
            <div><span class="font-semibold">Est. Unit Cost:</span> LKR ${l.cost}</div>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-semibold text-stone-600">
              <span>Overall Progress</span>
              <span>${progressPct}%</span>
            </div>
            <div class="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
              <div class="bg-brand-gold h-2 rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
            </div>
          </div>

          <div class="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span class="text-xs font-semibold text-stone-700">Stage ${l.stage}/${STEPS.length}</span>
            <span class="text-xs px-2.5 py-1 bg-stone-100 text-stone-800 font-medium rounded-lg">${STEPS.find(s => s.id === l.stage)?.title || 'In Development'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTable() {
  const tbody = document.getElementById('database-tbody');
  if (launches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-stone-400">Database is empty. Add designs in the Launch Tracker.</td></tr>';
    return;
  }
  tbody.innerHTML = launches.map(l => `
    <tr class="hover:bg-stone-50 transition">
      <td class="p-3">
        ${l.images && l.images[0] ? `
          <img src="${l.images[0]}" onclick="openLightbox('${l.images[0]}', '${l.code} -${l.name}')" class="w-10 h-10 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-80 transition">
        ` : `<div class="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] text-stone-400">No img</div>`}
      </td>
      <td class="p-3 font-mono text-xs font-bold text-brand-goldDark">${l.code}</td>
      <td class="p-3 font-semibold text-stone-900">${l.name}</td>
      <td class="p-3 text-xs"><span class="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-medium">Step ${l.stage}: ${STEPS.find(s => s.id === l.stage)?.title}</span></td>
      <td class="p-3 text-stone-600">${l.fabric}</td>
      <td class="p-3 text-stone-900 font-medium">LKR ${l.cost}</td>
      <td class="p-3 text-stone-500 text-xs">${l.date}</td>
      <td class="p-3 text-right space-x-2">
        <button onclick="openEditModal('${l.id}')" title="Edit Design" class="text-stone-500 hover:text-stone-900 font-bold">✏️</button>
        <button onclick="deleteDesign('${l.id}')" title="Delete Design" class="text-stone-400 hover:text-red-600 font-bold">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.exportCSV = () => {
  const csvContent = "data:text/csv;charset=utf-8," + [
    "Code,Name,Stage,Fabric,Cost_LKR,Target_Date",
    ...launches.map(l => `${l.code},"${l.name}",${l.stage},"${l.fabric}",${l.cost},${l.date}`)
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
renderAdminSteps();
renderSteps();
renderLaunches();
renderTable();
