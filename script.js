let zTop = 100;
let winCount = 0;
const openWindows = {}; // id -> {el, taskbarBtn, minimized}

/* ---------- Sound (tiny Win95-style beep) ---------- */
let audioCtx;
let systemMuted = false;
function beep(freq = 600, dur = 0.05) {
  if (systemMuted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.value = 0.03;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio not available, ignore */ }
}

/* ---------- Clock ---------- */
function updateClock() {
  const d = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  m = m < 10 ? '0' + m : m;
  document.getElementById('clock').textContent = `${h}:${m} ${ampm}`;
}
updateClock();
setInterval(updateClock, 10000);

/* ---------- Start menu ---------- */
function toggleStartMenu() {
  document.getElementById('start-menu').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const menu = document.getElementById('start-menu');
  const btn = document.getElementById('start-btn');
  if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.remove('open');
  }
  document.getElementById('context-menu').classList.remove('open');
});
function fakeShutdown() {
  document.getElementById('start-menu').classList.remove('open');
  document.getElementById('desktop').innerHTML =
    '<div style="color:#fff;text-align:center;padding-top:200px;font-size:20px;">It is now safe to close this browser tab.</div>';
  document.getElementById('taskbar').style.display = 'none';
}

/* ---------- Right-click context menu ---------- */
function showContextMenu(e) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('open');
  return false;
}
function arrangeIcons() {
  document.getElementById('context-menu').classList.remove('open');
  const ids = ['icon-explorer','icon-browser','icon-notepad','icon-paint','icon-calc','icon-recycle'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.left = '12px';
    el.style.top = (12 + i * 88) + 'px';
  });
  saveState();
}
function toggleMute() {
  systemMuted = !systemMuted;
  document.getElementById('mute-btn').textContent = systemMuted ? '🔇' : '🔊';
  saveState();
}

function showAbout() {
  document.getElementById('context-menu').classList.remove('open');
  alert('RetroOS 95\n\nA fake operating system running entirely in your browser.\nBuilt with HTML, CSS and JavaScript.');
}

/* ---------- Draggable desktop icons ---------- */
document.querySelectorAll('.icon').forEach(icon => {
  let offX = 0, offY = 0, dragging = false, moved = false;
  icon.addEventListener('mousedown', (e) => {
    dragging = true;
    moved = false;
    offX = e.clientX - icon.offsetLeft;
    offY = e.clientY - icon.offsetTop;
    document.querySelectorAll('.icon').forEach(i => i.classList.remove('selected'));
    icon.classList.add('selected');
    e.stopPropagation();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    moved = true;
    icon.style.left = Math.max(0, e.clientX - offX) + 'px';
    icon.style.top = Math.max(0, e.clientY - offY) + 'px';
  });
  document.addEventListener('mouseup', () => { if (dragging && moved) saveState(); dragging = false; });
});

/* ---------- Window manager ---------- */
function createWindow(id, title, icon, bodyHTML, opts = {}) {
  if (openWindows[id]) { restoreWindow(id); return; }
  document.getElementById('start-menu').classList.remove('open');
  beep(700, 0.04);

  winCount++;
  const win = document.createElement('div');
  win.className = 'window bevel-out';
  win.style.width = (opts.width || 380) + 'px';
  win.style.height = (opts.height || 280) + 'px';
  win.style.left = (30 + (winCount % 5) * 25) + 'px';
  win.style.top = (30 + (winCount % 5) * 25) + 'px';
  win.style.zIndex = ++zTop;

  win.innerHTML = `
    <div class="title-bar">
      <div class="title-bar-text">${icon} ${title}</div>
      <div class="title-bar-controls">
        <button onclick="minimizeWindow('${id}')">_</button>
        <button onclick="toggleMaximize('${id}')">□</button>
        <button onclick="closeWindow('${id}')">✕</button>
      </div>
    </div>
    <div class="window-body">${bodyHTML}</div>
    <div class="resize-handle"></div>
  `;

  win.classList.add('win-opening');
  document.getElementById('windows-layer').appendChild(win);
  requestAnimationFrame(() => requestAnimationFrame(() => win.classList.remove('win-opening')));
  const titleBar = win.querySelector('.title-bar');
  makeDraggable(win, titleBar);
  makeResizable(win, win.querySelector('.resize-handle'), opts.onResize);
  titleBar.querySelector('.title-bar-text').addEventListener('dblclick', () => toggleMaximize(id));
  win.addEventListener('mousedown', () => focusWindow(id));

  const taskBtn = document.createElement('button');
  taskBtn.className = 'taskbar-btn bevel-out active';
  taskBtn.textContent = `${icon} ${title}`;
  taskBtn.onclick = () => toggleMinimize(id);
  document.getElementById('taskbar-buttons').appendChild(taskBtn);

  openWindows[id] = { el: win, btn: taskBtn, minimized: false };

  if (opts.onOpen) opts.onOpen(win);
}

function focusWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.el.style.zIndex = ++zTop;
  Object.values(openWindows).forEach(o => o.btn.classList.remove('active'));
  w.btn.classList.add('active');
}

function toggleMinimize(id) {
  const w = openWindows[id];
  if (!w) return;
  if (w.minimized) restoreWindow(id);
  else minimizeWindow(id);
}

function minimizeWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.el.classList.add('minimized');
  w.minimized = true;
  w.btn.classList.remove('active');
}

function restoreWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.el.classList.remove('minimized');
  w.minimized = false;
  focusWindow(id);
}

function toggleMaximize(id) {
  const w = openWindows[id];
  if (!w) return;
  const win = w.el;
  win.classList.add('win-anim');
  setTimeout(() => win.classList.remove('win-anim'), 220);
  if (win.classList.contains('maximized')) {
    win.classList.remove('maximized');
    const prev = win._preMaximize;
    if (prev) {
      win.style.left = prev.left; win.style.top = prev.top;
      win.style.width = prev.width; win.style.height = prev.height;
    }
  } else {
    win._preMaximize = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
    win.classList.add('maximized');
  }
  focusWindow(id);
}

// Alt+Tab cycles focus through open, non-minimized windows.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && e.altKey) {
    e.preventDefault();
    const ids = Object.keys(openWindows).filter(id => !openWindows[id].minimized);
    if (!ids.length) return;
    const activeId = ids.find(id => openWindows[id].btn.classList.contains('active')) || ids[0];
    const next = ids[(ids.indexOf(activeId) + 1) % ids.length];
    focusWindow(next);
  }
  if (e.key === 'Escape') {
    document.getElementById('start-menu').classList.remove('open');
    document.getElementById('context-menu').classList.remove('open');
  }
});

function closeWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.el.remove();
  w.btn.remove();
  delete openWindows[id];
  beep(400, 0.04);
}

function makeDraggable(win, handle) {
  let offX = 0, offY = 0, dragging = false;
  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    offX = e.clientX - win.offsetLeft;
    offY = e.clientY - win.offsetTop;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.style.left = Math.max(0, e.clientX - offX) + 'px';
    win.style.top = Math.max(0, e.clientY - offY) + 'px';
  });
  document.addEventListener('mouseup', () => dragging = false);
}

function makeResizable(win, handle, onResize) {
  let startX, startY, startW, startH, resizing = false;
  handle.addEventListener('mousedown', (e) => {
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = win.offsetWidth;
    startH = win.offsetHeight;
    e.stopPropagation();
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    win.style.width = Math.max(220, startW + (e.clientX - startX)) + 'px';
    win.style.height = Math.max(140, startH + (e.clientY - startY)) + 'px';
    if (onResize) onResize();
  });
  document.addEventListener('mouseup', () => resizing = false);
}

/* ---------- App launcher ---------- */
function openApp(name) {
  if (name === 'explorer') openExplorer();
  else if (name === 'browser') openBrowser();
  else if (name === 'notepad') openNotepad();
  else if (name === 'paint') openPaint();
  else if (name === 'calc') openCalculator();
  else if (name === 'viewer') openImageViewer();
  else if (name === 'player') openMediaPlayer();
  else if (name === 'video') openVideoPlayer();
  else if (name === 'control') openControlPanel();
  else if (name === 'recycle') openRecycle();
}

/* ==========================================================
   FILE EXPLORER  (fake C: drive  +  real mounted folder)
   ========================================================== */
const fakeFS = {
  'My Computer': ['Local Disk (C:)', 'Floppy (A:)'],
  'Local Disk (C:)': ['My Documents', 'Program Files', 'Windows'],
  'My Documents': ['resume.txt 📄', 'vacation.bmp 🖼️', 'budget.xls 📊'],
  'Program Files': ['Paint', 'Notepad', 'Internet Explorer'],
  'Windows': ['system32', 'win.ini'],
  'Floppy (A:)': ['(empty)']
};

// Real mounted folder, built from the browser's native folder picker.
// Structure: { name, children: { childName: node } } where a node with
// no children property is a real File object.
let realRoot = null;

function openExplorer() {
  const body = `
    <div class="explorer-body">
      <div class="explorer-toolbar">
        <button onclick="mountRealFolder()">💾 Open a Real Folder from My Computer...</button>
      </div>
      <div class="explorer-main">
        <div class="explorer-tree" id="exp-tree"></div>
        <div class="explorer-files" id="exp-files"></div>
      </div>
    </div>
  `;
  createWindow('explorer', 'My Computer', '🖥️', body, { width: 460, height: 320, onOpen: () => {
    rebuildExplorerTree();
    renderFakeFolder('My Computer');
  }});
}

function rebuildExplorerTree() {
  const tree = document.getElementById('exp-tree');
  if (!tree) return;
  tree.innerHTML = '';
  Object.keys(fakeFS).forEach(folder => {
    const d = document.createElement('div');
    d.textContent = '📁 ' + folder;
    d.onclick = () => renderFakeFolder(folder);
    tree.appendChild(d);
  });
  if (realRoot) {
    const d = document.createElement('div');
    d.textContent = '💾 ' + realRoot.name + ' (real)';
    d.onclick = () => renderRealFolder(realRoot);
    tree.appendChild(d);
  }
}

function renderFakeFolder(name) {
  const filesEl = document.getElementById('exp-files');
  if (!filesEl) return;
  filesEl.innerHTML = '';
  (fakeFS[name] || []).forEach(item => {
    const isFolder = fakeFS[item] !== undefined;
    const div = document.createElement('div');
    div.className = 'explorer-file';
    div.innerHTML = `<div class="f-icon">${isFolder ? '📁' : '📄'}</div><div>${item}</div>`;
    div.ondblclick = () => {
      if (isFolder) renderFakeFolder(item);
      else alert('Opening "' + item + '"... (this file is fake, nothing really happens)');
    };
    filesEl.appendChild(div);
  });
}

// Ask the browser for a real folder. Uses the drag-and-drop-free
// webkitdirectory file input, which works across Chrome/Edge/Firefox
// and needs no special permissions beyond the OS's native picker.
function mountRealFolder() {
  document.getElementById('real-folder-input').click();
}
document.getElementById('real-folder-input').addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const rootName = files[0].webkitRelativePath.split('/')[0];
  realRoot = { name: rootName, children: {} };
  files.forEach(file => {
    const parts = file.webkitRelativePath.split('/').slice(1); // drop root name
    let node = realRoot;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node.children = node.children || {};
        node.children[part] = { name: part, file: file };
      } else {
        node.children = node.children || {};
        if (!node.children[part]) node.children[part] = { name: part, children: {} };
        node = node.children[part];
      }
    });
  });
  rebuildExplorerTree();
  renderRealFolder(realRoot);
});

function renderRealFolder(node) {
  const filesEl = document.getElementById('exp-files');
  if (!filesEl) return;
  filesEl.innerHTML = '';
  const backCrumb = document.createElement('div');
  backCrumb.className = 'explorer-file';
  backCrumb.innerHTML = `<div class="f-icon">⬆️</div><div>Root</div>`;
  backCrumb.ondblclick = () => renderRealFolder(realRoot);
  filesEl.appendChild(backCrumb);

  const entries = Object.values(node.children || {});
  entries.sort((a, b) => (!!a.file - !!b.file) - (!!b.file - !!a.file) || a.name.localeCompare(b.name));
  entries.forEach(entry => {
    const isFolder = !entry.file;
    const div = document.createElement('div');
    div.className = 'explorer-file';
    div.innerHTML = `<div class="f-icon">${isFolder ? '📁' : '📄'}</div><div>${entry.name}</div>`;
    div.ondblclick = () => {
      if (isFolder) renderRealFolder(entry);
      else openRealFile(entry.file, entries.filter(e => e.file).map(e => e.file));
    };
    filesEl.appendChild(div);
  });
  if (!entries.length) {
    filesEl.innerHTML += '<div style="font-size:12px;padding:8px;">(empty folder)</div>';
  }
}

function openRealFile(file, siblingFiles) {
  const name = file.name.toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
  const isAudio = /\.(mp3|wav|ogg|m4a|flac|aac)$/.test(name);
  const isVideo = /\.(mp4|webm|mov|m4v|ogv)$/.test(name);
  const isText = /\.(txt|md|csv|json|js|css|html?|xml|log)$/.test(name);

  if (isImage) {
    const images = (siblingFiles || [file]).filter(f => /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(f.name.toLowerCase()));
    const startIndex = Math.max(0, images.indexOf(file));
    openImageViewer(images, startIndex);
    return;
  }
  if (isAudio) {
    openMediaPlayer(file);
    return;
  }
  if (isVideo) {
    openVideoPlayer(file);
    return;
  }

  const id = 'view-' + name.replace(/[^a-z0-9]/gi, '') + Math.floor(Math.random() * 1000);
  if (isText) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const safe = e.target.result.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      createWindow(id, file.name, '📄', `<div class="file-viewer"><pre>${safe}</pre></div>`, { width: 420, height: 340 });
    };
    reader.readAsText(file);
    return;
  }
  alert(`${file.name}\n\n${(file.size/1024).toFixed(1)} KB\n\nNo viewer for this file type, but hey — that's a real file from your computer!`);
}

function openRecycle() {
  createWindow('recycle', 'Recycle Bin', '🗑️', '<p style="padding:10px;font-size:12px;">The Recycle Bin is empty.</p>', { width: 300, height: 160 });
}

/* ==========================================================
   INTERNET EXPLORER  (fake sites  +  real iframe mode)
   ========================================================== */
const fakeSites = {
  'home': {
    title: 'RetroWeb Home',
    html: `<h1>Welcome to RetroWeb!</h1><p>Your portal to the information superhighway.</p>
           <p>Try visiting: <a onclick="navBrowser('cheese.net')">cheese.net</a> or <a onclick="navBrowser('fake-mail.com')">fake-mail.com</a></p>
           <p>Or flip the switch above to "Real Web" and type an actual address, like <a onclick="switchMode('real');navBrowser('wikipedia.org')">wikipedia.org</a>.</p>`
  },
  'cheese.net': {
    title: 'Cheese Net - The #1 Cheese Site',
    html: `<h1>🧀 Cheese.net</h1><p>Everything you ever wanted to know about cheese.</p>
           <p>Featured: Gouda, Cheddar, a mysterious blue one nobody trusts.</p>
           <p><a onclick="navBrowser('home')">Back to Home</a></p>`
  },
  'fake-mail.com': {
    title: 'FakeMail Inbox',
    html: `<h1>📧 FakeMail</h1><p>You have <b>1 new message</b>.</p>
           <p style="border:1px solid #000;padding:6px;">From: grandma@fake-mail.com<br>Subject: FWD: FWD: FWD: read this!!</p>
           <p><a onclick="navBrowser('home')">Back to Home</a></p>`
  },
  'search.io': {
    title: 'Searchio!',
    html: `<h1>🔎 Searchio!</h1><p>Type anything into the address bar above — it won't find it, but it'll pretend to.</p>
           <p><a onclick="navBrowser('home')">Back to Home</a></p>`
  }
};
// Each tab: { id, mode:'fake'|'real', history:[urls], index }
let browserTabs = [];
let activeTabId = null;
let tabCounter = 0;

function openBrowser() {
  const body = `
    <div class="browser-tabstrip" id="browser-tabstrip"></div>
    <div class="browser-toolbar">
      <button onclick="tabBack()">◀</button>
      <button onclick="tabForward()">▶</button>
      <input type="text" id="browser-addr" value="home" onkeydown="if(event.key==='Enter') navBrowser(this.value)">
      <button onclick="navBrowser(document.getElementById('browser-addr').value)">Go</button>
      <button id="mode-btn" onclick="toggleMode()">🎭 Fake Web</button>
    </div>
    <div class="browser-bookmarks">
      <button onclick="navBrowser('home')">🏠 Home</button>
      <button onclick="navBrowser('cheese.net')">🧀 cheese.net</button>
      <button onclick="navBrowser('fake-mail.com')">📧 fake-mail.com</button>
      <button onclick="navBrowser('search.io')">🔎 search.io</button>
      <button onclick="switchMode('real');navBrowser('youtube.com/watch?v=dQw4w9WgXcQ')">📺 YouTube demo</button>
    </div>
    <div class="browser-mode-note" id="mode-note">Fake Web mode: pretend sites, always work.</div>
    <div class="browser-page" id="browser-page"></div>
  `;
  createWindow('browser', 'Internet Explorer', '🌐', body, { width: 560, height: 430, onOpen: () => {
    browserTabs = [];
    newTab('home', 'fake');
  }});
}

function newTab(url, mode) {
  tabCounter++;
  const tab = { id: 'tab' + tabCounter, mode: mode || 'fake', history: [url || 'home'], index: 0 };
  browserTabs.push(tab);
  activeTabId = tab.id;
  renderTabStrip();
  renderActiveTab();
}

function closeTab(tabId, evt) {
  if (evt) evt.stopPropagation();
  const idx = browserTabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  browserTabs.splice(idx, 1);
  if (!browserTabs.length) { newTab('home', 'fake'); return; }
  if (activeTabId === tabId) activeTabId = browserTabs[Math.max(0, idx - 1)].id;
  renderTabStrip();
  renderActiveTab();
}

function switchTab(tabId) {
  activeTabId = tabId;
  renderTabStrip();
  renderActiveTab();
}

function activeTab() { return browserTabs.find(t => t.id === activeTabId); }

function tabLabel(tab) {
  const url = tab.history[tab.index];
  if (tab.mode === 'fake' && fakeSites[url.toLowerCase()]) return fakeSites[url.toLowerCase()].title;
  return url.length > 18 ? url.slice(0, 18) + '…' : (url || 'New Tab');
}

function renderTabStrip() {
  const strip = document.getElementById('browser-tabstrip');
  if (!strip) return;
  strip.innerHTML = browserTabs.map(t => `
    <div class="browser-tab${t.id === activeTabId ? ' active' : ''}" onclick="switchTab('${t.id}')">
      <span class="browser-tab-title">${t.mode === 'real' ? '🌍' : '🎭'} ${tabLabel(t)}</span>
      <span class="browser-tab-close" onclick="closeTab('${t.id}', event)">✕</span>
    </div>
  `).join('') + `<div class="browser-tab-new" onclick="newTab('home','fake')">+</div>`;
}

function toggleMode() {
  const t = activeTab();
  if (!t) return;
  switchMode(t.mode === 'fake' ? 'real' : 'fake');
}
function switchMode(mode) {
  const t = activeTab();
  if (!t) return;
  t.mode = mode;
  navBrowser(t.history[t.index] || 'home');
}

function navBrowser(url) {
  const t = activeTab();
  if (!t) return;
  url = (url || '').trim().replace(/^https?:\/\//i, '');
  t.history = t.history.slice(0, t.index + 1);
  t.history.push(url);
  t.index = t.history.length - 1;
  renderTabStrip();
  renderActiveTab();
}

function tabBack() {
  const t = activeTab();
  if (!t || t.index <= 0) return;
  t.index--;
  renderTabStrip();
  renderActiveTab();
}

function tabForward() {
  const t = activeTab();
  if (!t || t.index >= t.history.length - 1) return;
  t.index++;
  renderTabStrip();
  renderActiveTab();
}

// A handful of big platforms expose an OFFICIAL embed endpoint for
// specific content (even though their main site blocks iframing
// entirely). Detect those and use them instead of a raw iframe.
function resolveRealEmbed(url) {
  let m;

  // YouTube video -> official embed player
  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-z0-9_-]{6,})/i);
  if (m) return { type: 'iframe', src: `https://www.youtube.com/embed/${m[1]}` };

  // Spotify track/album/playlist/episode -> official embed widget
  m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-z0-9]+)/i);
  if (m) return { type: 'iframe', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };

  // Google Maps -> embeddable map (no API key needed for this endpoint)
  m = url.match(/^(?:maps\.google\.com|google\.com\/maps)\/?(.*)$/i);
  if (m) {
    const query = m[1].replace(/^\?q=/, '') || 'world';
    return { type: 'iframe', src: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed` };
  }

  // A single X/Twitter post -> official oEmbed widget (not full feeds/profiles)
  m = url.match(/^(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i);
  if (m) return { type: 'tweet', tweetUrl: `https://twitter.com/${m[1]}/status/${m[2]}` };

  return null; // fall back to a raw iframe, which many sites will block
}

let twitterWidgetsLoaded = false;
function loadTwitterWidgetsScript(cb) {
  if (twitterWidgetsLoaded) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://platform.twitter.com/widgets.js';
  s.onload = () => { twitterWidgetsLoaded = true; cb(); };
  document.body.appendChild(s);
}

function renderActiveTab() {
  const t = activeTab();
  const page = document.getElementById('browser-page');
  const addr = document.getElementById('browser-addr');
  const modeBtn = document.getElementById('mode-btn');
  const note = document.getElementById('mode-note');
  if (!t || !page) return;

  const url = t.history[t.index];
  addr.value = url;
  if (modeBtn) modeBtn.textContent = t.mode === 'fake' ? '🎭 Fake Web' : '🌍 Real Web';
  if (note) note.textContent = t.mode === 'fake'
    ? 'Fake Web mode: pretend sites, always work.'
    : 'Real Web mode: YouTube videos, Spotify tracks, Google Maps places, and single X posts play via their official embeds. Most other big sites (Google search, Facebook, full X feeds...) block embedding on purpose — try wikipedia.org or a blog instead.';

  if (t.mode === 'real') {
    page.classList.add('real');
    if (!url.includes('.')) {
      page.classList.remove('real');
      page.innerHTML = `<h1>Type a real address</h1><p>e.g. wikipedia.org, example.com, a YouTube video link, a Spotify track link, or a Google Maps place.</p>`;
      return;
    }
    const embed = resolveRealEmbed(url);
    if (embed && embed.type === 'iframe') {
      page.innerHTML = `<iframe src="${embed.src}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else if (embed && embed.type === 'tweet') {
      page.classList.remove('real');
      page.innerHTML = `<div style="padding:10px;"><blockquote class="twitter-tweet"><a href="${embed.tweetUrl}"></a></blockquote></div>`;
      loadTwitterWidgetsScript(() => { if (window.twttr) window.twttr.widgets.load(page); });
    } else {
      page.innerHTML = `<iframe src="https://${url}"></iframe>`;
    }
  } else {
    page.classList.remove('real');
    const site = fakeSites[url.toLowerCase()];
    if (site) {
      page.innerHTML = site.html;
    } else {
      page.innerHTML = `<h1>Cannot find server</h1><p>"${url}" could not be located. This is the internet, but a very small, fake one.</p>
                         <p><a onclick="navBrowser('home')">Back to Home</a></p>`;
    }
  }
}

/* ==========================================================
   NOTEPAD
   ========================================================== */
let notepadCount = 0;
function openNotepad() {
  notepadCount++;
  const id = 'notepad' + (notepadCount > 1 ? notepadCount : '');
  const body = `
    <div class="notepad-body">
      <div class="notepad-toolbar">
        <button onclick="notepadOpenReal('${id}')">📂 Open Real File...</button>
        <button onclick="notepadSaveReal('${id}')">💾 Save As...</button>
      </div>
      <textarea id="ta-${id}" placeholder="Type something..."></textarea>
    </div>`;
  createWindow(id, 'Untitled - Notepad', '📝', body, { width: 400, height: 280 });
}

function notepadOpenReal(id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md,.js,.css,.html,.json,.csv,.log';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('ta-' + id).value = e.target.result; };
    reader.readAsText(file);
  };
  input.click();
}

// Uses the File System Access API when available (Chrome/Edge) for a
// real "Save As" dialog; falls back to a plain download otherwise.
async function notepadSaveReal(id) {
  const text = document.getElementById('ta-' + id).value;
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: 'untitled.txt' });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (e) { /* user cancelled */ }
  } else {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'untitled.txt';
    a.click();
  }
}

/* ==========================================================
   PAINT
   ========================================================== */
let paintCount = 0;
function openPaint() {
  paintCount++;
  const id = 'paint' + (paintCount > 1 ? paintCount : '');
  const colors = ['#000000', '#ffffff', '#ff0000', '#00aa00', '#0000ff', '#ffff00', '#ff8800', '#8800ff'];
  const body = `
    <div class="paint-body">
      <div class="paint-toolbar">
        ${colors.map(c => `<span class="paint-color" style="background:${c}" onclick="paintColor='${c}'"></span>`).join('')}
        <button onclick="clearPaint('${id}')">Clear</button>
      </div>
      <div class="paint-canvas-wrap"><canvas id="canvas-${id}"></canvas></div>
    </div>
  `;
  createWindow(id, 'untitled - Paint', '🎨', body, {
    width: 420, height: 320,
    onOpen: () => initPaintCanvas(id),
    onResize: () => resizePaintCanvas(id)
  });
}
let paintColor = '#000000';
function initPaintCanvas(id) {
  const canvas = document.getElementById('canvas-' + id);
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let drawing = false;
  canvas.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = paintColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);
  canvas._ctx = ctx;
}
function resizePaintCanvas(id) {
  const canvas = document.getElementById('canvas-' + id);
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const old = canvas.toDataURL();
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = old;
  canvas._ctx = ctx;
}
function clearPaint(id) {
  const canvas = document.getElementById('canvas-' + id);
  const ctx = canvas._ctx;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* ==========================================================
   CALCULATOR
   ========================================================== */
let calcCount = 0;
function openCalculator() {
  calcCount++;
  const id = 'calc' + (calcCount > 1 ? calcCount : '');
  const keys = ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+'];
  const body = `
    <div class="calc-body">
      <div class="calc-screen" id="screen-${id}">0</div>
      <div class="calc-grid">
        <button style="grid-column: span 4;" onclick="calcClear('${id}')">Clear</button>
        ${keys.map(k => `<button onclick="calcPress('${id}','${k}')">${k}</button>`).join('')}
      </div>
    </div>
  `;
  createWindow(id, 'Calculator', '🧮', body, { width: 240, height: 300, onOpen: () => { window['calcExpr_' + id] = ''; } });
}
function calcPress(id, key) {
  const varName = 'calcExpr_' + id;
  if (key === '=') {
    try {
      const result = Function('"use strict"; return (' + window[varName] + ')')();
      window[varName] = String(result);
    } catch (e) {
      window[varName] = 'Error';
    }
  } else {
    window[varName] = (window[varName] === 'Error' ? '' : (window[varName] || '')) + key;
  }
  document.getElementById('screen-' + id).textContent = window[varName] || '0';
}
function calcClear(id) {
  window['calcExpr_' + id] = '';
  document.getElementById('screen-' + id).textContent = '0';
}

/* ==========================================================
   IMAGE VIEWER
   ========================================================== */
let viewerCount = 0;
const imageViewers = {}; // id -> { files, index, zoom, rotation, fit, flipH }

// Call with no args to open an empty viewer with its own "Open..." button,
// or with (files[], startIndex) to open straight into a real set of images
// (e.g. from the File Explorer, enabling Prev/Next through the folder).
function openImageViewer(files, startIndex) {
  viewerCount++;
  const id = 'viewer' + (viewerCount > 1 ? viewerCount : '');
  const body = `
    <div class="viewer-body">
      <div class="viewer-toolbar">
        <button onclick="viewerOpenReal('${id}')">📂 Open...</button>
        <button onclick="viewerNav('${id}',-1)">◀ Prev</button>
        <span class="viewer-filename" id="vfname-${id}">No image loaded</span>
        <button onclick="viewerNav('${id}',1)">Next ▶</button>
      </div>
      <div class="viewer-toolbar viewer-tools">
        <button onclick="viewerZoom('${id}',-0.25)" title="Zoom out">➖</button>
        <span class="viewer-zoomlabel" id="vzoom-${id}">100%</span>
        <button onclick="viewerZoom('${id}',0.25)" title="Zoom in">➕</button>
        <button onclick="viewerFit('${id}')" id="vfit-${id}" title="Toggle fit / actual size">⛶ Fit</button>
        <button onclick="viewerRotate('${id}',-90)" title="Rotate left">⟲</button>
        <button onclick="viewerRotate('${id}',90)" title="Rotate right">⟳</button>
        <button onclick="viewerFlip('${id}')" title="Flip horizontally">⇋</button>
        <button onclick="viewerReset('${id}')" title="Reset view">Reset</button>
        <button onclick="viewerSlideshow('${id}')" id="vslide-${id}" title="Slideshow">▶ Slides</button>
      </div>
      <div class="viewer-canvas" id="vcanvas-${id}" onwheel="viewerWheel(event,'${id}')"><div class="viewer-empty">No image loaded</div></div>
      <div class="viewer-status" id="vstatus-${id}"></div>
    </div>
  `;
  createWindow(id, 'Image Viewer', '🖼️', body, { width: 520, height: 420, onOpen: () => {
    imageViewers[id] = { files: files || [], index: startIndex || 0, zoom: 1, rotation: 0, fit: true, flipH: false, timer: null };
    if (files && files.length) renderViewerImage(id);
  }});
}

function viewerOpenReal(id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => {
    if (!input.files.length) return;
    const v = imageViewers[id];
    v.files = Array.from(input.files);
    v.index = 0;
    viewerResetState(v);
    renderViewerImage(id);
  };
  input.click();
}

function viewerResetState(v) { v.zoom = 1; v.rotation = 0; v.flipH = false; v.fit = true; }

function viewerNav(id, dir) {
  const v = imageViewers[id];
  if (!v || !v.files.length) return;
  v.index = (v.index + dir + v.files.length) % v.files.length;
  viewerResetState(v);
  renderViewerImage(id);
}

function renderViewerImage(id) {
  const v = imageViewers[id];
  const canvas = document.getElementById('vcanvas-' + id);
  const fname = document.getElementById('vfname-' + id);
  if (!v || !v.files.length || !canvas) return;
  const file = v.files[v.index];
  fname.textContent = `${file.name} (${v.index + 1}/${v.files.length})`;
  const reader = new FileReader();
  reader.onload = (e) => {
    canvas.innerHTML = `<img id="vimg-${id}" src="${e.target.result}">`;
    const img = document.getElementById('vimg-' + id);
    img.onload = () => {
      const status = document.getElementById('vstatus-' + id);
      if (status) status.textContent = `${img.naturalWidth} × ${img.naturalHeight} px  •  ${(file.size / 1024).toFixed(1)} KB`;
    };
    applyViewerTransform(id);
  };
  reader.readAsDataURL(file);
}

function applyViewerTransform(id) {
  const v = imageViewers[id];
  const img = document.getElementById('vimg-' + id);
  const label = document.getElementById('vzoom-' + id);
  const fitBtn = document.getElementById('vfit-' + id);
  if (!v || !img) return;
  img.style.maxWidth = v.fit ? '100%' : 'none';
  img.style.maxHeight = v.fit ? '100%' : 'none';
  img.style.transform = `scale(${v.flipH ? -v.zoom : v.zoom}, ${v.zoom}) rotate(${v.flipH ? -v.rotation : v.rotation}deg)`;
  if (label) label.textContent = Math.round(v.zoom * 100) + '%';
  if (fitBtn) fitBtn.textContent = v.fit ? '⛶ Fit' : '1:1 Actual';
}

function viewerZoom(id, delta) {
  const v = imageViewers[id];
  if (!v) return;
  v.zoom = Math.min(8, Math.max(0.1, +(v.zoom + delta).toFixed(2)));
  applyViewerTransform(id);
}
function viewerWheel(e, id) {
  e.preventDefault();
  viewerZoom(id, e.deltaY < 0 ? 0.15 : -0.15);
}
function viewerFit(id) {
  const v = imageViewers[id];
  if (!v) return;
  v.fit = !v.fit;
  applyViewerTransform(id);
}
function viewerRotate(id, deg) {
  const v = imageViewers[id];
  if (!v) return;
  v.rotation = (v.rotation + deg + 360) % 360;
  applyViewerTransform(id);
}
function viewerFlip(id) {
  const v = imageViewers[id];
  if (!v) return;
  v.flipH = !v.flipH;
  applyViewerTransform(id);
}
function viewerReset(id) {
  const v = imageViewers[id];
  if (!v) return;
  viewerResetState(v);
  applyViewerTransform(id);
}
function viewerSlideshow(id) {
  const v = imageViewers[id];
  const btn = document.getElementById('vslide-' + id);
  if (!v || v.files.length < 2) return;
  if (v.timer) {
    clearInterval(v.timer); v.timer = null;
    if (btn) btn.textContent = '▶ Slides';
  } else {
    v.timer = setInterval(() => {
      if (!openWindows[id]) { clearInterval(v.timer); return; }
      viewerNav(id, 1);
    }, 3000);
    if (btn) btn.textContent = '⏸ Stop';
  }
}

/* ==========================================================
   MEDIA PLAYER  (plays real audio files you open, with a
   live frequency visualizer via the Web Audio API)
   ========================================================== */
let playerCount = 0;
const mediaPlayers = {}; // id -> { audio, analyser, dataArray, raf, ctx }

function openMediaPlayer(initialFile) {
  playerCount++;
  const id = 'player' + (playerCount > 1 ? playerCount : '');
  const body = `
    <div class="player-body">
      <div class="player-screen">
        <div class="player-title" id="ptitle-${id}">No song loaded</div>
        <div class="player-time"><span id="pcur-${id}">0:00</span><span id="pdur-${id}">0:00</span></div>
      </div>
      <canvas class="player-visualizer" id="pviz-${id}"></canvas>
      <input type="range" class="player-seek" id="pseek-${id}" min="0" max="100" value="0" oninput="playerSeek('${id}')">
      <div class="player-controls">
        <button onclick="playerOpenReal('${id}')">📂 Open Song...</button>
        <button onclick="playerToggle('${id}')" id="pplay-${id}">▶</button>
        <button onclick="playerStop('${id}')">■</button>
        <div class="player-volume">🔊<input type="range" min="0" max="100" value="80" oninput="playerVolume('${id}', this.value)"></div>
      </div>
    </div>
  `;
  createWindow(id, 'Media Player', '🎵', body, { width: 320, height: 260, onOpen: () => {
    const audio = new Audio();
    audio.volume = 0.8;
    mediaPlayers[id] = { audio, analyser: null, dataArray: null, raf: null };
    audio.addEventListener('timeupdate', () => updatePlayerTime(id));
    audio.addEventListener('ended', () => { document.getElementById('pplay-' + id).textContent = '▶'; });
    if (initialFile) loadSongIntoPlayer(id, initialFile);
  }});
}

function playerOpenReal(id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.onchange = () => { if (input.files[0]) loadSongIntoPlayer(id, input.files[0]); };
  input.click();
}

function loadSongIntoPlayer(id, file) {
  const p = mediaPlayers[id];
  if (!p) return;
  p.audio.src = URL.createObjectURL(file);
  document.getElementById('ptitle-' + id).textContent = file.name;
  setupVisualizer(id);
  p.audio.play();
  document.getElementById('pplay-' + id).textContent = '⏸';
}

function setupVisualizer(id) {
  const p = mediaPlayers[id];
  if (!p || p.analyser) { startVisualizerLoop(id); return; } // already wired, just (re)start loop
  try {
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx = ctx;
    const source = ctx.createMediaElementSource(p.audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    p.analyser = analyser;
    p.dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { /* Web Audio not available; player still works without visualizer */ }
  startVisualizerLoop(id);
}

function startVisualizerLoop(id) {
  const p = mediaPlayers[id];
  const canvas = document.getElementById('pviz-' + id);
  if (!p || !canvas) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const ctx2d = canvas.getContext('2d');

  function draw() {
    if (!mediaPlayers[id]) return; // window closed
    p.raf = requestAnimationFrame(draw);
    ctx2d.fillStyle = '#000';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    if (p.analyser) {
      p.analyser.getByteFrequencyData(p.dataArray);
      const barW = canvas.width / p.dataArray.length;
      for (let i = 0; i < p.dataArray.length; i++) {
        const h = (p.dataArray[i] / 255) * canvas.height;
        ctx2d.fillStyle = '#7fffd4';
        ctx2d.fillRect(i * barW, canvas.height - h, barW - 1, h);
      }
    }
  }
  if (p.raf) cancelAnimationFrame(p.raf);
  draw();
}

function playerToggle(id) {
  const p = mediaPlayers[id];
  if (!p || !p.audio.src) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (p.audio.paused) { p.audio.play(); document.getElementById('pplay-' + id).textContent = '⏸'; }
  else { p.audio.pause(); document.getElementById('pplay-' + id).textContent = '▶'; }
}

function playerStop(id) {
  const p = mediaPlayers[id];
  if (!p) return;
  p.audio.pause();
  p.audio.currentTime = 0;
  document.getElementById('pplay-' + id).textContent = '▶';
}

function playerVolume(id, val) {
  const p = mediaPlayers[id];
  if (p) p.audio.volume = val / 100;
}

function playerSeek(id) {
  const p = mediaPlayers[id];
  const seek = document.getElementById('pseek-' + id);
  if (!p || !p.audio.duration) return;
  p.audio.currentTime = (seek.value / 100) * p.audio.duration;
}

function updatePlayerTime(id) {
  const p = mediaPlayers[id];
  if (!p || !p.audio.duration) return;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  document.getElementById('pcur-' + id).textContent = fmt(p.audio.currentTime);
  document.getElementById('pdur-' + id).textContent = fmt(p.audio.duration);
  const seek = document.getElementById('pseek-' + id);
  if (seek) seek.value = (p.audio.currentTime / p.audio.duration) * 100;
}

/* ==========================================================
   VIDEO PLAYER  (plays real video files you open, native
   browser controls, framed in a retro black "screen")
   ========================================================== */
let videoCount = 0;
function openVideoPlayer(initialFile) {
  videoCount++;
  const id = 'video' + (videoCount > 1 ? videoCount : '');
  const body = `
    <div class="video-body">
      <div class="video-toolbar">
        <button onclick="videoOpenReal('${id}')">📂 Open Video...</button>
      </div>
      <div class="video-stage" id="vstage-${id}"><div class="video-empty">No video loaded</div></div>
    </div>
  `;
  createWindow(id, 'Video Player', '🎬', body, { width: 480, height: 360, onOpen: () => {
    if (initialFile) loadVideoIntoPlayer(id, initialFile);
  }});
}

function videoOpenReal(id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.onchange = () => { if (input.files[0]) loadVideoIntoPlayer(id, input.files[0]); };
  input.click();
}

function loadVideoIntoPlayer(id, file) {
  const stage = document.getElementById('vstage-' + id);
  if (!stage) return;
  stage.innerHTML = `<video controls autoplay src="${URL.createObjectURL(file)}"></video>`;
}

/* ==========================================================
   PERSISTENCE  (icon positions, wallpaper, mute — survives refresh)
   ========================================================== */
const STORAGE_KEY = 'retroOsState';

function saveState() {
  const icons = {};
  document.querySelectorAll('.icon').forEach(el => {
    icons[el.id] = { left: el.style.left, top: el.style.top };
  });
  const state = {
    icons,
    wallpaper: document.getElementById('desktop').style.background || '',
    muted: systemMuted,
    theme: document.body.dataset.theme || 'classic95'
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable, ignore */ }
}

function loadState() {
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return; }
  if (!state) return;

  if (state.icons) {
    Object.keys(state.icons).forEach(id => {
      const el = document.getElementById(id);
      if (el && state.icons[id].left) {
        el.style.left = state.icons[id].left;
        el.style.top = state.icons[id].top;
      }
    });
  }
  if (state.muted) {
    systemMuted = true;
    document.getElementById('mute-btn').textContent = '🔇';
  }
  if (state.theme) setTheme(state.theme, false);
  if (state.wallpaper) document.getElementById('desktop').style.background = state.wallpaper;
  else if (state.theme) applyThemeWallpaper(state.theme);
}

/* ==========================================================
   THEMES  (95/98, XP, Vista/7, 10, 11)
   ========================================================== */
const themes = [
  { id: 'classic95', label: '95 / 98', start: '🪟 Start', preview: 'linear-gradient(90deg,#000080,#1084d0)' },
  { id: 'xp',        label: 'XP',       start: '⊞ start', preview: 'linear-gradient(180deg,#2a8fff,#0054e3)' },
  { id: 'seven',     label: 'Vista/7',  start: '⊞',        preview: 'linear-gradient(180deg,#bfe0ff,#5fa2e0)' },
  { id: 'ten',       label: '10',       start: '⊞',        preview: '#0078d7' },
  { id: 'eleven',    label: '11',       start: '⊞',        preview: '#f3f3f3' }
];

// CSS-only homages to each era's default desktop look (original gradients
// and shapes, not reproductions of the actual wallpaper images).
const themeWallpapers = {
  classic95: '#008080',
  xp: 'radial-gradient(ellipse 140% 55% at 30% 105%, #7ed23f 0%, #4a9b24 55%, transparent 56%), radial-gradient(ellipse 120% 50% at 90% 108%, #5fb82e 0%, #3b8a1c 55%, transparent 56%), linear-gradient(to bottom, #2468c8 0%, #5aa6ee 45%, #cfeaff 85%)',
  seven: 'radial-gradient(ellipse 60% 40% at 25% 35%, rgba(90,190,255,0.75), transparent 70%), radial-gradient(ellipse 50% 60% at 78% 62%, rgba(30,110,220,0.8), transparent 70%), radial-gradient(ellipse 80% 30% at 50% 95%, rgba(150,220,255,0.5), transparent 70%), linear-gradient(135deg, #05224d, #0b4a9c 55%, #0a2d63)',
  ten: 'radial-gradient(ellipse 45% 70% at 62% 50%, rgba(80,190,255,0.85), transparent 65%), radial-gradient(ellipse 30% 50% at 70% 55%, rgba(200,240,255,0.55), transparent 70%), linear-gradient(120deg, #00162e 0%, #004a8f 55%, #0078d7 100%)',
  eleven: 'radial-gradient(circle at 35% 40%, rgba(255,255,255,0.55), transparent 35%), radial-gradient(ellipse 55% 45% at 65% 60%, #4aa3ff, transparent 70%), radial-gradient(ellipse 50% 50% at 25% 70%, #7a5cff, transparent 70%), linear-gradient(135deg, #d6e8ff, #8fbcff 50%, #b9a6ff)'
};
function applyThemeWallpaper(id) {
  document.getElementById('desktop').style.background = themeWallpapers[id] || themeWallpapers.classic95;
}

// applyWallpaper=false is used when restoring a saved session so a
// user's custom wallpaper choice isn't overwritten by the theme default.
function setTheme(id, applyWallpaper = true) {
  document.body.dataset.theme = (id === 'classic95') ? '' : id;
  const t = themes.find(t => t.id === id) || themes[0];
  document.getElementById('start-btn').textContent = t.start;
  document.querySelectorAll('.theme-option').forEach(el => el.classList.toggle('selected', el.dataset.themeId === id));
  if (applyWallpaper) applyThemeWallpaper(id);
  saveState();
}

/* ==========================================================
   CONTROL PANEL  (wallpaper + theme + system sound settings)
   ========================================================== */
const wallpapers = [
  { name: 'Teal (classic)', value: '#008080' },
  { name: 'Navy', value: '#000080' },
  { name: 'Forest', value: '#204020' },
  { name: 'Maroon', value: '#4a0000' },
  { name: 'Purple Haze', value: 'linear-gradient(135deg, #2b0a3d, #6a0dad)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #ff7e5f, #feb47b)' }
];

function openControlPanel() {
  const current = document.getElementById('desktop').style.background || '#008080';
  const activeTheme = document.body.dataset.theme || 'classic95';
  const body = `
    <div class="cp-body">
      <div class="cp-section">
        <h3>🎨 Windows Theme</h3>
        ${themes.map(t => `
          <div class="theme-option${t.id === activeTheme ? ' selected' : ''}" data-theme-id="${t.id}" onclick="setTheme('${t.id}')">
            <div class="theme-swatch-preview" style="background:${t.preview}"></div>
            ${t.label}
          </div>
        `).join('')}
      </div>
      <div class="cp-section">
        <h3>🖼️ Desktop Wallpaper</h3>
        <div id="wallpaper-swatches">
          ${wallpapers.map(w => `<span class="wallpaper-swatch${w.value === current ? ' selected' : ''}" style="background:${w.value}" title="${w.name}" onclick="setWallpaper('${w.value}', this)"></span>`).join('')}
        </div>
      </div>
      <div class="cp-section">
        <h3>🔊 Sound</h3>
        <label><input type="checkbox" id="cp-sound" ${systemMuted ? '' : 'checked'} onchange="setMuted(!this.checked)"> Enable system sounds</label>
      </div>
      <div class="cp-section">
        <h3>ℹ️ System</h3>
        <button onclick="showAbout()">About RetroOS</button>
        <button onclick="if(confirm('Reset all saved settings and icon positions?')) resetState()">Reset to Defaults</button>
      </div>
    </div>
  `;
  createWindow('control', 'Control Panel', '🎛️', body, { width: 340, height: 320 });
}

function setWallpaper(value, el) {
  document.getElementById('desktop').style.background = value;
  document.querySelectorAll('.wallpaper-swatch').forEach(s => s.classList.remove('selected'));
  if (el) el.classList.add('selected');
  saveState();
}

function setMuted(val) {
  systemMuted = val;
  document.getElementById('mute-btn').textContent = systemMuted ? '🔇' : '🔊';
  saveState();
}

function resetState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  location.reload();
}

/* ==========================================================
   IDLE SCREENSAVER  (classic bouncing-logo, dismiss on input)
   ========================================================== */
let lastActivity = Date.now();
let screensaverActive = false;
let ssX = 40, ssY = 40, ssDX = 1.4, ssDY = 1.1;
const IDLE_TIMEOUT = 90000; // 90 seconds

['mousemove', 'mousedown', 'keydown', 'scroll'].forEach(evt => {
  document.addEventListener(evt, () => {
    lastActivity = Date.now();
    if (screensaverActive) dismissScreensaver();
  });
});

setInterval(() => {
  if (!screensaverActive && Date.now() - lastActivity > IDLE_TIMEOUT) {
    document.getElementById('screensaver').classList.add('active');
    screensaverActive = true;
  }
}, 2000);

function dismissScreensaver() {
  screensaverActive = false;
  document.getElementById('screensaver').classList.remove('active');
}

function animateScreensaver() {
  if (screensaverActive) {
    const logo = document.getElementById('screensaver-logo');
    const maxX = window.innerWidth - logo.offsetWidth;
    const maxY = window.innerHeight - logo.offsetHeight;
    ssX += ssDX; ssY += ssDY;
    if (ssX <= 0 || ssX >= maxX) ssDX *= -1;
    if (ssY <= 0 || ssY >= maxY) ssDY *= -1;
    logo.style.left = ssX + 'px';
    logo.style.top = ssY + 'px';
  }
  requestAnimationFrame(animateScreensaver);
}
animateScreensaver();

// Run last: restores theme/wallpaper/icons/mute from a previous visit.
// Must come after themes/wallpapers are defined above.
loadState();
