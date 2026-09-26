function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const CALENDAR_TASK_COLORS = {
  gold: { label: 'Gold', background: '#FAF1DD', border: '#C5A059', foreground: '#5F4B21' },
  blue: { label: 'Blue', background: '#E5F2F7', border: '#3F829F', foreground: '#275467' },
  green: { label: 'Green', background: '#E8F4EC', border: '#4D8D63', foreground: '#2C5A3A' },
  rose: { label: 'Rose', background: '#F8EAED', border: '#BC6271', foreground: '#713B45' },
  violet: { label: 'Violet', background: '#EFEAF6', border: '#8065A3', foreground: '#4D3B63' },
  slate: { label: 'Slate', background: '#ECEFF1', border: '#6B7680', foreground: '#414A50' }
};

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function loadCalendarTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem('yelina_calendar_tasks') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn('Failed to load calendar tasks from localStorage', error);
    return [];
  }
}

let calendarTasks = loadCalendarTasks();
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let editingCalendarTaskId = null;
let selectedCalendarTaskColor = 'gold';
let getLaunches = () => [];

function saveCalendarTasks(nextTasks) {
  try {
    localStorage.setItem('yelina_calendar_tasks', JSON.stringify(nextTasks));
    calendarTasks = nextTasks;
    return true;
  } catch (error) {
    alert('Unable to save calendar tasks in this browser. Check available storage and try again.');
    return false;
  }
}

function getLaunchOptions() {
  const launches = getLaunches();
  return Array.isArray(launches) ? launches : [];
}

function renderDesignOptions(selectedId = '') {
  const select = document.getElementById('calendar-task-design');
  const launches = getLaunchOptions();
  select.innerHTML = '<option value="">No related design</option>' + launches.map(launch =>
    `<option value="${escapeHtml(launch.id)}">${escapeHtml(launch.code ? `${launch.code} - ${launch.name}` : launch.name || 'Untitled design')}</option>`
  ).join('');
  select.value = launches.some(launch => String(launch.id) === String(selectedId)) ? selectedId : '';
}

function renderTaskColorOptions() {
  const container = document.getElementById('calendar-task-colors');
  container.innerHTML = Object.entries(CALENDAR_TASK_COLORS).map(([key, color]) => {
    const selected = key === selectedCalendarTaskColor;
    return `<button type="button" onclick="selectCalendarTaskColor('${key}')" aria-label="${color.label} task color" title="${color.label}" aria-pressed="${selected}"
      style="--task-swatch-color:${color.border}; background-color:${color.background}; color:${color.foreground};"
      class="calendar-color-swatch w-8 h-8 rounded-full border-2 border-transparent flex items-center justify-center text-xs font-bold">${selected ? '✓' : ''}</button>`;
  }).join('');
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const today = dateKey(new Date());
  const monthLabel = document.getElementById('calendar-month-label');
  monthLabel.textContent = calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = dateKey(day);
    const isCurrentMonth = day.getMonth() === month;
    const isToday = key === today;
    const dayTasks = calendarTasks
      .filter(task => task.date === key)
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
    const classes = [
      'min-h-[132px] p-2 border-r border-b border-stone-200 flex flex-col gap-1.5',
      isCurrentMonth ? 'bg-white' : 'bg-stone-50/70',
      isToday ? 'ring-2 ring-inset ring-brand-gold' : ''
    ].filter(Boolean).join(' ');

    const taskItems = dayTasks.map(task => {
      const launchName = task.designName || getLaunchOptions().find(launch => String(launch.id) === String(task.designId))?.name;
      const color = CALENDAR_TASK_COLORS[task.color] || CALENDAR_TASK_COLORS.gold;
      return `
        <button type="button" onclick="openCalendarTaskModal('', '${escapeHtml(task.id)}')" title="${escapeHtml(task.title)}${task.notes ? ` - ${escapeHtml(task.notes)}` : ''}"
          style="--task-background:${color.background}; --task-border:${color.border}; --task-foreground:${color.foreground};"
          class="calendar-task-chip w-full text-left rounded-md px-2 py-1 text-xs leading-4 border-l-2 hover:brightness-95 ${task.completed ? 'opacity-60 line-through' : ''}">
          <span class="block truncate">${task.completed ? '✓ ' : ''}${task.time ? `${escapeHtml(task.time)} · ` : ''}${escapeHtml(task.title)}</span>
          ${launchName ? `<span class="block truncate text-[10px] text-stone-500">${escapeHtml(launchName)}</span>` : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="${classes}" aria-label="${day.toLocaleDateString(undefined, { dateStyle: 'full' })}">
        <div class="flex items-center justify-between gap-1">
          <button type="button" onclick="openCalendarTaskModal('${key}')" aria-label="Plan a task for ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}"
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isToday ? 'bg-brand-gold text-white' : isCurrentMonth ? 'text-stone-800 hover:bg-stone-100' : 'text-stone-400 hover:bg-stone-200'}">${day.getDate()}</button>
          <button type="button" onclick="openCalendarTaskModal('${key}')" aria-label="Add task on ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100">+</button>
        </div>
        <div class="max-h-[88px] overflow-y-auto space-y-1 scrollbar-thin">${taskItems}</div>
      </div>
    `;
  });

  grid.innerHTML = dayCells.join('');
  const monthTasks = calendarTasks.filter(task => {
    const taskDate = dateFromKey(task.date);
    return taskDate.getFullYear() === year && taskDate.getMonth() === month;
  });
  const openTasks = monthTasks.filter(task => !task.completed).length;
  document.getElementById('calendar-task-summary').textContent = `${monthTasks.length} task${monthTasks.length === 1 ? '' : 's'} this month · ${openTasks} remaining`;
}

window.shiftCalendarMonth = (amount) => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
  renderCalendar();
};

window.goToCalendarToday = () => {
  const now = new Date();
  calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
};

window.openCalendarTaskModal = (date = '', taskId = null) => {
  const task = calendarTasks.find(item => item.id === taskId);
  editingCalendarTaskId = task?.id || null;
  selectedCalendarTaskColor = CALENDAR_TASK_COLORS[task?.color] ? task.color : 'gold';
  document.getElementById('calendar-task-modal-title').textContent = task ? 'Edit Launch Task' : 'Add Launch Task';
  document.getElementById('calendar-task-title').value = task?.title || '';
  document.getElementById('calendar-task-date').value = task?.date || date || dateKey(new Date());
  document.getElementById('calendar-task-time').value = task?.time || '';
  document.getElementById('calendar-task-notes').value = task?.notes || '';
  document.getElementById('calendar-task-completed').checked = !!task?.completed;
  document.getElementById('calendar-task-completed-wrap').classList.toggle('hidden', !task);
  document.getElementById('calendar-task-remove').classList.toggle('hidden', !task);
  renderDesignOptions(task?.designId || '');
  renderTaskColorOptions();
  document.getElementById('modal-calendar-task').classList.remove('hidden');
  document.getElementById('calendar-task-title').focus();
};

window.selectCalendarTaskColor = (color) => {
  if (!CALENDAR_TASK_COLORS[color]) return;
  selectedCalendarTaskColor = color;
  renderTaskColorOptions();
};

window.closeCalendarTaskModal = () => {
  document.getElementById('modal-calendar-task').classList.add('hidden');
  editingCalendarTaskId = null;
};

window.saveCalendarTask = (event) => {
  event.preventDefault();
  const title = document.getElementById('calendar-task-title').value.trim();
  const date = document.getElementById('calendar-task-date').value;
  if (!title || !date) return;

  const designId = document.getElementById('calendar-task-design').value;
  const selectedDesign = getLaunchOptions().find(launch => String(launch.id) === String(designId));
  const task = {
    id: editingCalendarTaskId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title,
    date,
    time: document.getElementById('calendar-task-time').value,
    designId,
    designName: selectedDesign?.name || '',
    notes: document.getElementById('calendar-task-notes').value.trim(),
    color: selectedCalendarTaskColor,
    completed: document.getElementById('calendar-task-completed').checked
  };
  const nextTasks = editingCalendarTaskId
    ? calendarTasks.map(item => item.id === editingCalendarTaskId ? task : item)
    : [...calendarTasks, task];

  if (!saveCalendarTasks(nextTasks)) return;
  calendarMonth = new Date(dateFromKey(date).getFullYear(), dateFromKey(date).getMonth(), 1);
  renderCalendar();
  closeCalendarTaskModal();
};

window.removeCalendarTask = () => {
  const task = calendarTasks.find(item => item.id === editingCalendarTaskId);
  if (!task || !confirm(`Remove "${task.title}" from the calendar?`)) return;
  if (!saveCalendarTasks(calendarTasks.filter(item => item.id !== task.id))) return;
  renderCalendar();
  closeCalendarTaskModal();
};

export function initializeCalendar(launchesProvider) {
  getLaunches = launchesProvider;
  calendarTasks = loadCalendarTasks();
  renderCalendar();
}