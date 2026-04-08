// chapters.js — Chapter/Act grouping for scenes
import state from '../store.js'
import { API } from '../api.js'

// Chapters are stored in project meta as:
// meta.chapters = [{ id, title, color, sceneNames: [] }]

export function getChapters() {
  return state.activeProject?.chapters || []
}

export function renderChapterManager(container) {
  const chapters = getChapters()
  const allScenes = state.scenes || []
  const assignedScenes = new Set(chapters.flatMap(c => c.sceneNames || []))
  const unassigned = allScenes.filter(s => !assignedScenes.has(s.name))

  container.innerHTML = `
    <div class="chapter-manager">
      <div class="chapter-header">
        <div class="chapter-title">Acts & Chapters</div>
        <button class="chapter-add-btn" onclick="addChapter()">+ New Act</button>
      </div>
      <div class="chapter-list" id="chapter-list">
        ${chapters.length === 0 ? '<div class="chapter-empty">No acts yet. Create one to organise your scenes.</div>' : ''}
        ${chapters.map((ch, i) => renderChapterCard(ch, i)).join('')}
      </div>
      ${unassigned.length > 0 ? `
        <div class="chapter-unassigned">
          <div class="chapter-unassigned-label">Unassigned scenes</div>
          ${unassigned.map(s => `
            <div class="chapter-scene-pill unassigned" data-scene="${s.name}">
              <span>${s.name}</span>
              <select class="assign-select" onchange="assignSceneToChapter('${s.name}', this.value)">
                <option value="">assign to act…</option>
                ${chapters.map((c, i) => `<option value="${i}">${c.title}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `
}

function renderChapterCard(ch, i) {
  const colors = ['#c9a96e','#7eb8a4','#a07ec9','#e07e7e','#7ea8e0','#e0b87e']
  const color = ch.color || colors[i % colors.length]
  return `
    <div class="chapter-card" data-chapter="${i}" style="border-left-color:${color}">
      <div class="chapter-card-header">
        <div class="chapter-card-dot" style="background:${color}"></div>
        <input class="chapter-card-title" value="${ch.title}" 
          onchange="renameChapter(${i}, this.value)" />
        <span class="chapter-scene-count">${(ch.sceneNames||[]).length} scenes</span>
        <button class="chapter-delete-btn" onclick="deleteChapter(${i})">✕</button>
      </div>
      <div class="chapter-scenes">
        ${(ch.sceneNames||[]).map(name => `
          <div class="chapter-scene-pill" data-scene="${name}">
            <span onclick="window.loadSceneByName && loadSceneByName('${name}')" style="cursor:pointer">${name}</span>
            <button onclick="removeSceneFromChapter(${i}, '${name}')" class="scene-pill-remove">✕</button>
          </div>
        `).join('')}
        ${(ch.sceneNames||[]).length === 0 ? '<div class="chapter-empty-scenes">No scenes yet</div>' : ''}
      </div>
    </div>
  `
}

window.addChapter = async function() {
  if (!state.activeProject) return
  const chapters = getChapters()
  const titles = ['Act I', 'Act II', 'Act III', 'Act IV', 'Act V', 'Epilogue', 'Prologue']
  const newTitle = titles[chapters.length] || `Act ${chapters.length + 1}`
  const updated = [...chapters, { id: Date.now(), title: newTitle, sceneNames: [] }]
  await saveChapters(updated)
}

window.renameChapter = async function(index, title) {
  const chapters = getChapters()
  chapters[index].title = title
  await saveChapters(chapters)
}

window.deleteChapter = async function(index) {
  const chapters = getChapters()
  chapters.splice(index, 1)
  await saveChapters(chapters)
}

window.assignSceneToChapter = async function(sceneName, chapterIndex) {
  if (chapterIndex === '') return
  const chapters = getChapters()
  const idx = parseInt(chapterIndex)
  // Remove from any existing chapter first
  chapters.forEach(c => { c.sceneNames = (c.sceneNames||[]).filter(n => n !== sceneName) })
  chapters[idx].sceneNames = [...(chapters[idx].sceneNames||[]), sceneName]
  await saveChapters(chapters)
}

window.removeSceneFromChapter = async function(chapterIndex, sceneName) {
  const chapters = getChapters()
  chapters[chapterIndex].sceneNames = chapters[chapterIndex].sceneNames.filter(n => n !== sceneName)
  await saveChapters(chapters)
}

async function saveChapters(chapters) {
  if (!state.activeProject) return
  try {
    const updated = await API.updateProject(state.activeProject.id, { chapters })
    state.set('activeProject', updated)
    // Re-render if chapter manager is open
    const container = document.getElementById('chapter-manager-container')
    if (container) renderChapterManager(container)
  } catch (e) {
    window.showToast?.('Could not save chapters: ' + e.message, 'error')
  }
}
