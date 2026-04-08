// dashboard.js
import { API } from '../api.js'
import state from '../store.js'
import { addAction } from './actions.js'
import { showModal, closeModal } from './modals.js'

export async function renderDashboard() {
  const view = document.getElementById('view-dashboard')
  view.innerHTML = `
    <div class="dash-scroll">
      <div class="dash-header">
        <div>
          <div class="dash-title">Your Projects</div>
          <div class="dash-subtitle">Every story you're writing lives here.</div>
        </div>
        <div class="dash-cta-row">
          <button class="dash-cta-btn primary" onclick="openNewProjectModal()">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/></svg>
            New Project
          </button>
          <button class="dash-cta-btn secondary" onclick="openExistingProjectModal()">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h4l2 2h6v8H2z"/><path d="M8 8v4M6 10h4" opacity="0.6"/></svg>
            Open Existing
          </button>
        </div>
      </div>

      <div class="dash-stats-row" id="dash-stats"></div>

      <div class="dash-section-title">Recent Projects</div>
      <div class="projects-grid" id="projects-grid">
        <div class="projects-loading">Loading your projects…</div>
      </div>
    </div>`

  await loadProjects()
}

async function loadProjects() {
  try {
    const projects = await API.getProjects()
    state.set('projects', projects)
    renderStats(projects)
    renderProjectGrid(projects)
  } catch (e) {
    document.getElementById('projects-grid').innerHTML =
      `<div class="projects-error">Could not load projects. Is the server running?<br><small>${e.message}</small></div>`
  }
}

function renderStats(projects) {
  const totalWords = projects.reduce((s, p) => s + (p.words || 0), 0)
  const totalScenes = projects.reduce((s, p) => s + (p.scenes || 0), 0)
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="label">Projects</div><div class="value">${projects.length}</div></div>
    <div class="stat-card"><div class="label">Total Words</div><div class="value">${(totalWords/1000).toFixed(0)}k</div></div>
    <div class="stat-card"><div class="label">Total Scenes</div><div class="value">${totalScenes}</div></div>
    <div class="stat-card"><div class="label">In Progress</div><div class="value">${projects.filter(p => p.completion > 0 && p.completion < 100).length}</div></div>`
}

export function renderProjectGrid(projects) {
  const grid = document.getElementById('projects-grid')
  if (!grid) return
  if (!projects.length) {
    grid.innerHTML = `<div class="projects-empty">No projects yet. Create one to get started.</div>`
    return
  }
  grid.innerHTML = projects.map(p => projectCardHTML(p)).join('')
}

function projectCardHTML(p) {
  const completion = p.completion || 0
  const barColor = completion > 80 ? 'var(--green)' : completion > 40 ? 'var(--accent)' : 'var(--orange)'
  const genreColors = {
    Fantasy:'linear-gradient(135deg,#1a1508,#2d2010)',
    'Sci-Fi':'linear-gradient(135deg,#0d0d1a,#1a0d2e)',
    Romance:'linear-gradient(135deg,#0a1520,#0f2535)',
    Mystery:'linear-gradient(135deg,#0a150d,#0f2015)',
    Horror:'linear-gradient(135deg,#100a1a,#1a0f2e)',
    default:'linear-gradient(135deg,#0e0f11,#1a1c21)'
  }
  const bg = genreColors[p.genre] || genreColors.default
  const coverImg = p.coverImage
    ? `<img src="/api/images/${p.id}/file/${p.coverImage}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.45">`
    : ''

  return `
  <div class="project-card" data-id="${p.id}" onclick="window.openProject(${JSON.stringify(p).replace(/"/g,'&quot;')})">
    <div class="card-cover-bg" style="background:${bg}">
      ${coverImg}
      <span class="card-genre-badge">${p.genre || 'Other'}</span>
      <span class="card-completion-badge" style="color:${barColor}">${completion}%</span>
    </div>
    <button class="card-three-dot" onclick="event.stopPropagation();openCardMenu(event,${JSON.stringify(p).replace(/"/g,'&quot;')})">···</button>
    <div class="card-overlay"><button class="card-overlay-btn">Open Project</button></div>
    <div class="card-body">
      <div class="card-title">${p.title}</div>
      <div class="card-desc">${p.desc || '<em>No description yet.</em>'}</div>
      <div class="card-progress"><div class="card-progress-bar" style="width:${completion}%;background:${barColor}"></div></div>
      <div class="card-meta">
        <div class="card-meta-item">${(p.words/1000).toFixed(0)}k words</div>
        <div class="card-meta-item">${p.scenes} scenes</div>
        <div class="card-meta-item">${p.vars || 0} vars</div>
      </div>
    </div>
  </div>`
}

// ── Three dot card menu ────────────────────────────────────────────────────
window.openCardMenu = function(event, project) {
  closeDropdown()
  const dropdown = document.createElement('div')
  dropdown.className = 'card-dropdown'
  dropdown.id = 'card-dropdown'
  dropdown.innerHTML = `
    <button class="card-dropdown-item" onclick="window.openProject(${JSON.stringify(project).replace(/"/g,'&quot;')})">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 7h10M7 2l5 5-5 5"/></svg> Open Project
    </button>
    <button class="card-dropdown-item" onclick="renameProjectPrompt('${project.id}','${project.title.replace(/'/g,"\\'")}')">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 10l2-2 6-6 2 2-6 6-2 2z"/></svg> Rename
    </button>
    <button class="card-dropdown-item" onclick="openRunModal('${project.id}','${project.title.replace(/'/g,"\\'")}')">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3,2 11,7 3,12"/></svg> Run Game
    </button>
    <div class="card-dropdown-sep"></div>
    <button class="card-dropdown-item danger" onclick="deleteProjectConfirm('${project.id}','${project.title.replace(/'/g,"\\'")}')">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h10l-1 8H3L2 4zM1 4h12M5 4V2h4v2"/></svg> Move to Bin
    </button>`
  document.body.appendChild(dropdown)
  const rect = event.target.getBoundingClientRect()
  dropdown.style.position = 'fixed'
  dropdown.style.top = (rect.bottom + 6) + 'px'
  dropdown.style.left = Math.min(rect.left - 140, window.innerWidth - 195) + 'px'
  dropdown.style.zIndex = '9999'
  setTimeout(() => document.addEventListener('click', closeDropdown, { once: true }), 50)
}

function closeDropdown() {
  document.getElementById('card-dropdown')?.remove()
}

window.renameProjectPrompt = async function(id, currentTitle) {
  closeDropdown()
  const newTitle = prompt('Rename project:', currentTitle)
  if (!newTitle?.trim() || newTitle.trim() === currentTitle) return
  await API.updateProject(id, { title: newTitle.trim() })
  addAction('edit', `Renamed project to: ${newTitle.trim()}`)
  showToast('Renamed to: ' + newTitle.trim(), 'success')
  renderDashboard()
}

window.deleteProjectConfirm = async function(id, title) {
  closeDropdown()
  showModal({
    icon: '🗑️',
    title: 'Move to Bin?',
    desc: `"${title}" will be moved to the Recycle Bin. You can restore it from there.`,
    confirmLabel: 'Move to Bin',
    confirmClass: 'modal-confirm-delete',
    onConfirm: async () => {
      await API.deleteProject(id)
      addAction('delete', `Moved to bin: ${title}`, null, 'warn')
      showToast(`${title} moved to Recycle Bin`)
      closeModal()
      renderDashboard()
      updateBinBadge()
    }
  })
}

// ── Run Game Modal ────────────────────────────────────────────────────────
window.openRunModal = async function(projectId, title) {
  closeDropdown()
  let savedPath = ''
  try {
    const r = await API.getGamePath(projectId)
    savedPath = r.gamePath || ''
  } catch {}

  showModal({
    icon: '▶',
    title: `Run: ${title}`,
    bodyHTML: `
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:16px">
        Enter the path to your game's <strong style="color:var(--text-primary)">web</strong> folder (the one containing <code style="background:var(--bg-base);padding:2px 5px;border-radius:3px;font-family:var(--font-mono)">index.html</code>).
        Skein will sync your latest scenes and open the game in your browser.
      </p>
      <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">Game folder path</div>
      <input id="run-path-input" type="text"
        placeholder="e.g. C:\\Users\\you\\Desktop\\beast games\\web"
        value="${savedPath}"
        style="width:100%;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text-primary);font-family:var(--font-mono);font-size:11px;outline:none;margin-bottom:8px">
      <div style="font-size:12px;color:var(--text-muted);font-style:italic">The path will be saved so you don't need to enter it again.</div>
    `,
    confirmLabel: '▶ Run Game',
    confirmClass: 'modal-confirm-run',
    onConfirm: async () => {
      const gamePath = document.getElementById('run-path-input').value.trim()
      if (!gamePath) { showToast('Please enter the game folder path', 'error'); return }
      closeModal()
      try {
        await API.setGamePath(projectId, gamePath)
        const result = await API.runGame(projectId, gamePath)
        addAction('run', `Game launched: ${title}`, result.synced)
        showToast('▶ Game opened in browser!', 'success')
      } catch (e) {
        addAction('run', `Run failed: ${title}`, e.message, 'error')
        showToast(`Run failed: ${e.message}`, 'error')
      }
    }
  })
}

// ── New Project Modal ─────────────────────────────────────────────────────
window.openNewProjectModal = function() {
  showModal({
    icon: '✦',
    title: 'New Project',
    bodyHTML: `
      <div class="form-field"><label>Project Title *</label>
        <input id="np-title" type="text" placeholder="e.g. The Shattered Crown" class="modal-input"></div>
      <div class="form-field"><label>Genre</label>
        <select id="np-genre" class="modal-input modal-select">
          ${['Fantasy','Sci-Fi','Romance','Mystery','Horror','Historical','Contemporary','Thriller','Other'].map(g => `<option>${g}</option>`).join('')}
        </select></div>
      <div class="form-field"><label>Short Description</label>
        <textarea id="np-desc" placeholder="What is your story about?" class="modal-input modal-textarea"></textarea></div>
      <div class="form-field"><label>Author Name</label>
        <input id="np-author" type="text" placeholder="Your name or pen name" class="modal-input"></div>`,
    confirmLabel: 'Create Project',
    confirmClass: 'modal-confirm-ok',
    onConfirm: async () => {
      const title = document.getElementById('np-title').value.trim()
      if (!title) { document.getElementById('np-title').style.borderColor = 'var(--red)'; return }
      try {
        const project = await API.createProject({
          title,
          genre: document.getElementById('np-genre').value,
          desc: document.getElementById('np-desc').value.trim(),
          author: document.getElementById('np-author').value.trim()
        })
        addAction('create', `Created project: ${project.title}`, `ID: ${project.id}`)
        closeModal()
        showToast(`✦ ${project.title} created!`, 'success')
        renderDashboard()
      } catch (e) {
        showToast(e.message, 'error')
      }
    }
  })
  setTimeout(() => document.getElementById('np-title')?.focus(), 100)
}

// ── Open Existing Project Modal ───────────────────────────────────────────
window.openExistingProjectModal = function() {
  showModal({
    icon: '📂',
    title: 'Open Existing Project',
    bodyHTML: `
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:16px">
        Select your ChoiceScript scene <strong style="color:var(--text-primary)">.txt files</strong>.
        Select all at once — startup, every scene, everything.
      </p>
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-muted)">
        ℹ️ Max import size: <strong style="color:var(--text-primary)">500 MB</strong> — more than enough for any ChoiceScript project.
      </div>
      <div class="form-field"><label>Project Title *</label>
        <input id="ep-title" type="text" placeholder="Name for this project in Quillon" class="modal-input"></div>
      <div class="form-field"><label>Genre</label>
        <select id="ep-genre" class="modal-input modal-select">
          ${['Fantasy','Sci-Fi','Romance','Mystery','Horror','Historical','Contemporary','Thriller','Other'].map(g => `<option>${g}</option>`).join('')}
        </select></div>
      <div class="form-field"><label>Author</label>
        <input id="ep-author" type="text" placeholder="Author name" class="modal-input"></div>
      <div class="form-field">
        <label>Scene Files (.txt) *</label>
        <div class="file-drop-zone" id="ep-dropzone" onclick="document.getElementById('ep-file-input').click()">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M6 20v6h20v-6"/><path d="M16 4v16M10 10l6-6 6 6"/></svg>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-top:8px">Click to browse or drag scene files here</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Select all .txt scene files at once</div>
        </div>
        <input type="file" id="ep-file-input" multiple accept=".txt" style="display:none" onchange="handleSceneFileSelect(event)">
        <div id="ep-file-list" style="margin-top:10px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)"></div>
      </div>`,
    confirmLabel: 'Import Project',
    confirmClass: 'modal-confirm-ok',
    onConfirm: importExistingProject
  })
  setTimeout(() => document.getElementById('ep-title')?.focus(), 100)
}

window.handleSceneFileSelect = function(event) {
  const files = Array.from(event.target.files)
  const listEl = document.getElementById('ep-file-list')
  if (!files.length) return
  listEl.innerHTML = files.map(f =>
    `<div style="padding:3px 0;display:flex;align-items:center;gap:6px">
      <span style="color:var(--green)">✓</span> ${f.name} <span style="color:var(--text-muted)">(${(f.size/1024).toFixed(0)} KB)</span>
    </div>`).join('')
  // Auto-fill title from startup.txt content if present
  const startup = files.find(f => f.name.toLowerCase().startsWith('startup'))
  if (startup) {
    const reader = new FileReader()
    reader.onload = e => {
      const titleMatch = e.target.result.match(/^\*title\s+(.+)$/m)
      const authorMatch = e.target.result.match(/^\*author\s+(.+)$/m)
      if (titleMatch && !document.getElementById('ep-title').value) {
        document.getElementById('ep-title').value = titleMatch[1].trim()
      }
      if (authorMatch && !document.getElementById('ep-author').value) {
        document.getElementById('ep-author').value = authorMatch[1].trim()
      }
    }
    reader.readAsText(startup)
  }
}

async function importExistingProject() {
  const title = document.getElementById('ep-title').value.trim()
  const fileInput = document.getElementById('ep-file-input')
  if (!title) { document.getElementById('ep-title').style.borderColor = 'var(--red)'; return }
  if (!fileInput.files.length) { showToast('Please select at least one scene file', 'error'); return }

  // Read all files
  const files = await Promise.all(Array.from(fileInput.files).map(file =>
    new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve({ name: file.name, content: e.target.result })
      reader.readAsText(file)
    })
  ))

  try {
    const project = await API.importProject({
      title,
      genre: document.getElementById('ep-genre').value,
      author: document.getElementById('ep-author').value.trim(),
      files
    })
    addAction('import', `Imported project: ${project.title}`, `${files.length} scenes imported`)
    closeModal()
    showToast(`✦ ${project.title} imported — ${files.length} scenes loaded`, 'success')
    renderDashboard()
  } catch (e) {
    showToast(e.message, 'error')
  }
}

// ── Bin badge update ───────────────────────────────────────────────────────
async function updateBinBadge() {
  try {
    const bin = await API.getBin()
    const badge = document.getElementById('bin-count-badge')
    if (badge) {
      badge.style.display = bin.length > 0 ? 'inline-block' : 'none'
      badge.textContent = bin.length
    }
  } catch {}
}
window.updateBinBadge = updateBinBadge
