// characters.js — Track characters mentioned across scenes
import state from '../store.js'
import { API } from '../api.js'

// Scan all scenes for character references
// Characters are tracked via *create char_name and dialogue patterns like "CharName:"
export async function scanCharacters() {
  if (!state.activeProject) return []
  const scenes = state.scenes || []
  const charMap = {} // name -> { scenes: [], mentions: 0, vars: [] }

  for (const scene of scenes) {
    try {
      const data = await API.getScene(state.activeProject.id, scene.name)
      const lines = data.content.split('\n')

      lines.forEach((line, i) => {
        const trimmed = line.trim()

        // *create char_name or *temp char_name patterns
        const createMatch = trimmed.match(/^\*(create|temp)\s+(\w+)/i)
        if (createMatch) {
          const varName = createMatch[2]
          // Only if it looks like a character name (has _name, _title, etc. or is a proper noun style)
          if (/_(name|title|gender|pronouns?)$/.test(varName) || /^[A-Z]/.test(varName)) {
            const charKey = varName.replace(/_(name|title)$/i, '')
            if (!charMap[charKey]) charMap[charKey] = { name: charKey, scenes: [], mentions: 0, vars: [] }
            if (!charMap[charKey].scenes.includes(scene.name)) charMap[charKey].scenes.push(scene.name)
            charMap[charKey].vars.push(varName)
          }
        }

        // Dialogue pattern: "CharacterName:" at start of line
        const dialogMatch = trimmed.match(/^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?):\s/)
        if (dialogMatch) {
          const name = dialogMatch[1]
          if (name.length > 2 && !['Choice', 'Scene', 'Note', 'TODO'].includes(name)) {
            if (!charMap[name]) charMap[name] = { name, scenes: [], mentions: 0, vars: [] }
            if (!charMap[name].scenes.includes(scene.name)) charMap[name].scenes.push(scene.name)
            charMap[name].mentions++
          }
        }

        // *set references to character vars
        const setMatch = trimmed.match(/^\*set\s+(\w+)/)
        if (setMatch) {
          const varName = setMatch[1]
          Object.keys(charMap).forEach(key => {
            if (varName.startsWith(key.toLowerCase())) {
              charMap[key].mentions++
            }
          })
        }
      })
    } catch {}
  }

  return Object.values(charMap).sort((a, b) => b.mentions - a.mentions)
}

export function renderCharacterTracker(container) {
  container.innerHTML = `
    <div class="char-tracker">
      <div class="char-header">
        <div class="char-title">Character Tracker</div>
        <button class="char-scan-btn" onclick="rescanCharacters()">↻ Scan Scenes</button>
      </div>
      <div class="char-loading" id="char-loading">
        <div class="char-spinner"></div>
        <span>Scanning scenes for characters…</span>
      </div>
      <div class="char-list" id="char-list" style="display:none"></div>
    </div>
  `
  runCharacterScan(container)
}

async function runCharacterScan(container) {
  const loading = container.querySelector('#char-loading')
  const list = container.querySelector('#char-list')

  loading.style.display = 'flex'
  list.style.display = 'none'

  const chars = await scanCharacters()
  loading.style.display = 'none'
  list.style.display = 'block'

  if (chars.length === 0) {
    list.innerHTML = `
      <div class="char-empty">
        <div style="font-size:2rem;margin-bottom:8px">👤</div>
        No characters detected yet. Characters are found via dialogue patterns (Name: text) and *create variables with _name or _title.
      </div>`
    return
  }

  list.innerHTML = chars.map(c => `
    <div class="char-card">
      <div class="char-avatar">${c.name[0].toUpperCase()}</div>
      <div class="char-info">
        <div class="char-name">${c.name}</div>
        <div class="char-meta">
          ${c.mentions} mention${c.mentions !== 1 ? 's' : ''} · 
          ${c.scenes.length} scene${c.scenes.length !== 1 ? 's' : ''}
          ${c.vars.length > 0 ? `· vars: ${c.vars.slice(0,3).join(', ')}` : ''}
        </div>
        <div class="char-scenes">
          ${c.scenes.map(s => `<span class="char-scene-tag" onclick="window.loadSceneByName?.('${s}');window.showView?.('editor')">${s}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('')
}

window.rescanCharacters = function() {
  const container = document.getElementById('char-tracker-container')
  if (container) renderCharacterTracker(container)
}
