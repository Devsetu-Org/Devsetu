const SECTIONS = [
  { id: 'control-plane', title: 'Control plane & system-k8s' },
  { id: 'karpenter', title: 'Karpenter' },
  { id: 'linux', title: 'Linux pool' },
];

/** @type {Array<{id:string,label:string,section:string,summary:string,description:string,command:string,scriptPath:string|null,confirm:string|null}>} */
let actions = [];
let runningAction = null;
let selectedActionId = null;
let pendingAction = null;
let logsActionId = null;
let fileActionId = null;
let pollTimer = null;
let logsPollTimer = null;

const elActions = document.getElementById('actions');
const elMeta = document.getElementById('meta');
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const drawerKicker = document.getElementById('drawer-kicker');
const drawerTitle = document.getElementById('drawer-title');
const drawerDesc = document.getElementById('drawer-desc');
const drawerScript = document.getElementById('drawer-script');
const drawerScriptPath = document.getElementById('drawer-script-path');
const drawerRun = document.getElementById('drawer-run');
const drawerLogs = document.getElementById('drawer-logs');
const drawerFile = document.getElementById('drawer-file');
const drawerClose = document.getElementById('drawer-close');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmInput = document.getElementById('confirm-input');
const confirmOk = document.getElementById('confirm-ok');
const confirmToken = document.getElementById('confirm-token');
const confirmTitle = document.getElementById('confirm-title');
const confirmBody = document.getElementById('confirm-body');
const logsDialog = document.getElementById('logs-dialog');
const logsTitle = document.getElementById('logs-title');
const logsStatus = document.getElementById('logs-status');
const logsBody = document.getElementById('logs-body');
const fileDialog = document.getElementById('file-dialog');
const fileTitle = document.getElementById('file-title');
const filePath = document.getElementById('file-path');
const fileBody = document.getElementById('file-body');
const fileOpenEditor = document.getElementById('file-open-editor');
const fileClose = document.getElementById('file-close');

function sectionKicker(sectionId) {
  if (sectionId === 'karpenter') return 'Karpenter';
  if (sectionId === 'linux') return 'Linux';
  return 'System';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function selectedAction() {
  return actions.find((a) => a.id === selectedActionId) || null;
}

function render() {
  elActions.innerHTML = '';
  for (const section of SECTIONS) {
    const items = actions.filter((a) => a.section === section.id);
    if (!items.length) continue;
    const wrap = document.createElement('section');
    wrap.className = 'section';
    wrap.innerHTML = `<h2 class="section-title">${section.title}</h2>`;
    const grid = document.createElement('div');
    grid.className = 'widget-grid';
    for (const action of items) {
      const danger = Boolean(action.confirm);
      const isRunning = runningAction === action.id;
      const isSelected = selectedActionId === action.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `widget${danger ? ' danger-op' : ''}${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}`;
      btn.dataset.section = action.section;
      btn.innerHTML = `
        <span class="widget-kicker">${escapeHtml(sectionKicker(action.section))}</span>
        <h3 class="widget-title">${escapeHtml(action.label)}</h3>
        <p class="widget-summary">${escapeHtml(action.summary || action.description || '')}</p>
      `;
      btn.addEventListener('click', () => openDrawer(action.id));
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    elActions.appendChild(wrap);
  }
  syncDrawerChrome();
}

function openDrawer(actionId) {
  selectedActionId = actionId;
  const action = selectedAction();
  if (!action) return;

  drawerKicker.textContent = sectionKicker(action.section);
  drawerTitle.textContent = action.label;
  drawerDesc.textContent = action.description;
  drawerScript.textContent = action.command;
  drawerScriptPath.textContent = action.scriptPath
    ? `File: ${action.scriptPath}`
    : '';
  drawer.classList.toggle('is-danger', Boolean(action.confirm));
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.hidden = false;
  document.body.classList.add('drawer-open');
  syncDrawerChrome();
  render();
}

function closeDrawer() {
  selectedActionId = null;
  drawer.classList.remove('open', 'is-danger');
  drawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.hidden = true;
  document.body.classList.remove('drawer-open');
  render();
}

function syncDrawerChrome() {
  const busy = Boolean(runningAction);
  const action = selectedAction();
  drawerRun.disabled = busy || !action;
  drawerRun.textContent = action?.confirm ? 'Confirm' : 'Run';
}

async function onRun() {
  const action = selectedAction();
  if (!action || runningAction) return;

  if (action.confirm) {
    pendingAction = action;
    confirmTitle.textContent = action.label;
    confirmBody.textContent = action.description;
    confirmToken.textContent = action.confirm;
    confirmInput.value = '';
    confirmOk.disabled = true;
    confirmDialog.showModal();
    confirmInput.focus();
    return;
  }

  await runAction(action.id, null);
}

async function runAction(actionId, confirm) {
  runningAction = actionId;
  render();
  openLogs(actionId);

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionId, confirm }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    startGlobalPoll();
    startLogsPoll();
  } catch (e) {
    runningAction = null;
    logsBody.textContent = `Error: ${e.message}\n`;
    setLogsStatus('failed', 'failed');
    render();
  }
}

function setLogsStatus(text, cls) {
  logsStatus.textContent = text;
  logsStatus.className = `logs-status ${cls || ''}`;
}

/** True after first paint of the current logsActionId (so we open finished logs at the top). */
let logsInitialPaint = true;

function nearBottom(el, px = 48) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= px;
}

async function openLogs(actionId) {
  const action = actions.find((a) => a.id === actionId);
  logsActionId = actionId;
  logsInitialPaint = true;
  logsTitle.textContent = action ? action.label : actionId;
  logsBody.textContent = 'Loading…';
  setLogsStatus('…', '');
  if (!logsDialog.open) logsDialog.showModal();
  await refreshLogs({ follow: true });
  startLogsPoll();
}

async function refreshLogs({ follow = false } = {}) {
  if (!logsActionId) return;
  try {
    const res = await fetch(`/api/job?action=${encodeURIComponent(logsActionId)}`);
    const data = await res.json();
    const job = data.job;
    if (!job) {
      logsBody.textContent = 'No runs yet for this action.';
      setLogsStatus('idle', '');
      logsInitialPaint = false;
      return;
    }

    const stickToBottom =
      job.status === 'running' && (logsInitialPaint || nearBottom(logsBody));
    const prevTop = logsBody.scrollTop;

    logsBody.textContent = job.log || '(no output yet)';

    if (job.status === 'running') {
      setLogsStatus('running', 'running');
      if (stickToBottom || follow) {
        logsBody.scrollTop = logsBody.scrollHeight;
      } else {
        logsBody.scrollTop = prevTop;
      }
    } else {
      setLogsStatus(
        `${job.status} · exit ${job.exitCode ?? '?'}`,
        job.status === 'ok' ? 'ok' : 'failed',
      );
      // Finished job: open at the top so you can read from the start; keep position on later polls.
      if (logsInitialPaint) {
        logsBody.scrollTop = 0;
      } else {
        logsBody.scrollTop = prevTop;
      }
      stopLogsPoll();
    }
    logsInitialPaint = false;
  } catch (e) {
    logsBody.textContent = `Failed to load logs: ${e.message}`;
    setLogsStatus('error', 'failed');
  }
}

function stopLogsPoll() {
  if (logsPollTimer) {
    clearInterval(logsPollTimer);
    logsPollTimer = null;
  }
}

function startLogsPoll() {
  stopLogsPoll();
  logsPollTimer = setInterval(() => {
    if (!logsDialog.open || !logsActionId) {
      stopLogsPoll();
      return;
    }
    void refreshLogs();
  }, 800);
}

function startGlobalPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollRunning, 800);
  void pollRunning();
}

async function pollRunning() {
  try {
    const res = await fetch('/api/job');
    const data = await res.json();
    const next = data.runningAction || null;
    if (next !== runningAction) {
      runningAction = next;
      render();
    }
    if (!next) {
      clearInterval(pollTimer);
      pollTimer = null;
      if (logsDialog.open) void refreshLogs();
    }
  } catch {
    /* ignore */
  }
}

async function openFile(actionId) {
  const action = actions.find((a) => a.id === actionId);
  fileActionId = actionId;
  fileTitle.textContent = action ? action.label : actionId;
  filePath.textContent = 'Loading…';
  fileBody.textContent = 'Loading…';
  if (!fileDialog.open) fileDialog.showModal();
  try {
    const res = await fetch(`/api/file?action=${encodeURIComponent(actionId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    filePath.textContent = data.path || data.absPath || '';
    fileBody.textContent = data.content || '';
    fileBody.scrollTop = 0;
  } catch (e) {
    filePath.textContent = 'error';
    fileBody.textContent = e.message || String(e);
  }
}

async function openFileInEditor() {
  if (!fileActionId && !selectedActionId) return;
  const actionId = fileActionId || selectedActionId;
  try {
    const res = await fetch('/api/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      const hint = data.absPath ? `\n\nPath: ${data.absPath}` : '';
      throw new Error((data.error || res.statusText) + hint);
    }
    filePath.textContent = `${data.path} · opened via ${data.via}`;
  } catch (e) {
    filePath.textContent = e.message || String(e);
  }
}

drawerRun.addEventListener('click', () => void onRun());
drawerLogs.addEventListener('click', () => {
  if (selectedActionId) void openLogs(selectedActionId);
});
drawerFile.addEventListener('click', () => {
  if (selectedActionId) void openFile(selectedActionId);
});
drawerClose.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);
fileOpenEditor.addEventListener('click', () => void openFileInEditor());
fileClose.addEventListener('click', () => fileDialog.close());
fileDialog.addEventListener('close', () => {
  fileActionId = null;
});

confirmInput.addEventListener('input', () => {
  if (!pendingAction) return;
  confirmOk.disabled = confirmInput.value !== pendingAction.confirm;
});

document.getElementById('confirm-form').addEventListener('submit', (ev) => {
  const submitter = ev.submitter;
  if (!pendingAction) return;
  if (submitter && submitter.value === 'ok') {
    ev.preventDefault();
    if (confirmInput.value !== pendingAction.confirm) return;
    const id = pendingAction.id;
    const token = confirmInput.value;
    pendingAction = null;
    confirmDialog.close();
    void runAction(id, token);
  } else {
    pendingAction = null;
  }
});

document.getElementById('logs-close').addEventListener('click', () => {
  logsDialog.close();
});

logsDialog.addEventListener('close', () => {
  logsActionId = null;
  logsInitialPaint = true;
  stopLogsPoll();
});

document.addEventListener('keydown', (ev) => {
  if (
    ev.key === 'Escape' &&
    drawer.classList.contains('open') &&
    !logsDialog.open &&
    !fileDialog.open &&
    !confirmDialog.open
  ) {
    closeDrawer();
  }
});

async function init() {
  const res = await fetch('/api/catalog');
  const data = await res.json();
  actions = data.actions || [];
  elMeta.textContent = `AWS_PROFILE=${data.profile || '(default)'}  ·  region=${data.region}`;

  const jobRes = await fetch('/api/job');
  const jobData = await jobRes.json();
  runningAction = jobData.runningAction || null;
  render();
  if (runningAction) startGlobalPoll();
}

init().catch((e) => {
  elMeta.textContent = `Failed to load: ${e.message}`;
});
