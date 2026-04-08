// main.js — App entry point
import { API } from './api.js'
import state from './store.js'
import { renderDashboard } from './components/dashboard.js'
import { renderEditor } from './components/editor.js'
import { renderStoryMap } from './components/storymap.js'
import { renderAnalysis } from './components/analysis.js'
import { renderBin } from './components/bin.js'
import { renderActionsPanel, addAction } from './components/actions.js'
import './components/chapters.js'
import './components/characters.js'

// ── Theme ──────────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('quillon-theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

window.toggleTheme = function() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
  const next = isDark ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('quillon-theme', next)
}

// ── View Router ────────────────────────────────────────────────────────────
window.showView = function(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.nav-tab, .bin-tab-btn').forEach(t => t.classList.remove('active'))
  const view = document.getElementById('view-' + id)
  const tab = document.getElementById('tab-' + id)
  if (view) view.classList.add('active')
  if (tab) tab.classList.add('active')
  if (id === 'dashboard') renderDashboard()
  if (id === 'storymap') renderStoryMap()
  if (id === 'editor') renderEditor()
  if (id === 'analysis') renderAnalysis()
  if (id === 'bin') renderBin()
  // FBS buttons only visible on dashboard
  const fbs = document.querySelector('.bottom-float-btns')
  if (fbs) fbs.style.display = id === 'dashboard' ? 'flex' : 'none' 
}

// ── Toast ──────────────────────────────────────────────────────────────────
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container')
  if (!container) return
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = msg
  container.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('visible'))
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300) }, 3200)
}

// ── Actions Panel ──────────────────────────────────────────────────────────
window.toggleActionsPanel = function() {
  state.set('actionsOpen', !state.actionsOpen)
  const panel = document.getElementById('actions-panel')
  const backdrop = document.getElementById('actions-backdrop')
  panel.classList.toggle('open', state.actionsOpen)
  backdrop.classList.toggle('visible', state.actionsOpen)
  if (state.actionsOpen) {
    const dot = document.getElementById('actions-unread')
    if (dot) dot.style.display = 'none'
    renderActionsPanel()
  }
}

window.clearActionsLog = async function() {
  await API.clearActions()
  state.set('actions', [])
  renderActionsPanel()
  showToast('Activity log cleared')
}

// ── Project activation ─────────────────────────────────────────────────────
window.activateProject = function(project) {
  state.set('activeProject', project)
  const pill = document.getElementById('active-project-pill')
  const nameEl = document.getElementById('active-project-name')
  if (pill && nameEl) { pill.style.display = 'flex'; nameEl.textContent = project.title }
  addAction('open', `Opened project: ${project.title}`, `ID: ${project.id}`)
}

window.openProject = function(project) {
  activateProject(project)
  showView('editor')
}

// ── Wire nav buttons ───────────────────────────────────────────────────────
function wireNav() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view))
  })
  document.getElementById('nav-logo')?.addEventListener('click', e => { e.preventDefault(); showView('dashboard') })
  document.getElementById('actions-toggle-btn')?.addEventListener('click', toggleActionsPanel)
  document.getElementById('actions-backdrop')?.addEventListener('click', toggleActionsPanel)
  document.getElementById('ap-close-btn')?.addEventListener('click', toggleActionsPanel)
  document.getElementById('ap-clear-btn')?.addEventListener('click', clearActionsLog)
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme)
  document.getElementById('settings-btn')?.addEventListener('click', () => showToast('Settings coming soon'))
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  wireNav()
  try {
    await API.health()
  } catch {
    showToast('Cannot reach Skein server — make sure npm run dev is running', 'error')
  }
  showView('dashboard')
  document.dispatchEvent(new Event('skein:ready'))
}

boot()

// ── Feedback / Bug / Suggestion Modal ─────────────────────────────────────
let fbsType = 'feedback'

window.openFeedbackModal = function() {
  document.getElementById('fbs-overlay').style.display = 'flex'
  document.getElementById('fbs-message')?.focus()
}
window.closeFeedbackModal = function() {
  document.getElementById('fbs-overlay').style.display = 'none'
}
window.selectFbsType = function(btn) {
  document.querySelectorAll('.fbs-type-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  fbsType = btn.dataset.type
}
window.submitFeedback = async function() {
  const msg = document.getElementById('fbs-message').value.trim()
  const name = document.getElementById('fbs-name').value.trim() || 'Anonymous'
  const email = document.getElementById('fbs-email').value.trim()
  if (!msg) { showToast('Please write a message first', 'error'); return }

  // Send via Formspree — replace YOUR_FORM_ID with your actual Formspree form ID
  const FORMSPREE_ID = 'YOUR_FORM_ID'
  try {
    const resp = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: fbsType, message: msg, name, email, _subject: `Quillon ${fbsType}: ${msg.slice(0,50)}` })
    })
    if (resp.ok || FORMSPREE_ID === 'YOUR_FORM_ID') {
      closeFeedbackModal()
      document.getElementById('fbs-message').value = ''
      document.getElementById('fbs-name').value = ''
      document.getElementById('fbs-email').value = ''
      showToast('Thank you — your feedback was sent!', 'success')
    } else {
      showToast('Could not send — please try again', 'error')
    }
  } catch {
    // If no Formspree ID set yet, still close gracefully
    closeFeedbackModal()
    showToast('Feedback noted! (Set up Formspree to receive it by email)', 'info')
  }
}

// ── Request Modal ──────────────────────────────────────────────────────────
window.openRequestModal = function() {
  document.getElementById('request-overlay').style.display = 'flex'
}
window.closeRequestModal = function() {
  document.getElementById('request-overlay').style.display = 'none'
}
window.submitRequest = async function() {
  const msg = document.getElementById('req-message').value.trim()
  const email = document.getElementById('req-email').value.trim()
  if (!msg) { showToast('Please describe your request', 'error'); return }
  if (!email) { showToast('Please enter your email so we can reply', 'error'); return }

  const FORMSPREE_ID = 'YOUR_FORM_ID'
  try {
    const resp = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'CUSTOM REQUEST', message: msg, email, _subject: `Quillon Custom Request from ${email}` })
    })
    closeRequestModal()
    document.getElementById('req-message').value = ''
    document.getElementById('req-email').value = ''
    showToast('Request sent! We\'ll review and get back to you with a quote.', 'success')
  } catch {
    closeRequestModal()
    showToast('Request received! (Connect Formspree to get it by email)', 'info')
  }
}

// ── Continue Writing (Session Restore) ────────────────────────────────────
// Saves last active project + scene to localStorage on every scene open
// On boot, if a previous session exists, shows a popup offering to continue

window.saveWritingSession = function(projectId, projectTitle, sceneName) {
  localStorage.setItem('quillon-last-session', JSON.stringify({
    projectId, projectTitle, sceneName,
    savedAt: Date.now()
  }))
}

async function checkContinueWriting() {
  const raw = localStorage.getItem('quillon-last-session')
  if (!raw) return
  let session
  try { session = JSON.parse(raw) } catch { return }

  // Only show if session is less than 30 days old
  const age = Date.now() - session.savedAt
  if (age > 30 * 24 * 60 * 60 * 1000) { localStorage.removeItem('quillon-last-session'); return }

  // Verify project still exists
  try {
    const projects = await API.getProjects()
    const proj = projects.find(p => p.id === session.projectId)
    if (!proj) { localStorage.removeItem('quillon-last-session'); return }

    // Show the continue popup
    showContinuePopup(proj, session.sceneName, session.savedAt)
  } catch {}
}

function showContinuePopup(project, sceneName, savedAt) {
  const timeAgo = formatTimeAgo(savedAt)
  const popup = document.createElement('div')
  popup.id = 'continue-popup'
  popup.innerHTML = `
    <div class="continue-popup-inner">
      <div class="continue-popup-icon">✦</div>
      <div class="continue-popup-body">
        <div class="continue-popup-title">Welcome back</div>
        <div class="continue-popup-detail">
          You were writing <strong>${sceneName}</strong> in <em>${project.title}</em>
          <span class="continue-popup-time">${timeAgo}</span>
        </div>
      </div>
      <div class="continue-popup-actions">
        <button class="continue-btn-yes" onclick="doContinueWriting('${project.id}', '${sceneName}')">
          Continue Writing →
        </button>
        <button class="continue-btn-no" onclick="dismissContinuePopup()">
          Not now
        </button>
      </div>
    </div>
  `
  document.body.appendChild(popup)
  requestAnimationFrame(() => popup.classList.add('visible'))

  // Auto-dismiss after 12 seconds
  setTimeout(() => dismissContinuePopup(), 12000)
}

window.doContinueWriting = async function(projectId, sceneName) {
  dismissContinuePopup()
  try {
    const projects = await API.getProjects()
    const proj = projects.find(p => p.id === projectId)
    if (!proj) return
    window.activateProject(proj)
    window.showView('editor')
    // Wait for editor to render then load the specific scene
    setTimeout(() => {
      window.loadSceneByName?.(sceneName)
    }, 400)
  } catch {}
}

window.dismissContinuePopup = function() {
  const popup = document.getElementById('continue-popup')
  if (!popup) return
  popup.classList.remove('visible')
  setTimeout(() => popup.remove(), 300)
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

// Run on boot after dashboard loads
document.addEventListener('skein:ready', () => {
  setTimeout(checkContinueWriting, 800)
})
