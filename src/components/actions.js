// actions.js
import { API } from '../api.js'
import state from '../store.js'

export async function addAction(type, desc, detail = null, status = 'ok') {
  try {
    await API.logAction(type, desc, detail, status)
    // Show unread dot if panel is closed
    if (!state.actionsOpen) {
      document.getElementById('actions-unread').style.display = 'block'
    } else {
      renderActionsPanel()
    }
  } catch {}
}

export async function renderActionsPanel() {
  const list = document.getElementById('ap-list')
  if (!list) return
  try {
    const actions = await API.getActions(80)
    state.set('actions', actions)
    if (!actions.length) {
      list.innerHTML = `<div class="ap-empty">No activity yet.<br>Actions will appear here as you work.</div>`
      return
    }
    list.innerHTML = actions.map(a => {
      const icons = {
        save:'💾', create:'✦', delete:'🗑', import:'📂', export:'📤',
        image:'🖼', error:'⚠', run:'▶', analyze:'🔍', open:'📖', edit:'✏'
      }
      const statusColors = { ok:'var(--green)', warn:'var(--orange)', error:'var(--red)' }
      const time = new Date(a.time).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
      const date = new Date(a.time).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
      return `
        <div class="ap-item ap-status-${a.status}">
          <div class="ap-item-icon">${icons[a.type] || '•'}</div>
          <div class="ap-item-body">
            <div class="ap-item-desc">${a.desc}</div>
            ${a.detail ? `<div class="ap-item-detail">${a.detail}</div>` : ''}
            <div class="ap-item-time">${date} · ${time}</div>
          </div>
          <div class="ap-item-dot" style="background:${statusColors[a.status] || statusColors.ok}"></div>
        </div>`
    }).join('')
  } catch (e) {
    list.innerHTML = `<div class="ap-empty">Could not load activity log.</div>`
  }
}
