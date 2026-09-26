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

function getTaskDates(task) {
  if (Array.isArray(task.dates) && task.dates.length > 0) {
    return [...new Set(task.dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))];
  }
  return task.date ? [task.date] : [];
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
let selectedCalendarTaskDates = [];
let selectedCalendarTaskColor = 'gold';
let draggedCalendarTask = null;
let calendarTaskListQuery = '';
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

function renderSelectedTaskDates() {
  const container = document.getElementById('calendar-task-selected-dates');
  if (selectedCalendarTaskDates.length === 0) {
    container.innerHTML = '<span class="text-sm text-stone-500">Select at least one day.</span>';
    return;
  }

  container.innerHTML = selectedCalendarTaskDates.map(date => `
    <span class="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
      ${dateFromKey(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      <button type="button" onclick="removeCalendarTaskDate('${date}')" aria-label="Remove ${dateFromKey(date).toLocaleDateString(undefined, { dateStyle: 'full' })}" class="w-5 h-5 rounded-full text-stone-500 hover:text-red-700 hover:bg-stone-200">×</button>
    </span>
  `).join('');
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
      .filter(task => getTaskDates(task).includes(key))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
    const classes = [
      'min-h-[84px] p-1.5 border-r border-b border-stone-200 flex flex-col gap-1',
      isCurrentMonth ? 'bg-white' : 'bg-stone-50/70',
      isToday ? 'ring-2 ring-inset ring-brand-gold' : ''
    ].filter(Boolean).join(' ');

    const taskItems = dayTasks.map(task => {
      const launchName = task.designName || getLaunchOptions().find(launch => String(launch.id) === String(task.designId))?.name;
      const color = CALENDAR_TASK_COLORS[task.color] || CALENDAR_TASK_COLORS.gold;
      return `
        <button type="button" draggable="true" ondragstart="startCalendarTaskDrag(event, '${escapeHtml(task.id)}', '${key}')" ondragend="endCalendarTaskDrag(event)" onclick="openCalendarTaskModal('', '${escapeHtml(task.id)}')" aria-label="${escapeHtml(task.title)}. Drag to move to another day, or select to edit." title="Drag to move: ${escapeHtml(task.title)}${task.notes ? ` - ${escapeHtml(task.notes)}` : ''}"
          style="--task-background:${color.background}; --task-border:${color.border}; --task-foreground:${color.foreground};"
          class="calendar-task-chip cursor-grab active:cursor-grabbing w-full text-left rounded-md px-2 py-1 text-xs leading-4 border-l-2 hover:brightness-95 ${task.completed ? 'opacity-60 line-through' : ''}">
          <span class="block truncate">${task.completed ? '✓ ' : ''}${task.time ? `${escapeHtml(task.time)} · ` : ''}${escapeHtml(task.title)}</span>
          ${launchName ? `<span class="block truncate text-[10px] text-stone-500">${escapeHtml(launchName)}</span>` : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="${classes}" aria-label="${day.toLocaleDateString(undefined, { dateStyle: 'full' })}" ondragover="allowCalendarTaskDrop(event)" ondragenter="highlightCalendarTaskDrop(event)" ondragleave="clearCalendarTaskDrop(event)" ondrop="dropCalendarTask(event, '${key}')">
        <div class="flex items-center justify-between gap-1">
          <button type="button" onclick="openCalendarTaskModal('${key}')" aria-label="Plan a task for ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}"
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isToday ? 'bg-brand-gold text-white' : isCurrentMonth ? 'text-stone-800 hover:bg-stone-100' : 'text-stone-400 hover:bg-stone-200'}">${day.getDate()}</button>
          <button type="button" onclick="openCalendarTaskModal('${key}')" aria-label="Add task on ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100">+</button>
        </div>
        <div class="max-h-[52px] overflow-y-auto space-y-1 scrollbar-thin">${taskItems}</div>
      </div>
    `;
  });

  grid.innerHTML = dayCells.join('');
  const monthTasks = calendarTasks.filter(task => {
    return getTaskDates(task).some(date => {
      const taskDate = dateFromKey(date);
      return taskDate.getFullYear() === year && taskDate.getMonth() === month;
    });
  });
  const openTasks = monthTasks.filter(task => !task.completed).length;
  document.getElementById('calendar-task-summary').textContent = `${monthTasks.length} task${monthTasks.length === 1 ? '' : 's'} this month · ${openTasks} remaining`;
  renderCalendarTaskList();
}

function renderCalendarTaskList() {
  const container = document.getElementById('calendar-task-list');
  if (!container) return;

  const occurrences = calendarTasks.flatMap(task => getTaskDates(task).map(date => ({ task, date })))
    .sort((a, b) => a.date.localeCompare(b.date)
      || (a.task.time || '').localeCompare(b.task.time || '')
      || a.task.title.localeCompare(b.task.title));
  const query = calendarTaskListQuery.trim().toLocaleLowerCase();
  const filtered = occurrences.filter(({ task, date }) =>
    !query || [task.title, task.notes, task.designName, date]
      .some(value => String(value || '').toLocaleLowerCase().includes(query))
  );

  if (occurrences.length === 0) {
    document.getElementById('calendar-task-list-count').textContent = '0 dates';
    container.innerHTML = '<p class="p-5 text-sm text-stone-500">No tasks scheduled. Add one from the calendar or the Add Task button.</p>';
    return;
  }
  if (filtered.length === 0) {
    document.getElementById('calendar-task-list-count').textContent = '0 dates';
    container.innerHTML = '<p class="p-5 text-sm text-stone-500">No tasks match that search.</p>';
    return;
  }

  const dateGroups = [];
  for (const occurrence of filtered) {
    let group = dateGroups[dateGroups.length - 1];
    if (!group || group.date !== occurrence.date) {
      group = { date: occurrence.date, tasks: [] };
      dateGroups.push(group);
    }
    group.tasks.push(occurrence.task);
  }
  document.getElementById('calendar-task-list-count').textContent = `${dateGroups.length} date${dateGroups.length === 1 ? '' : 's'}`;

  container.innerHTML = dateGroups.map(({ date, tasks }) => {
    const taskDate = dateFromKey(date);
    const taskRows = tasks.map(task => {
      const color = CALENDAR_TASK_COLORS[task.color] || CALENDAR_TASK_COLORS.gold;
      const launchName = task.designName || getLaunchOptions().find(launch => String(launch.id) === String(task.designId))?.name;
      return `
        <button type="button" data-task-id="${escapeHtml(task.id)}" data-task-date="${date}" onclick="openCalendarTaskFromList(this.dataset.taskId, this.dataset.taskDate)"
          class="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none border-l-[3px] ${task.completed ? 'opacity-60' : ''}"
          style="border-left-color:${color.border}">
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold ${task.completed ? 'line-through text-stone-500' : 'text-stone-900'}">${task.completed ? '✓ ' : ''}${escapeHtml(task.title)}</span>
            <span class="block mt-0.5 truncate text-xs text-stone-500">${task.time ? `${escapeHtml(task.time)} · ` : ''}${escapeHtml(launchName || task.notes || 'Launch task')}</span>
          </span>
        </button>
      `;
    }).join('');

    return `
      <section class="border-b border-stone-100 last:border-b-0">
        <div class="flex items-center justify-between gap-2 px-4 py-2 bg-stone-50">
          <h4 class="text-xs font-semibold uppercase text-stone-600">${taskDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h4>
          <span class="text-[10px] text-stone-500">${tasks.length} task${tasks.length === 1 ? '' : 's'}</span>
        </div>
        ${taskRows}
      </section>
    `;
  }).join('');
}

window.filterCalendarTaskList = (query) => {
  calendarTaskListQuery = query;
  renderCalendarTaskList();
};

window.openCalendarTaskFromList = (taskId, date) => {
  const taskDate = dateFromKey(date);
  calendarMonth = new Date(taskDate.getFullYear(), taskDate.getMonth(), 1);
  renderCalendar();
  openCalendarTaskModal(date, taskId);
};

window.shiftCalendarMonth = (amount) => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
  renderCalendar();
};

window.startCalendarTaskDrag = (event, taskId, sourceDate) => {
  draggedCalendarTask = { taskId, sourceDate };
  event.currentTarget.classList.add('calendar-task-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify(draggedCalendarTask));
  document.getElementById('calendar-drag-status').textContent = `Moving ${calendarTasks.find(task => task.id === taskId)?.title || 'task'}. Drop it on a day.`;
};

window.allowCalendarTaskDrop = (event) => {
  if (!draggedCalendarTask) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

window.highlightCalendarTaskDrop = (event) => {
  if (!draggedCalendarTask) return;
  event.preventDefault();
  event.currentTarget.classList.add('calendar-day-drop-target');
};

window.clearCalendarTaskDrop = (event) => {
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
  event.currentTarget.classList.remove('calendar-day-drop-target');
};

window.dropCalendarTask = (event, targetDate) => {
  event.preventDefault();
  event.currentTarget.classList.remove('calendar-day-drop-target');
  let dragData = draggedCalendarTask;
  try {
    dragData = JSON.parse(event.dataTransfer.getData('text/plain')) || dragData;
  } catch (error) {}
  draggedCalendarTask = null;

  const task = calendarTasks.find(item => item.id === dragData?.taskId);
  if (!task) return;
  const taskDates = getTaskDates(task);
  if (!taskDates.includes(dragData.sourceDate) || dragData.sourceDate === targetDate) return;

  const dates = [...new Set([...taskDates.filter(date => date !== dragData.sourceDate), targetDate])].sort();
  const movedTask = { ...task, date: dates[0], dates };
  if (!saveCalendarTasks(calendarTasks.map(item => item.id === task.id ? movedTask : item))) return;
  document.getElementById('calendar-drag-status').textContent = `Moved ${task.title} to ${dateFromKey(targetDate).toLocaleDateString(undefined, { dateStyle: 'full' })}.`;
  renderCalendar();
};

window.endCalendarTaskDrag = (event) => {
  event.currentTarget.classList.remove('calendar-task-dragging');
  draggedCalendarTask = null;
};

window.goToCalendarToday = () => {
  const now = new Date();
  calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
};

window.openCalendarTaskModal = (date = '', taskId = null) => {
  const task = calendarTasks.find(item => item.id === taskId);
  editingCalendarTaskId = task?.id || null;
  selectedCalendarTaskDates = task ? getTaskDates(task) : [date || dateKey(new Date())];
  selectedCalendarTaskColor = CALENDAR_TASK_COLORS[task?.color] ? task.color : 'gold';
  document.getElementById('calendar-task-modal-title').textContent = task ? 'Edit Launch Task' : 'Add Launch Task';
  document.getElementById('calendar-task-title').value = task?.title || '';
  document.getElementById('calendar-task-date').value = selectedCalendarTaskDates[0] || date || dateKey(new Date());
  document.getElementById('calendar-task-time').value = task?.time || '';
  document.getElementById('calendar-task-notes').value = task?.notes || '';
  document.getElementById('calendar-task-completed').checked = !!task?.completed;
  document.getElementById('calendar-task-completed-wrap').classList.toggle('hidden', !task);
  document.getElementById('calendar-task-remove').classList.toggle('hidden', !task);
  renderDesignOptions(task?.designId || '');
  renderTaskColorOptions();
  renderSelectedTaskDates();
  document.getElementById('modal-calendar-task').classList.remove('hidden');
  document.getElementById('calendar-task-title').focus();
};

window.addCalendarTaskDate = () => {
  const date = document.getElementById('calendar-task-date').value;
  if (!date || selectedCalendarTaskDates.includes(date)) return;
  selectedCalendarTaskDates = [...selectedCalendarTaskDates, date].sort();
  renderSelectedTaskDates();
};

window.removeCalendarTaskDate = (date) => {
  selectedCalendarTaskDates = selectedCalendarTaskDates.filter(item => item !== date);
  if (document.getElementById('calendar-task-date').value === date) {
    document.getElementById('calendar-task-date').value = selectedCalendarTaskDates[0] || '';
  }
  renderSelectedTaskDates();
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
  const inputDate = document.getElementById('calendar-task-date').value;
  if (inputDate && !selectedCalendarTaskDates.includes(inputDate)) {
    selectedCalendarTaskDates = [...selectedCalendarTaskDates, inputDate].sort();
  }
  const dates = [...new Set(selectedCalendarTaskDates)].sort();
  if (!title || dates.length === 0) {
    alert('Add at least one scheduled day for this task.');
    return;
  }

  const designId = document.getElementById('calendar-task-design').value;
  const selectedDesign = getLaunchOptions().find(launch => String(launch.id) === String(designId));
  const task = {
    id: editingCalendarTaskId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title,
    date: dates[0],
    dates,
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
  const visibleDate = dates.find(date => {
    const selectedDate = dateFromKey(date);
    return selectedDate.getFullYear() === calendarMonth.getFullYear() && selectedDate.getMonth() === calendarMonth.getMonth();
  }) || dates[0];
  const selectedDate = dateFromKey(visibleDate);
  calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
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