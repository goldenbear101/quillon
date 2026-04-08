// analysis.js — Full project analysis hub
import state from '../store.js'
import { API } from '../api.js'
import { renderChapterManager } from './chapters.js'
import { renderCharacterTracker } from './characters.js'

export function renderAnalysis() {
  const el = document.getElementById('view-analysis')
  if (!el) return

  if (!state.activeProject) {
    el.innerHTML = `
      <div class="analysis-empty">
        <div style="font-size:3rem;margin-bottom:16px">📊</div>
        <div style="font-size:1.1rem;color:var(--text-muted)">Open a project to see analysis</div>
      </div>`
    return
  }

  const p = state.activeProject
  const goal = p.wordGoal || null
  const currentWords = p.words || 0
  const goalPct = goal ? Math.min(100, Math.round((currentWords / goal) * 100)) : 0

  el.innerHTML = `
    <div class="analysis-layout">
      <div class="analysis-left">

        <div class="analysis-card">
          <div class="analysis-card-title">Project Overview</div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-val">${(currentWords).toLocaleString()}</div><div class="stat-label">Total Words</div></div>
            <div class="stat-item"><div class="stat-val">${p.scenes || 0}</div><div class="stat-label">Scenes</div></div>
            <div class="stat-item"><div class="stat-val">${p.vars || 0}</div><div class="stat-label">Variables</div></div>
            <div class="stat-item"><div class="stat-val">${p.completion || 0}%</div><div class="stat-label">Complete</div></div>
          </div>
        </div>

        <div class="analysis-card">
          <div class="analysis-card-title">Word Count Goal</div>
          ${goal ? `
            <div class="goal-progress-wrap">
              <div class="goal-numbers">
                <span class="goal-current">${currentWords.toLocaleString()}</span>
                <span class="goal-sep"> / </span>
                <span class="goal-target">${goal.toLocaleString()} words</span>
              </div>
              <div class="goal-bar-track">
                <div class="goal-bar-fill" style="width:${goalPct}%"></div>
              </div>
              <div class="goal-pct-row">
                <span class="goal-pct">${goalPct}%</span>
                <span class="goal-remain">${Math.max(0, goal - currentWords).toLocaleString()} words remaining</span>
              </div>
              ${p.goalPeriod ? '<div class="goal-period">Period: ' + p.goalPeriod + '</div>' : ''}
            </div>
            <div class="goal-actions">
              <button class="goal-btn goal-btn-edit" onclick="openGoalEditor()">Edit Goal</button>
              <button class="goal-btn goal-btn-clear" onclick="clearGoal()">Remove Goal</button>
            </div>
          ` : `
            <div class="goal-empty">No word count goal set.</div>
            <button class="goal-btn goal-btn-set" onclick="openGoalEditor()">+ Set Goal</button>
          `}
          <div class="goal-editor" id="goal-editor" style="display:none">
            <div class="goal-editor-row">
              <label>Target words</label>
              <input type="number" id="goal-words-input" placeholder="e.g. 50000" value="${goal || ''}" min="100" step="100"/>
            </div>
            <div class="goal-editor-row">
              <label>Period (optional)</label>
              <select id="goal-period-select">
                <option value="">No period</option>
                <option value="Daily" ${p.goalPeriod==='Daily'?'selected':''}>Daily</option>
                <option value="Weekly" ${p.goalPeriod==='Weekly'?'selected':''}>Weekly</option>
                <option value="Monthly" ${p.goalPeriod==='Monthly'?'selected':''}>Monthly</option>
                <option value="Project" ${p.goalPeriod==='Project'?'selected':''}>Full Project</option>
              </select>
            </div>
            <div class="goal-editor-btns">
              <button class="goal-btn goal-btn-set" onclick="saveGoal()">Save</button>
              <button class="goal-btn goal-btn-clear" onclick="closeGoalEditor()">Cancel</button>
            </div>
          </div>
        </div>

        <div class="analysis-card">
          <div class="analysis-card-title">Export Project</div>
          <div class="export-desc">Download your project as a .zip — scenes, images, and README — ready for Choice of Games submission or self-hosting.</div>
          <button class="export-btn" onclick="exportProject()">
            ↓ Download .zip
          </button>
        </div>

      </div>
      <div class="analysis-right">
        <div class="analysis-card"><div id="chapter-manager-container"></div></div>
        <div class="analysis-card"><div id="char-tracker-container"></div></div>
      </div>
    </div>
  `

  renderChapterManager(document.getElementById('chapter-manager-container'))
  renderCharacterTracker(document.getElementById('char-tracker-container'))
}

window.openGoalEditor = function() { document.getElementById('goal-editor').style.display = 'block' }
window.closeGoalEditor = function() { document.getElementById('goal-editor').style.display = 'none' }

window.saveGoal = async function() {
  const words = parseInt(document.getElementById('goal-words-input').value)
  const period = document.getElementById('goal-period-select').value
  if (!words || words < 1) { window.showToast?.('Enter a valid word count', 'error'); return }
  try {
    const updated = await API.updateProject(state.activeProject.id, { wordGoal: words, goalPeriod: period || null })
    state.set('activeProject', updated)
    renderAnalysis()
    window.showToast?.('Goal set: ' + words.toLocaleString() + ' words', 'success')
  } catch (e) { window.showToast?.('Error: ' + e.message, 'error') }
}

window.clearGoal = async function() {
  try {
    const updated = await API.updateProject(state.activeProject.id, { wordGoal: null, goalPeriod: null })
    state.set('activeProject', updated)
    renderAnalysis()
    window.showToast?.('Word goal removed')
  } catch (e) { window.showToast?.('Error: ' + e.message, 'error') }
}

window.exportProject = function() {
  if (!state.activeProject) return
  const a = document.createElement('a')
  a.href = 'http://localhost:3001/api/export/' + state.activeProject.id
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.showToast?.('Export started — check your downloads', 'success')
  window.addAction?.('export', 'Exported: ' + state.activeProject.title)
}
