// editor.js — Full editor with write mode, collapse, image upload, error checking
import { API } from '../api.js'
import state from '../store.js'
import { addAction } from './actions.js'

let autosaveTimer = null
let liveCheckTimer = null
let currentErrors = { issues: [], errors: 0, warnings: 0, info: 0 }
let sidebarCollapsed = false
let focusModeOn = false
let projectImages = []

export async function renderEditor() {
  const view = document.getElementById('view-editor')
  if (!state.activeProject) {
    view.innerHTML = `
      <div class="editor-empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--text-muted)">
          <rect x="8" y="6" width="32" height="36" rx="2"/><path d="M16 16h16M16 22h12M16 28h8"/>
        </svg>
        <p>No project open.<br>Open a project from the <a href="#" onclick="showView('dashboard')" style="color:var(--accent)">Dashboard</a>.</p>
      </div>`
    return
  }

  // Load scenes and images
  let scenes = []
  try { scenes = await API.getScenes(state.activeProject.id) } catch {}
  try { projectImages = await API.getImages(state.activeProject.id) } catch {}

  const firstScene = scenes[0]
  state.set('activeScene', firstScene?.name || null)

  view.innerHTML = `
    <div class="editor-shell">
      <!-- Scene List Sidebar -->
      <div class="scene-sidebar">
        <div class="scene-sidebar-header">
          <span class="scene-sidebar-title">Scenes</span>
          <div class="scene-add-wrap" id="scene-add-wrap">
            <button class="scene-add-btn" onclick="toggleSceneAddMenu()" title="Add Scene">+</button>
            <div class="scene-add-menu" id="scene-add-menu" style="display:none">
              <button class="scene-add-item" onclick="addNewScene();closeSceneAddMenu()">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M7 4v6M4 7h6"/></svg>
                New blank scene
              </button>
              <button class="scene-add-item" onclick="addExistingScene();closeSceneAddMenu()">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h4l1.5 1.5H12v7H2z"/><path d="M7 6v4M5 8h4" opacity="0.7"/></svg>
                Add existing .txt file
              </button>
            </div>
          </div>
        </div>
        <div class="scene-list" id="scene-list">
          ${scenes.map(s => sceneItemHTML(s)).join('')}
        </div>
      </div>

      <!-- Main Editor Area -->
      <div class="editor-main-area">
        <!-- Editor Toolbar -->
        <div class="editor-toolbar">
          <div class="editor-toolbar-left">
            <span class="editor-scene-name" id="editor-scene-label">${firstScene?.name || '—'}</span>
            <div class="editor-insert-bar">
              <button class="ins-btn" onclick="insertSnippet('choice')" title="Insert *choice">*choice</button>
              <button class="ins-btn" onclick="insertSnippet('if')" title="Insert *if">*if</button>
              <button class="ins-btn" onclick="insertSnippet('set')" title="Insert *set">*set</button>
              <button class="ins-btn" onclick="insertSnippet('temp')" title="Insert *temp">*temp</button>
              <button class="ins-btn" onclick="insertSnippet('goto')" title="Insert *goto">*goto</button>
              <button class="ins-btn" onclick="insertSnippet('page_break')" title="Insert page break">*page_break</button>
              <button class="ins-btn img-ins-btn" onclick="openImageInsert()" title="Insert image">
                🖼 *image
              </button>
            </div>
          </div>
          <div class="editor-toolbar-right">
            <span class="editor-word-count" id="editor-wc">0 words</span>
            <button class="editor-action-btn" onclick="manualSave()" title="Save (Ctrl+S)">💾 Save</button>
            <button class="editor-action-btn quick-play-btn" onclick="quickPlay()" title="Play">▶ Play</button>
            <button class="editor-action-btn" onclick="toggleFindReplace()" title="Find & Replace (Ctrl+F)">🔍 Find</button>
            <button class="editor-action-btn write-mode-btn" onclick="enterWriteMode()" title="Write Mode">✍ Write Mode</button>
            <div class="editor-more-wrap">
              <button class="editor-action-btn" onclick="toggleEditorMore()" title="More tools">More ▾</button>
              <div class="editor-more-menu" id="editor-more-menu" style="display:none">
                <button class="editor-more-item" onclick="runAnalysis();closeEditorMore()">🔍 Analyze</button>
                <button class="editor-more-item" onclick="switchEspTab('grammar');runGrammarCheck();closeEditorMore()">✏️ Grammar</button>
                <button class="editor-more-item" onclick="showChoiceTree();closeEditorMore()">🌿 Choice Tree</button>
                <button class="editor-more-item" onclick="toggleCommentMode();closeEditorMore()" id="comment-mode-btn">💬 Comment Mode</button>
                <button class="editor-more-item" onclick="showReadabilityStats();closeEditorMore()">📊 Readability</button>
                <button class="editor-more-item" onclick="openMultiSceneReplace();closeEditorMore()">⟲ Multi-Replace</button>
                <button class="editor-more-item" onclick="checkDuplicates();closeEditorMore()">⚠ Dupes</button>
                <button class="editor-more-item" onclick="openHistoryPanel();closeEditorMore()">🕐 History</button>
                <button class="editor-more-item" onclick="setSceneTarget();closeEditorMore()">🎯 Scene Target</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Split: Code Editor + Preview -->

        <!-- Find & Replace Bar -->
        <div class="find-bar" id="find-bar" style="display:none">
          <div class="find-bar-inner">
            <input class="find-input" id="find-input" placeholder="Find…" oninput="findNext()" onkeydown="findKeydown(event)"/>
            <span class="find-count" id="find-count"></span>
            <button class="find-btn" onclick="findPrev()">↑</button>
            <button class="find-btn" onclick="findNext()">↓</button>
            <div class="find-divider"></div>
            <input class="find-input" id="replace-input" placeholder="Replace with…" onkeydown="replaceKeydown(event)"/>
            <button class="find-btn" onclick="replaceOne()">Replace</button>
            <button class="find-btn" onclick="replaceAll()">All</button>
            <button class="find-close-btn" onclick="closeFindReplace()">✕</button>
          </div>
        </div>
        <div id="scene-target-bar" class="scene-target-bar" style="display:none"></div>
        <div id="history-panel" class="history-panel" style="display:none"></div>
        <div class="editor-split-area">
          <div class="code-editor-wrap" id="code-editor-wrap">
            <div class="line-gutter" id="line-gutter"></div>
            <textarea
              id="code-editor"
              class="code-editor"
              spellcheck="false"
              placeholder="Open a scene from the list to start editing..."
              oninput="handleEditorInput()" onscroll="syncGutterScroll()" onkeydown="handleEditorKeydown(event)"
            ></textarea>
          </div>

          <!-- Error + Variables Sidebar -->
          <div class="editor-side-panel" id="editor-side-panel">
            <div class="esp-tabs">
              <button class="esp-tab active" id="esp-tab-errors" onclick="switchEspTab('errors')">
                Errors <span class="esp-count error" id="esp-error-count">0</span>
              </button>
              <button class="esp-tab" id="esp-tab-vars" onclick="switchEspTab('vars')">Variables</button>
              <button class="esp-tab" id="esp-tab-images" onclick="switchEspTab('images')">Images</button>
              <button class="esp-tab" id="esp-tab-grammar" onclick="switchEspTab('grammar');runGrammarCheck()">Grammar</button>
            </div>
            <div class="esp-body" id="esp-body-errors">
              <div class="esp-empty">Open a scene to see error checking.</div>
            </div>
            <div class="esp-body hidden" id="esp-body-vars">
              <div class="esp-empty">Variables will appear here.</div>
            </div>
            <div class="esp-body hidden" id="esp-body-grammar">
              <div class="grammar-desc">Checks grammar, spelling and style in your prose — ignores ChoiceScript commands automatically.</div>
              <div id="grammar-panel"><div class="grammar-empty">Click Grammar to analyse this scene.</div></div>
            </div>
            <div class="esp-body hidden" id="esp-body-images">
              <div class="image-upload-area" onclick="triggerImageUpload()" id="img-upload-zone">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M6 22v4h20v-4"/><path d="M16 6v14M10 12l6-6 6 6"/></svg>
                <div class="img-upload-hint">Upload image</div>
                <div class="img-upload-sub">JPG, PNG, WEBP up to 10MB</div>
              </div>
              <input type="file" id="img-file-input" accept=".jpg,.jpeg,.png,.gif,.webp" style="display:none" onchange="handleImageUpload(event)">
              <div class="image-grid" id="image-grid"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`

  // Load first scene
  if (firstScene) {
    await loadScene(firstScene.name)
  }

  renderImageGrid()
}

// ── Scene loading ──────────────────────────────────────────────────────────
async function loadScene(sceneName) {
  if (!state.activeProject) return
  try {
    const data = await API.getScene(state.activeProject.id, sceneName)
    const editor = document.getElementById('code-editor')
    if (editor) {
      editor.value = data.content
      state.set('activeScene', sceneName)
      document.getElementById('editor-scene-label').textContent = sceneName
      updateWordCount()
      updateGutter()
      currentErrors = data.errors
      renderErrors(data.errors)
    }
    addAction('open', `Opened scene: ${sceneName}`, state.activeProject.title)
  } catch (e) {
    showToast('Could not load scene: ' + e.message, 'error')
  }
}

function sceneItemHTML(s) {
  const dot = s.status === 'error' ? 'var(--red)' : s.status === 'complete' ? 'var(--green)' : 'var(--orange)'
  return `
    <div class="scene-item" data-scene="${s.name}" onclick="loadSceneByName('${s.name}')">
      <div class="scene-item-dot" style="background:${dot}"></div>
      <div class="scene-item-name">${s.name}</div>
      <div class="scene-item-meta">${s.words || 0}w</div>
    </div>`
}

window.loadSceneByName = async function(name) {
  document.querySelectorAll('.scene-item').forEach(el => el.classList.remove('active'))
  document.querySelector(`[data-scene="${name}"]`)?.classList.add('active')
  await loadScene(name)
}

// ── Editor input handling ──────────────────────────────────────────────────
window.handleEditorInput = function() {
  updateWordCount()
  updateGutter()
  setAutosavePending()
  scheduleLiveCheck()
}

// ── Live error check (Grammarly-style) ────────────────────────────────────
// Runs 400ms after you stop typing — feels instant, doesn't lag
function scheduleLiveCheck() {
  clearTimeout(liveCheckTimer)
  liveCheckTimer = setTimeout(() => runLiveCheck(), 400)
}

async function runLiveCheck() {
  if (!state.activeProject || !state.activeScene) return
  const editor = document.getElementById('code-editor')
  if (!editor) return
  // Analyze the current content directly without saving
  // We send the content to the server for analysis
  try {
    // First save silently so server has latest content to analyze
    await API.saveScene(state.activeProject.id, state.activeScene, editor.value)
    const result = await API.analyzeScene(state.activeProject.id, state.activeScene)
    currentErrors = result
    renderErrors(result)
    updateGutter()
    // Update error count badge
    const countEl = document.getElementById('esp-error-count')
    if (countEl) countEl.textContent = (result.errors || 0) + (result.warnings || 0)
  } catch {}
}

// ── Gutter scroll sync ─────────────────────────────────────────────────────
window.syncGutterScroll = function() {
  const editor = document.getElementById('code-editor')
  const gutter = document.getElementById('line-gutter')
  if (editor && gutter) gutter.scrollTop = editor.scrollTop
}

window.handleEditorKeydown = function(e) {
  // Tab inserts 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = document.getElementById('code-editor')
    const start = el.selectionStart
    el.value = el.value.slice(0, start) + '  ' + el.value.slice(el.selectionEnd)
    el.selectionStart = el.selectionEnd = start + 2
  }
  // Ctrl+S saves
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    manualSave()
  }
}

function updateWordCount() {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const words = editor.value.split(/\s+/).filter(Boolean).length
  const el = document.getElementById('editor-wc')
  if (el) el.textContent = `${words.toLocaleString()} words`
}

function updateGutter() {
  const editor = document.getElementById('code-editor')
  const gutter = document.getElementById('line-gutter')
  if (!editor || !gutter) return
  const lines = editor.value.split('\n')
  const errorLines = new Set(currentErrors.issues?.map(i => i.line) || [])
  gutter.innerHTML = lines.map((_, i) => {
    const lineNum = i + 1
    const hasErr = errorLines.has(lineNum)
    const errIssue = currentErrors.issues?.find(issue => issue.line === lineNum)
    const errType = errIssue?.type || 'info'
    return `<div class="gutter-line ${hasErr ? 'gutter-has-err' : ''}">
      <span class="gutter-num">${lineNum}</span>
      ${hasErr ? `<span class="gutter-err-icon gutter-err-${errType}" title="${errIssue?.msg || ''}">⚠</span>` : ''}
    </div>`
  }).join('')
}

// ── Save ───────────────────────────────────────────────────────────────────
function setAutosavePending() {
  const badge = document.getElementById('autosave-badge')
  if (badge) { badge.textContent = '● Unsaved'; badge.className = 'autosave-badge saving' }
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => autoSave(), 2000)
}

async function autoSave() {
  await saveSceneContent('auto')
}

window.manualSave = async function() {
  await saveSceneContent('manual')
}

async function saveSceneContent(mode = 'auto') {
  if (!state.activeProject || !state.activeScene) return
  const editor = document.getElementById('code-editor')
  if (!editor) return
  try {
    const result = await API.saveScene(state.activeProject.id, state.activeScene, editor.value)
    const badge = document.getElementById('autosave-badge')
    if (badge) { badge.textContent = '✓ Saved'; badge.className = 'autosave-badge' }
    currentErrors = result.errors
    renderErrors(result.errors)
    updateGutter()
    if (mode === 'manual') {
      addAction('save', `Saved scene: ${state.activeScene}`, `${editor.value.split(/\s+/).filter(Boolean).length} words`)
      showToast('Saved', 'success')
    }
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error')
  }
}

// ── Analysis / Error panel ─────────────────────────────────────────────────
window.runAnalysis = async function() {
  if (!state.activeProject || !state.activeScene) return
  try {
    const result = await API.analyzeScene(state.activeProject.id, state.activeScene)
    currentErrors = result
    renderErrors(result)
    updateGutter()
    addAction('analyze', `Analyzed: ${state.activeScene}`, `${result.errors} errors, ${result.warnings} warnings`)
    showToast(`Analysis: ${result.errors} errors, ${result.warnings} warnings`)
  } catch (e) {
    showToast('Analysis failed: ' + e.message, 'error')
  }
}

function renderErrors(data) {
  const countEl = document.getElementById('esp-error-count')
  if (countEl) countEl.textContent = (data.errors || 0) + (data.warnings || 0)

  const body = document.getElementById('esp-body-errors')
  if (!body) return
  if (!data.issues?.length) {
    body.innerHTML = `<div class="esp-empty" style="color:var(--green)">✓ No issues found in this scene.</div>`
    return
  }
  const grouped = { error: [], warning: [], info: [] }
  data.issues.forEach(i => grouped[i.type]?.push(i))

  body.innerHTML = ['error','warning','info'].filter(t => grouped[t].length).map(type => `
    <div class="esp-group">
      <div class="esp-group-title">
        ${type === 'error' ? '✕ Errors' : type === 'warning' ? '⚠ Warnings' : 'ℹ Info'}
        <span class="esp-count ${type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'ok'}">${grouped[type].length}</span>
      </div>
      ${grouped[type].map(issue => `
        <div class="esp-issue esp-issue-${issue.type}" onclick="jumpToLine(${issue.line})" title="Click to jump to line">
          <div class="esp-issue-cat">${issue.category}</div>
          <div class="esp-issue-msg">${issue.msg}</div>
          <div class="esp-issue-line">Line ${issue.line}</div>
        </div>`).join('')}
    </div>`).join('')
}

window.jumpToLine = function(lineNum) {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const lines = editor.value.split('\n')
  let pos = 0
  for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) pos += lines[i].length + 1
  editor.focus()
  editor.setSelectionRange(pos, pos + (lines[lineNum - 1]?.length || 0))
  // Scroll to line
  const lineHeight = 22
  editor.scrollTop = (lineNum - 5) * lineHeight
}

window.switchEspTab = function(tab) {
  document.querySelectorAll('.esp-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.esp-body').forEach(b => b.classList.add('hidden'))
  document.getElementById(`esp-tab-${tab}`)?.classList.add('active')
  document.getElementById(`esp-body-${tab}`)?.classList.remove('hidden')
  if (tab === 'images') renderImageGrid()
}

// ── Image handling ─────────────────────────────────────────────────────────
window.triggerImageUpload = function() {
  document.getElementById('img-file-input')?.click()
}

window.handleImageUpload = async function(event) {
  const file = event.target.files[0]
  if (!file || !state.activeProject) return
  try {
    showToast('Uploading image...')
    const result = await API.uploadImage(state.activeProject.id, file)
    projectImages = await API.getImages(state.activeProject.id)
    renderImageGrid()
    addAction('image', `Uploaded image: ${result.name}`, state.activeProject.title)
    showToast(`✓ Image uploaded: ${result.name}`, 'success')
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error')
  }
  event.target.value = ''
}

function renderImageGrid() {
  const grid = document.getElementById('image-grid')
  if (!grid) return
  if (!projectImages.length) {
    grid.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-align:center;padding:16px">No images uploaded yet.</div>`
    return
  }
  grid.innerHTML = projectImages.map(img => `
    <div class="img-thumb-wrap" title="${img.name}">
      <img src="${img.url}" class="img-thumb" onclick="selectImageForInsert('${img.name}','${img.url}')" loading="lazy">
      <div class="img-thumb-name">${img.name}</div>
      <button class="img-thumb-del" onclick="deleteProjectImage('${img.name}')" title="Delete">✕</button>
    </div>`).join('')
}

window.openImageInsert = function() {
  switchEspTab('images')
  // Scroll panel into view and highlight
  document.getElementById('editor-side-panel')?.scrollIntoView({ behavior: 'smooth' })
  showToast('Select an image from the panel to insert, or upload a new one')
}

window.selectImageForInsert = function(name, url) {
  if (!state.activeScene) { showToast('Open a scene first', 'error'); return }
  insertImageCommand(name)
}

function insertImageCommand(imageName) {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const pos = editor.selectionStart
  const lines = editor.value.split('\n')
  // Find the current line and insert after it
  let charCount = 0
  let insertLine = 0
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1
    if (charCount > pos) { insertLine = i; break }
  }
  // Insert *page_break + *image on new lines after current line
  const insertText = `\n*page_break\n*image ${imageName}\n`
  const insertPos = lines.slice(0, insertLine + 1).join('\n').length + 1
  editor.value = editor.value.slice(0, insertPos) + insertText + editor.value.slice(insertPos)
  editor.selectionStart = editor.selectionEnd = insertPos + insertText.length
  updateWordCount()
  updateGutter()
  setAutosavePending()
  addAction('image', `Inserted image: ${imageName}`, state.activeScene)
  showToast(`Inserted: *image ${imageName}`, 'success')
}

window.deleteProjectImage = async function(name) {
  if (!confirm(`Delete image "${name}"? This cannot be undone.`)) return
  try {
    await API.deleteImage(state.activeProject.id, name)
    projectImages = await API.getImages(state.activeProject.id)
    renderImageGrid()
    addAction('image', `Deleted image: ${name}`, null, 'warn')
    showToast(`Deleted: ${name}`)
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error')
  }
}

// ── Insert Snippets ────────────────────────────────────────────────────────
window.insertSnippet = function(type) {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const snippets = {
    choice: `\n*choice\n  #First option\n    *goto label_name\n  #Second option\n    *goto label_name\n`,
    if: `\n*if (variable > 50)\n  Text if true.\n*else\n  Text if false.\n`,
    set: `\n*set variable_name value\n`,
    temp: `\n*temp variable_name value\n`,
    goto: `\n*goto label_name\n`,
    page_break: `\n*page_break\n`
  }
  const snippet = snippets[type] || ''
  const pos = editor.selectionStart
  editor.value = editor.value.slice(0, pos) + snippet + editor.value.slice(pos)
  editor.selectionStart = editor.selectionEnd = pos + snippet.length
  editor.focus()
  updateWordCount()
  updateGutter()
  setAutosavePending()
}

// ── Write Mode ─────────────────────────────────────────────────────────────
window.enterWriteMode = function() {
  const overlay = document.getElementById('write-mode-overlay')
  const editor = document.getElementById('code-editor')
  const content = editor?.value || ''
  const sceneName = state.activeScene || '—'

  focusModeOn = false
  sidebarCollapsed = false

  overlay.innerHTML = `
    <div class="wm-shell">
      <div class="wm-toolbar" id="wm-toolbar">
        <div class="wm-toolbar-left">
          <span class="wm-scene-name">${sceneName}</span>
          <div class="editor-insert-bar">
            <button class="ins-btn" onclick="wmInsertSnippet('choice')">*choice</button>
            <button class="ins-btn" onclick="wmInsertSnippet('if')">*if</button>
            <button class="ins-btn" onclick="wmInsertSnippet('set')">*set</button>
            <button class="ins-btn" onclick="wmInsertSnippet('goto')">*goto</button>
            <button class="ins-btn" onclick="wmInsertSnippet('page_break')">*page_break</button>
            <button class="ins-btn img-ins-btn" onclick="wmOpenImages()">🖼 *image</button>
          </div>
        </div>
        <div class="wm-toolbar-right">
          <span class="wm-wc" id="wm-wc">0 words</span>
          <button class="wm-btn" id="wm-panel-btn" onclick="wmToggleSidebar()" title="Toggle error/variable panel">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 1v10M6 4l2 2-2 2"/></svg> Panel
          </button>
          <button class="wm-btn" id="wm-focus-btn" onclick="wmToggleFocus()" title="Full focus mode (Esc to exit)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 4V1h3M8 1h3v3M1 8v3h3M8 11h3V8"/></svg> Focus
          </button>
          <button class="wm-btn accent" onclick="wmSave()">💾 Save</button>
          <button class="wm-btn exit-btn" onclick="exitWriteMode()">← Exit</button>
        </div>
      </div>

      <div class="wm-body" id="wm-body">
        <div class="wm-editor-wrap">
          <div class="wm-gutter" id="wm-gutter"></div>
          <textarea id="wm-editor" class="wm-editor"
            spellcheck="false"
            oninput="wmHandleInput()" onscroll="wmSyncGutter()" onkeydown="wmHandleKeydown(event)"
          >${content}</textarea>
        </div>
        <div class="wm-sidebar" id="wm-sidebar">
          <div class="esp-tabs">
            <button class="esp-tab active" id="wm-tab-errors" onclick="wmSwitchTab('errors')">
              Errors <span class="esp-count error" id="wm-error-count">${currentErrors.errors + currentErrors.warnings}</span>
            </button>
            <button class="esp-tab" id="wm-tab-vars" onclick="wmSwitchTab('vars')">Vars</button>
            <button class="esp-tab" id="wm-tab-images" onclick="wmSwitchTab('images')">Images</button>
          </div>
          <div class="esp-body" id="wm-body-errors">${document.getElementById('esp-body-errors')?.innerHTML || '<div class="esp-empty">Run analysis to see errors.</div>'}</div>
          <div class="esp-body hidden" id="wm-body-vars"><div class="esp-empty">No variables loaded.</div></div>
          <div class="esp-body hidden" id="wm-body-images">
            <div class="image-upload-area" onclick="document.getElementById('wm-img-input').click()">
              <div class="img-upload-hint">Upload image</div>
            </div>
            <input type="file" id="wm-img-input" accept=".jpg,.jpeg,.png,.gif,.webp" style="display:none" onchange="wmUploadImage(event)">
            <div class="image-grid" id="wm-image-grid"></div>
          </div>
        </div>
      </div>
    </div>`

  overlay.classList.remove('hidden')
  overlay.classList.add('visible')
  state.set('writeModeOn', true)

  setTimeout(() => {
    const wmEditor = document.getElementById('wm-editor')
    if (wmEditor) {
      wmEditor.focus()
      wmEditor.setSelectionRange(wmEditor.value.length, wmEditor.value.length)
      wmEditor.scrollTop = wmEditor.scrollHeight
      wmUpdateWc()
      wmUpdateGutter()
    }
    wmRenderImageGrid()
  }, 50)
}

window.exitWriteMode = function() {
  const overlay = document.getElementById('write-mode-overlay')
  const wmEditor = document.getElementById('wm-editor')
  // Copy write mode content back to main editor
  if (wmEditor) {
    const mainEditor = document.getElementById('code-editor')
    if (mainEditor) mainEditor.value = wmEditor.value
    updateWordCount()
    updateGutter()
    setAutosavePending()
  }
  overlay.classList.remove('visible')
  setTimeout(() => { overlay.classList.add('hidden'); overlay.innerHTML = '' }, 300)
  state.set('writeModeOn', false)
}

window.wmToggleSidebar = function() {
  sidebarCollapsed = !sidebarCollapsed
  const sidebar = document.getElementById('wm-sidebar')
  const btn = document.getElementById('wm-panel-btn')
  sidebar?.classList.toggle('collapsed', sidebarCollapsed)
  btn?.classList.toggle('active', sidebarCollapsed)
}

window.wmToggleFocus = function() {
  focusModeOn = !focusModeOn
  const shell = document.querySelector('.wm-shell')
  const btn   = document.getElementById('wm-focus-btn')
  shell?.classList.toggle('focus-mode', focusModeOn)
  btn?.classList.toggle('active', focusModeOn)

  // Floating word count
  let focusWc = document.getElementById('wm-focus-wc-el')
  if (focusModeOn) {
    if (!focusWc) {
      focusWc = document.createElement('div')
      focusWc.id = 'wm-focus-wc-el'
      focusWc.className = 'wm-focus-wc'
      document.body.appendChild(focusWc)
    }
    focusWc.style.display = 'block'
    focusWc.textContent = document.getElementById('wm-wc')?.textContent || ''
    // Focus the editor
    setTimeout(() => document.getElementById('wm-editor')?.focus(), 50)
  } else {
    if (focusWc) focusWc.style.display = 'none'
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.writeModeOn) {
    if (focusModeOn) {
      wmToggleFocus()   // Esc exits focus mode first
    } else {
      exitWriteMode()   // second Esc exits write mode entirely
    }
  }
})

window.wmHandleInput = function() {
  wmUpdateWc()
  wmUpdateGutter()
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => wmAutoSave(), 2000)
  // Live error check
  clearTimeout(liveCheckTimer)
  liveCheckTimer = setTimeout(() => wmLiveCheck(), 400)
}

async function wmLiveCheck() {
  if (!state.activeProject || !state.activeScene) return
  const editor = document.getElementById('wm-editor')
  if (!editor) return
  try {
    await API.saveScene(state.activeProject.id, state.activeScene, editor.value)
    const result = await API.analyzeScene(state.activeProject.id, state.activeScene)
    currentErrors = result
    wmUpdateGutter()
    const countEl = document.getElementById('wm-error-count')
    if (countEl) countEl.textContent = (result.errors || 0) + (result.warnings || 0)
    // Also update the error body in wm sidebar
    const errBody = document.getElementById('wm-body-errors')
    if (errBody) {
      const tempDiv = document.createElement('div')
      renderErrorsInto(result, tempDiv)
      errBody.innerHTML = tempDiv.innerHTML
    }
  } catch {}
}

window.syncWmGutterScroll = function() {
  const editor = document.getElementById('wm-editor')
  const gutter = document.getElementById('wm-gutter')
  if (editor && gutter) gutter.scrollTop = editor.scrollTop
}

window.wmHandleKeydown = function(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = document.getElementById('wm-editor')
    const s = el.selectionStart
    el.value = el.value.slice(0, s) + '  ' + el.value.slice(el.selectionEnd)
    el.selectionStart = el.selectionEnd = s + 2
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    wmSave()
  }
}

function wmUpdateWc() {
  const editor = document.getElementById('wm-editor')
  const el = document.getElementById('wm-wc')
  if (!editor) return
  const txt = editor.value.split(/\s+/).filter(Boolean).length.toLocaleString() + ' words'
  if (el) el.textContent = txt
  const focusEl = document.getElementById('wm-focus-wc-el')
  if (focusEl) focusEl.textContent = txt
}

function wmUpdateGutter() {
  const editor = document.getElementById('wm-editor')
  const gutter = document.getElementById('wm-gutter')
  if (!editor || !gutter) return
  const lines = editor.value.split('\n')
  const errorLines = new Set(currentErrors.issues?.map(i => i.line) || [])
  gutter.innerHTML = lines.map((_, i) => {
    const ln = i + 1
    const hasErr = errorLines.has(ln)
    return '<div class="wm-gutter-line' + (hasErr ? ' gutter-has-err' : '') + '">' + ln + '</div>'
  }).join('')
}

// Alias so the onscroll handler works
window.wmSyncGutter = function() {
  const editor = document.getElementById('wm-editor')
  const gutter = document.getElementById('wm-gutter')
  if (editor && gutter) gutter.scrollTop = editor.scrollTop
}

async function wmAutoSave() {
  const editor = document.getElementById('wm-editor')
  if (!editor || !state.activeProject || !state.activeScene) return
  try {
    const result = await API.saveScene(state.activeProject.id, state.activeScene, editor.value)
    currentErrors = result.errors
    wmUpdateGutter()
    // Update error count badge
    const countEl = document.getElementById('wm-error-count')
    if (countEl) countEl.textContent = result.errors.errors + result.errors.warnings
  } catch {}
}

window.wmSave = async function() {
  const editor = document.getElementById('wm-editor')
  if (!editor || !state.activeProject || !state.activeScene) return
  try {
    const result = await API.saveScene(state.activeProject.id, state.activeScene, editor.value)
    currentErrors = result.errors
    wmUpdateGutter()
    addAction('save', `Saved (write mode): ${state.activeScene}`)
    showToast('Saved', 'success')
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error')
  }
}

window.wmSwitchTab = function(tab) {
  document.querySelectorAll('#wm-sidebar .esp-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('#wm-sidebar .esp-body').forEach(b => b.classList.add('hidden'))
  document.getElementById(`wm-tab-${tab}`)?.classList.add('active')
  document.getElementById(`wm-body-${tab}`)?.classList.remove('hidden')
}

window.wmInsertSnippet = function(type) {
  const editor = document.getElementById('wm-editor')
  if (!editor) return
  const snippets = {
    choice: `\n*choice\n  #First option\n    *goto label_name\n  #Second option\n    *goto label_name\n`,
    if: `\n*if (variable > 50)\n  Text if true.\n*else\n  Text if false.\n`,
    set: `\n*set variable_name value\n`,
    goto: `\n*goto label_name\n`,
    page_break: `\n*page_break\n`
  }
  const s = editor.selectionStart
  const snip = snippets[type] || ''
  editor.value = editor.value.slice(0, s) + snip + editor.value.slice(s)
  editor.selectionStart = editor.selectionEnd = s + snip.length
  editor.focus()
  wmHandleInput()
}

window.wmOpenImages = function() { wmSwitchTab('images') }

function wmRenderImageGrid() {
  const grid = document.getElementById('wm-image-grid')
  if (!grid) return
  if (!projectImages.length) {
    grid.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-align:center;padding:12px">No images yet.</div>`
    return
  }
  grid.innerHTML = projectImages.map(img => `
    <div class="img-thumb-wrap" title="${img.name}">
      <img src="${img.url}" class="img-thumb" onclick="wmSelectImage('${img.name}')" loading="lazy">
      <div class="img-thumb-name">${img.name}</div>
    </div>`).join('')
}

window.wmSelectImage = function(name) {
  const editor = document.getElementById('wm-editor')
  if (!editor) return
  const pos = editor.selectionStart
  const lines = editor.value.split('\n')
  let charCount = 0, insertLine = 0
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1
    if (charCount > pos) { insertLine = i; break }
  }
  const insertText = `\n*page_break\n*image ${name}\n`
  const insertPos = lines.slice(0, insertLine + 1).join('\n').length + 1
  editor.value = editor.value.slice(0, insertPos) + insertText + editor.value.slice(insertPos)
  editor.selectionStart = editor.selectionEnd = insertPos + insertText.length
  wmHandleInput()
  addAction('image', `Inserted image: ${name}`, state.activeScene)
  showToast(`Inserted: *image ${name}`, 'success')
}

window.wmUploadImage = async function(e) {
  const file = e.target.files[0]
  if (!file || !state.activeProject) return
  try {
    const result = await API.uploadImage(state.activeProject.id, file)
    projectImages = await API.getImages(state.activeProject.id)
    wmRenderImageGrid()
    addAction('image', `Uploaded: ${result.name}`)
    showToast('Uploaded: ' + result.name, 'success')
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error')
  }
  e.target.value = ''
}

window.toggleSceneAddMenu = function() {
  const menu = document.getElementById('scene-add-menu')
  if (!menu) return
  const visible = menu.style.display !== 'none'
  menu.style.display = visible ? 'none' : 'block'
  if (!visible) setTimeout(() => document.addEventListener('click', closeSceneAddMenu, { once: true }), 50)
}

window.closeSceneAddMenu = function() {
  const menu = document.getElementById('scene-add-menu')
  if (menu) menu.style.display = 'none'
}

// Add an existing .txt file from the user's system as a scene
window.addExistingScene = function() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.txt'
  input.multiple = true
  input.onchange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    for (const file of files) {
      const content = await file.text()
      const sceneName = file.name.replace(/\.txt$/i, '')
      try {
        await API.createScene(state.activeProject.id, sceneName)
        await API.saveScene(state.activeProject.id, sceneName, content)
        addAction('import', `Added scene: ${sceneName}`, state.activeProject.title)
      } catch (e) {
        showToast(`Could not add ${sceneName}: ${e.message}`, 'error')
      }
    }
    showToast(`${files.length} scene${files.length > 1 ? 's' : ''} added`, 'success')
    // Reload editor
    const scenes = await API.getScenes(state.activeProject.id)
    state.set('scenes', scenes)
    document.getElementById('scene-list').innerHTML = scenes.map(s => sceneItemHTML(s)).join('')
  }
  input.click()
}

window.addNewScene = async function() {
  if (!state.activeProject) return
  const name = prompt('Scene name (lowercase, no spaces):')
  if (!name?.trim()) return
  try {
    await API.createScene(state.activeProject.id, name.trim())
    addAction('create', `Created scene: ${name.trim()}`, state.activeProject.title)
    showToast(`Scene created: ${name.trim()}`, 'success')
    renderEditor()
  } catch (e) {
    showToast(e.message, 'error')
  }
}

// ── Quick Play ─────────────────────────────────────────────────────────────
// Saves the current scene, syncs to game folder, opens game in browser.
// No modal. One click. Uses the saved game path.
window.quickPlay = async function() {
  if (!state.activeProject) { showToast('Open a project first', 'error'); return }

  // Save current scene first
  await saveSceneContent('auto')

  try {
    const result = await API.runGame(state.activeProject.id, null)
    // runGame with null gamePath will trigger quick endpoint
    addAction('run', `Quick play: ${state.activeProject.title}`, result.synced)
    showToast(`▶ ${result.synced} — game launched!`, 'success')
  } catch (e) {
    if (e.message.includes('No game path')) {
      showToast('Set your game folder first — use Run Game from the dashboard three-dot menu', 'error')
    } else {
      showToast('Play failed: ' + e.message, 'error')
    }
  }
}

// ── Find & Replace ─────────────────────────────────────────────────────────
let findMatches = []
let findIndex = 0

window.toggleFindReplace = function() {
  const bar = document.getElementById('find-bar')
  if (!bar) return
  const visible = bar.style.display !== 'none'
  bar.style.display = visible ? 'none' : 'flex'
  if (!visible) {
    document.getElementById('find-input')?.focus()
    // Pre-fill with selected text
    const editor = document.getElementById('code-editor')
    const sel = editor?.value.substring(editor.selectionStart, editor.selectionEnd)
    if (sel && sel.length < 100) {
      document.getElementById('find-input').value = sel
      findNext()
    }
  }
}

window.closeFindReplace = function() {
  const bar = document.getElementById('find-bar')
  if (bar) bar.style.display = 'none'
  findMatches = []
  document.getElementById('find-count').textContent = ''
}

// Ctrl+F shortcut
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const editorView = document.getElementById('view-editor')
    if (editorView?.classList.contains('active')) {
      e.preventDefault()
      toggleFindReplace()
    }
  }
  if (e.key === 'Escape') closeFindReplace()
})

window.findNext = function() {
  const query = document.getElementById('find-input')?.value
  const editor = document.getElementById('code-editor')
  if (!query || !editor) { document.getElementById('find-count').textContent = ''; return }

  const text = editor.value
  const lower = text.toLowerCase()
  const q = query.toLowerCase()

  findMatches = []
  let pos = 0
  while ((pos = lower.indexOf(q, pos)) !== -1) {
    findMatches.push(pos)
    pos += q.length
  }

  const count = document.getElementById('find-count')
  if (findMatches.length === 0) {
    count.textContent = 'Not found'
    count.style.color = 'var(--red)'
    return
  }

  count.style.color = 'var(--text-muted)'
  findIndex = (findIndex + 1) % findMatches.length
  const match = findMatches[findIndex]
  editor.focus()
  editor.setSelectionRange(match, match + query.length)
  count.textContent = (findIndex + 1) + ' / ' + findMatches.length

  // Scroll to match
  const linesBefore = text.substring(0, match).split('\n').length - 1
  const lineHeight = 22
  editor.scrollTop = Math.max(0, linesBefore * lineHeight - editor.clientHeight / 2)
  syncGutterScroll()
}

window.findPrev = function() {
  if (findMatches.length === 0) { findNext(); return }
  findIndex = (findIndex - 2 + findMatches.length) % findMatches.length
  const query = document.getElementById('find-input')?.value
  const editor = document.getElementById('code-editor')
  const match = findMatches[findIndex]
  editor.focus()
  editor.setSelectionRange(match, match + query.length)
  document.getElementById('find-count').textContent = (findIndex + 1) + ' / ' + findMatches.length
}

window.replaceOne = function() {
  const query = document.getElementById('find-input')?.value
  const replacement = document.getElementById('replace-input')?.value || ''
  const editor = document.getElementById('code-editor')
  if (!query || !editor) return
  if (editor.selectionStart !== editor.selectionEnd &&
      editor.value.substring(editor.selectionStart, editor.selectionEnd).toLowerCase() === query.toLowerCase()) {
    const start = editor.selectionStart
    editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(editor.selectionEnd)
    editor.setSelectionRange(start, start + replacement.length)
    handleEditorInput()
  }
  findNext()
}

window.replaceAll = function() {
  const query = document.getElementById('find-input')?.value
  const replacement = document.getElementById('replace-input')?.value || ''
  const editor = document.getElementById('code-editor')
  if (!query || !editor) return
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const before = editor.value
  editor.value = before.replace(regex, replacement)
  const count = (before.match(regex) || []).length
  handleEditorInput()
  findMatches = []
  document.getElementById('find-count').textContent = ''
  window.showToast?.('Replaced ' + count + ' occurrence' + (count !== 1 ? 's' : ''))
}

window.findKeydown = function(e) {
  if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext() }
}
window.replaceKeydown = function(e) {
  if (e.key === 'Enter') replaceOne()
}

// ── Grammar Checker (LanguageTool) ─────────────────────────────────────────
// Uses free LanguageTool public API — checks grammar, style, spelling
// Only runs on demand (button click) since it requires an internet call
window.runGrammarCheck = async function() {
  const editor = document.getElementById('code-editor')
  if (!editor || !editor.value.trim()) return

  // Strip ChoiceScript commands — only check prose lines
  const prose = editor.value.split('\n')
    .filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('#') && line.trim().length > 2)
    .join('\n')
    .slice(0, 20000)

  if (!prose.trim()) { showToast('No prose to check', 'info'); return }

  const grammarPanel = document.getElementById('grammar-panel')
  if (grammarPanel) grammarPanel.innerHTML = '<div class="grammar-loading">Analysing prose…</div>'
  showToast('Checking grammar…')

  try {
    const resp = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: prose, language: 'en-US' })
    })
    const data = await resp.json()
    const matches = data.matches || []

    if (!grammarPanel) return

    if (matches.length === 0) {
      grammarPanel.innerHTML = '<div class="grammar-clean">✓ No grammar issues found in this scene</div>'
      showToast('Grammar looks good!', 'success')
      return
    }

    grammarPanel.innerHTML = matches.slice(0, 30).map(m => {
      const ctx = m.context.text
      const start = Math.max(0, m.context.offset - 15)
      const end = Math.min(ctx.length, m.context.offset + m.context.length + 15)
      const snippet = ctx.slice(start, end).replace(/</g,'&lt;')
      const fixes = m.replacements.slice(0,3).map(r => '<em>' + r.value + '</em>').join(', ')
      return '<div class="grammar-item">' +
        '<div class="grammar-msg">' + m.message + '</div>' +
        '<div class="grammar-context">"…' + snippet + '…"</div>' +
        (fixes ? '<div class="grammar-fix">Try: ' + fixes + '</div>' : '') +
        '</div>'
    }).join('')

    showToast(matches.length + ' grammar suggestion' + (matches.length !== 1 ? 's' : ''), 'warn')
  } catch (e) {
    if (grammarPanel) grammarPanel.innerHTML = '<div class="grammar-error">Grammar check unavailable — needs internet connection</div>'
    showToast('Grammar check needs internet', 'error')
  }
}

// ── Editor More Menu ──────────────────────────────────────────────────────
window.toggleEditorMore = function() {
  const menu = document.getElementById('editor-more-menu')
  if (!menu) return
  const open = menu.style.display !== 'none'
  menu.style.display = open ? 'none' : 'block'
  if (!open) setTimeout(() => document.addEventListener('click', closeEditorMore, { once: true }), 50)
}
window.closeEditorMore = function() {
  const menu = document.getElementById('editor-more-menu')
  if (menu) menu.style.display = 'none'
}

// ── loadSceneByName (used by storymap + continue writing) ─────────────────
window.loadSceneByName = async function(sceneName) {
  const editor = document.getElementById('code-editor')
  if (!editor) { setTimeout(() => window.loadSceneByName(sceneName), 300); return }
  document.querySelectorAll('.scene-item').forEach(el => el.classList.remove('active'))
  document.querySelector(`[data-scene="${sceneName}"]`)?.classList.add('active')
  await loadScene(sceneName)
}

// ── Autosave History ──────────────────────────────────────────────────────
const autosaveHistory = {}

function pushAutosaveHistory(sceneName, content) {
  if (!sceneName) return
  if (!autosaveHistory[sceneName]) autosaveHistory[sceneName] = []
  const hist = autosaveHistory[sceneName]
  if (hist.length > 0 && hist[hist.length - 1].content === content) return
  hist.push({ content, time: Date.now() })
  if (hist.length > 5) hist.shift()
}

window.openHistoryPanel = function() {
  const panel = document.getElementById('history-panel')
  if (!panel) return
  const sceneName = state.activeScene
  const hist = autosaveHistory[sceneName] || []
  if (!hist.length) { showToast('No history yet — keep writing and it will appear', 'info'); return }
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
  if (panel.style.display === 'none') return
  const items = [...hist].reverse().map((h, i) => {
    const mins = Math.floor((Date.now() - h.time) / 60000)
    const ago = mins < 1 ? 'just now' : mins < 60 ? mins + 'm ago' : Math.floor(mins/60) + 'h ago'
    const words = h.content.split(/\s+/).filter(Boolean).length
    return '<div class="history-item">' +
      '<div class="history-item-meta">' + ago + ' · ' + words + 'w</div>' +
      '<div class="history-item-preview">' + h.content.slice(0,100).replace(/</g,'&lt;') + '…</div>' +
      '<button class="history-restore-btn" onclick="restoreFromHistory(' + (hist.length-1-i) + ')">Restore</button>' +
      '</div>'
  }).join('')
  panel.innerHTML = items
}

window.restoreFromHistory = function(index) {
  const hist = autosaveHistory[state.activeScene]
  if (!hist || !hist[index]) return
  const editor = document.getElementById('code-editor')
  if (editor) {
    editor.value = hist[index].content
    handleEditorInput()
    showToast('Restored from history', 'success')
    document.getElementById('history-panel').style.display = 'none'
  }
}

// ── Variable Autocomplete ─────────────────────────────────────────────────
let knownVars = []

async function loadKnownVars() {
  if (!state.activeProject) return
  try {
    const startup = await API.getScene(state.activeProject.id, 'startup')
    knownVars = []
    startup.content.split('\n').forEach(line => {
      const m = line.trim().match(/^\*create\s+(\w+)/)
      if (m) knownVars.push(m[1])
    })
  } catch {}
}

document.addEventListener('skein:ready', loadKnownVars)

function checkVarAutocomplete() {
  const editor = document.getElementById('code-editor')
  if (!editor || knownVars.length === 0) return
  const pos = editor.selectionStart
  const lastLine = editor.value.substring(0, pos).split('\n').pop()
  const m = lastLine.match(/^\s*\*(set|if|elseif)\s+(\w*)$/)
  if (!m) { closeVarDropdown(); return }
  const partial = m[2].toLowerCase()
  const matches = knownVars.filter(v => v.toLowerCase().startsWith(partial) && v.toLowerCase() !== partial)
  if (!matches.length) { closeVarDropdown(); return }
  showVarDropdown(matches, editor, partial)
}

function showVarDropdown(vars, editor, partial) {
  closeVarDropdown()
  const rect = editor.getBoundingClientRect()
  const lines = editor.value.substring(0, editor.selectionStart).split('\n')
  const top = rect.top + lines.length * 22 - editor.scrollTop + 4
  const drop = document.createElement('div')
  drop.id = 'var-dropdown'
  drop.className = 'var-autocomplete-dropdown'
  drop.innerHTML = vars.slice(0,8).map((v,i) =>
    '<div class="var-drop-item' + (i===0?' active':'') + '" onclick="insertVar(\'' + v + '\',\'' + partial + '\')">' + v + '</div>'
  ).join('')
  drop.style.cssText = 'position:fixed;top:' + top + 'px;left:' + (rect.left+60) + 'px;z-index:9999'
  document.body.appendChild(drop)
}

window.insertVar = function(varName, partial) {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const pos = editor.selectionStart
  const before = editor.value.substring(0, pos - partial.length)
  const after = editor.value.substring(pos)
  editor.value = before + varName + after
  editor.setSelectionRange(before.length + varName.length, before.length + varName.length)
  closeVarDropdown()
  handleEditorInput()
}

function closeVarDropdown() { document.getElementById('var-dropdown')?.remove() }

// Intercept editor input for var autocomplete
const _baseHandleInput = window.handleEditorInput
window.handleEditorInput = function() {
  _baseHandleInput?.()
  setTimeout(checkVarAutocomplete, 60)
}

// ── Multi-Scene Find & Replace ────────────────────────────────────────────
window.openMultiSceneReplace = async function() {
  if (!state.activeProject) { showToast('Open a project first', 'error'); return }
  const scenes = await API.getScenes(state.activeProject.id)
  const overlay = document.createElement('div')
  overlay.id = 'multi-replace-overlay'
  overlay.className = 'multi-replace-overlay'
  overlay.innerHTML = '<div class="multi-replace-modal">' +
    '<div class="multi-replace-header"><div class="multi-replace-title">⟲ Multi-Scene Find & Replace</div>' +
    '<button onclick="document.getElementById(\'multi-replace-overlay\').remove()">✕</button></div>' +
    '<div class="multi-replace-body">' +
    '<div class="mr-field"><label>Find</label><input id="mr-find" type="text" placeholder="Text to find…" class="mr-input"></div>' +
    '<div class="mr-field"><label>Replace with</label><input id="mr-replace" type="text" placeholder="Replacement…" class="mr-input"></div>' +
    '<div class="mr-field"><label>Scenes</label><div class="mr-scene-list">' +
    '<label class="mr-check-all"><input type="checkbox" id="mr-check-all" checked onchange="document.querySelectorAll(\'.mr-scene-cb\').forEach(c=>c.checked=this.checked)"> All scenes</label>' +
    scenes.map(s => '<label class="mr-scene-check"><input type="checkbox" class="mr-scene-cb" value="' + s.name + '" checked> ' + s.name + ' (' + s.words + 'w)</label>').join('') +
    '</div></div><div class="mr-preview" id="mr-preview"></div></div>' +
    '<div class="multi-replace-footer">' +
    '<button class="mr-btn-preview" onclick="previewMultiReplace()">Preview</button>' +
    '<button class="mr-btn-go" onclick="executeMultiReplace()">Replace All →</button>' +
    '<button class="mr-btn-cancel" onclick="document.getElementById(\'multi-replace-overlay\').remove()">Cancel</button>' +
    '</div></div>'
  document.body.appendChild(overlay)
  document.getElementById('mr-find')?.focus()
}

window.previewMultiReplace = async function() {
  const find = document.getElementById('mr-find')?.value
  const preview = document.getElementById('mr-preview')
  if (!find) { showToast('Enter text to find', 'error'); return }
  const selected = [...document.querySelectorAll('.mr-scene-cb:checked')].map(c => c.value)
  preview.innerHTML = '<div class="mr-loading">Scanning…</div>'
  let total = 0; const results = []
  for (const s of selected) {
    try {
      const data = await API.getScene(state.activeProject.id, s)
      const n = (data.content.match(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length
      if (n > 0) { results.push({s,n}); total += n }
    } catch {}
  }
  preview.innerHTML = results.length === 0 ? '<div class="mr-no-results">Not found in any scene</div>' :
    '<div class="mr-preview-header">Found <strong>' + total + '</strong> match' + (total!==1?'es':'') + ' across <strong>' + results.length + '</strong> scene' + (results.length!==1?'s':'') + '</div>' +
    results.map(r => '<div class="mr-preview-row"><span class="mr-scene-name">' + r.s + '</span><span class="mr-match-count">' + r.n + ' match' + (r.n!==1?'es':'') + '</span></div>').join('')
}

window.executeMultiReplace = async function() {
  const find = document.getElementById('mr-find')?.value
  const replace = document.getElementById('mr-replace')?.value || ''
  if (!find) { showToast('Enter text to find', 'error'); return }
  const selected = [...document.querySelectorAll('.mr-scene-cb:checked')].map(c => c.value)
  let total = 0
  for (const s of selected) {
    try {
      const data = await API.getScene(state.activeProject.id, s)
      const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi')
      const after = data.content.replace(re, replace)
      if (after !== data.content) {
        total += (data.content.match(re)||[]).length
        await API.saveScene(state.activeProject.id, s, after)
        if (s === state.activeScene) { document.getElementById('code-editor').value = after; updateGutter(); updateWordCount() }
      }
    } catch {}
  }
  document.getElementById('multi-replace-overlay')?.remove()
  showToast('Replaced ' + total + ' occurrence' + (total!==1?'s':'') + ' across scenes', 'success')
}

// ── Readability Stats ─────────────────────────────────────────────────────
window.showReadabilityStats = function() {
  const editor = document.getElementById('code-editor')
  if (!editor?.value.trim()) { showToast('Open a scene first', 'info'); return }
  const existing = document.getElementById('readability-panel')
  if (existing) { existing.remove(); return }
  const prose = editor.value.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('#') && l.trim().length > 0).join(' ')
  const words = prose.split(/\s+/).filter(Boolean).length
  const sentences = Math.max(1, (prose.match(/[.!?]+/g)||[]).length)
  const syllables = prose.toLowerCase().split(/\s+/).reduce((s,w) => s + Math.max(1,(w.match(/[aeiouy]{1,2}/g)||[]).length), 0)
  const flesch = Math.max(0, Math.min(100, Math.round(206.835 - 1.015*(words/sentences) - 84.6*(syllables/words))))
  const dialoguePct = Math.round((editor.value.split('\n').filter(l => /^[A-Z][a-zA-Z]+:/.test(l.trim()) || /"[^"]{4,}"/.test(l)).length / Math.max(1, editor.value.split('\n').filter(l=>l.trim()).length)) * 100)
  const fleschColor = flesch >= 70 ? 'var(--green)' : flesch >= 50 ? 'var(--accent)' : 'var(--red)'
  const fleschLabel = flesch >= 70 ? 'Easy' : flesch >= 50 ? 'Moderate' : flesch >= 30 ? 'Difficult' : 'Very difficult'
  const tip = Math.round(words/sentences) > 25 ? '💡 Long sentences detected — try splitting for better pacing.' :
    dialoguePct > 70 ? '💡 High dialogue ratio — ensure enough narrative context.' :
    flesch >= 60 ? '✓ Good readability for interactive fiction.' : '💡 CoG recommends Flesch score above 60.'
  const panel = document.createElement('div')
  panel.id = 'readability-panel'
  panel.className = 'readability-panel'
  panel.innerHTML = '<div class="readability-header"><div class="readability-title">📊 Readability — ' + state.activeScene + '</div>' +
    '<button onclick="document.getElementById(\'readability-panel\').remove()">✕</button></div>' +
    '<div class="readability-grid">' +
    '<div class="readability-item big"><div class="readability-val" style="color:' + fleschColor + '">' + flesch + '</div><div class="readability-label">Flesch Score</div><div class="readability-sub">' + fleschLabel + '</div></div>' +
    '<div class="readability-item"><div class="readability-val">' + Math.round(words/sentences) + '</div><div class="readability-label">Avg sentence length</div></div>' +
    '<div class="readability-item"><div class="readability-val">' + dialoguePct + '%</div><div class="readability-label">Dialogue ratio</div></div>' +
    '<div class="readability-item"><div class="readability-val">' + sentences + '</div><div class="readability-label">Sentences</div></div>' +
    '</div><div class="readability-tip">' + tip + '</div>'
  document.querySelector('.editor-toolbar')?.insertAdjacentElement('afterend', panel)
}

// ── Choice Tree ───────────────────────────────────────────────────────────
window.showChoiceTree = function() {
  const editor = document.getElementById('code-editor')
  if (!editor) return
  const existing = document.getElementById('choice-tree-panel')
  if (existing) { existing.remove(); return }
  const lines = editor.value.split('\n')
  const tree = []; let current = null
  lines.forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('*choice') || t.startsWith('*fake_choice')) {
      current = { line: i+1, type: t.split(' ')[0], options: [] }; tree.push(current)
    } else if (current && t.startsWith('#')) {
      const gotos = []; for (let j=i+1; j<Math.min(i+15,lines.length); j++) { const n=lines[j].trim(); if(n.startsWith('#')||n.startsWith('*choice')) break; const m=n.match(/^\*(goto|goto_scene)\s+(\w+)/); if(m) gotos.push(m[2]) }
      current.options.push({ text: t.slice(1).trim().slice(0,45), gotos, line: i+1 })
    }
  })
  if (!tree.length) { showToast('No *choice blocks in this scene', 'info'); return }
  const panel = document.createElement('div')
  panel.id = 'choice-tree-panel'; panel.className = 'choice-tree-panel'
  panel.innerHTML = '<div class="ct-header"><div class="ct-title">🌿 Choice Tree (' + tree.length + ' block' + (tree.length!==1?'s':'') + ')</div><button onclick="document.getElementById(\'choice-tree-panel\').remove()">✕</button></div>' +
    '<div class="ct-body">' + tree.map(c =>
      '<div class="ct-block"><div class="ct-block-label">' + c.type + ' <span class="ct-line">line ' + c.line + '</span></div><div class="ct-options">' +
      c.options.map(o => '<div class="ct-option"><div class="ct-option-hash">#</div><div class="ct-option-body"><div class="ct-option-text">' + o.text + '</div>' + (o.gotos.length?'<div class="ct-option-goto">→ '+o.gotos.join(', ')+'</div>':'') + '</div></div>').join('') +
      '</div></div>'
    ).join('') + '</div>'
  document.querySelector('.editor-toolbar')?.insertAdjacentElement('afterend', panel)
}

// ── Duplicate Detector ────────────────────────────────────────────────────
window.checkDuplicates = async function() {
  if (!state.activeProject) return
  const scenes = await API.getScenes(state.activeProject.id)
  const vars = {}, labels = {}, issues = []
  for (const scene of scenes) {
    try {
      const data = await API.getScene(state.activeProject.id, scene.name)
      data.content.split('\n').forEach(line => {
        const t = line.trim()
        const cm = t.match(/^\*create\s+(\w+)/); if (cm) { if(!vars[cm[1]]) vars[cm[1]]=[]; vars[cm[1]].push(scene.name) }
        const lm = t.match(/^\*label\s+(\w+)/); if (lm) { if(!labels[lm[1]]) labels[lm[1]]=[]; labels[lm[1]].push(scene.name) }
      })
    } catch {}
  }
  Object.entries(vars).forEach(([n,s]) => { if(s.length>1) issues.push({type:'Variable',name:n,scenes:s}) })
  Object.entries(labels).forEach(([n,s]) => { if(s.length>1) issues.push({type:'Label',name:n,scenes:s}) })
  const existing = document.getElementById('duplicates-panel')
  if (existing) { existing.remove(); return }
  const panel = document.createElement('div'); panel.id='duplicates-panel'; panel.className='duplicates-panel'
  panel.innerHTML = issues.length === 0 ?
    '<div class="dup-header"><div class="dup-title">✓ No Duplicates</div><button onclick="this.closest(\'.duplicates-panel\').remove()">✕</button></div><div class="dup-clean">No duplicate variables or labels found.</div>' :
    '<div class="dup-header"><div class="dup-title">⚠ ' + issues.length + ' Duplicate' + (issues.length!==1?'s':'') + '</div><button onclick="this.closest(\'.duplicates-panel\').remove()">✕</button></div>' +
    '<div class="dup-list">' + issues.map(i => '<div class="dup-item"><span class="dup-type">'+i.type+'</span><span class="dup-name">'+i.name+'</span><span class="dup-scenes">'+i.scenes.join(', ')+'</span></div>').join('') + '</div>'
  document.querySelector('.editor-toolbar')?.insertAdjacentElement('afterend', panel)
}

// ── Comment Mode ──────────────────────────────────────────────────────────
let commentModeOn = false
window.toggleCommentMode = function() {
  commentModeOn = !commentModeOn
  document.getElementById('code-editor')?.classList.toggle('comment-mode', commentModeOn)
  document.getElementById('comment-mode-btn')?.classList.toggle('active-tool', commentModeOn)
  showToast(commentModeOn ? 'Comment mode on' : 'Comment mode off', 'info')
}

// ── Scene Word Target ─────────────────────────────────────────────────────
window.setSceneTarget = function() {
  if (!state.activeScene) { showToast('Open a scene first', 'info'); return }
  const key = 'qt-' + state.activeProject?.id + '-' + state.activeScene
  const cur = localStorage.getItem(key) || ''
  const input = prompt('Word target for "' + state.activeScene + '" (0 to clear):', cur)
  if (input === null) return
  const num = parseInt(input)
  if (isNaN(num) || num < 0) { showToast('Invalid number', 'error'); return }
  num === 0 ? localStorage.removeItem(key) : localStorage.setItem(key, num)
  showToast(num === 0 ? 'Target cleared' : 'Target: ' + num.toLocaleString() + ' words', 'success')
  updateSceneTargetBar()
}

function updateSceneTargetBar() {
  const bar = document.getElementById('scene-target-bar')
  if (!bar || !state.activeScene || !state.activeProject) return
  const target = parseInt(localStorage.getItem('qt-' + state.activeProject.id + '-' + state.activeScene)) || 0
  if (!target) { bar.style.display = 'none'; return }
  const words = (document.getElementById('code-editor')?.value || '').split(/\s+/).filter(Boolean).length
  const pct = Math.min(100, Math.round(words/target*100))
  bar.style.display = 'flex'
  bar.innerHTML = '<div class="stb-label">Scene: ' + words.toLocaleString() + ' / ' + target.toLocaleString() + 'w</div><div class="stb-track"><div class="stb-fill" style="width:' + pct + '%"></div></div><div class="stb-pct">' + pct + '%</div>'
}

const _origWC = window.updateWordCount
window.updateWordCount = function() { _origWC?.(); updateSceneTargetBar() }
