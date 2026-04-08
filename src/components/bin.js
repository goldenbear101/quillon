// bin.js
import { API } from '../api.js'
import { addAction } from './actions.js'
import { showModal, closeModal } from './modals.js'

export async function renderBin() {
  const view = document.getElementById('view-bin')
  view.innerHTML = `
    <div class="bin-scroll">
      <div class="bin-header">
        <div>
          <div class="bin-title">🗑️ Recycle Bin</div>
          <div class="bin-subtitle">Projects deleted from here are gone permanently.</div>
        </div>
        <button class="btn-sm danger" onclick="emptyBinConfirm()">Empty Bin</button>
      </div>
      <div id="bin-content" class="bin-grid"></div>
    </div>`
  await loadBin()
}

async function loadBin() {
  const content = document.getElementById('bin-content')
  try {
    const bin = await API.getBin()
    if (!bin.length) {
      content.innerHTML = `<div class="bin-empty">The bin is empty.</div>`
      return
    }
    content.innerHTML = bin.map(p => `
      <div class="bin-card">
        <div class="bin-card-cover" style="background:linear-gradient(135deg,var(--bg-raised),var(--bg-hover))">
          <span class="card-genre-badge">${p.genre || 'Other'}</span>
        </div>
        <div class="bin-card-body">
          <div class="bin-card-title">${p.title}</div>
          <div class="bin-card-date">Deleted ${new Date(p.deletedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · ${p.words||0} words</div>
          <div class="bin-card-actions">
            <button class="bin-restore-btn" onclick="restoreProject('${p.id}','${p.title.replace(/'/g,"\\'")}')">↩ Restore</button>
            <button class="bin-delete-btn" onclick="permDeleteConfirm('${p.id}','${p.title.replace(/'/g,"\\'")}')">Delete Forever</button>
          </div>
        </div>
      </div>`).join('')
  } catch (e) {
    content.innerHTML = `<div class="bin-empty">Could not load bin: ${e.message}</div>`
  }
}

window.restoreProject = async function(id, title) {
  try {
    await API.restoreProject(id)
    addAction('create', `Restored from bin: ${title}`, null, 'ok')
    showToast(`${title} restored`, 'success')
    await loadBin()
    window.updateBinBadge?.()
  } catch (e) {
    showToast(e.message, 'error')
  }
}

window.permDeleteConfirm = function(id, title) {
  showModal({
    icon: '🗑️',
    title: 'Delete Permanently?',
    desc: `"${title}" will be deleted forever. This cannot be undone.`,
    confirmLabel: 'Delete Forever',
    confirmClass: 'modal-confirm-delete',
    onConfirm: async () => {
      await API.permDeleteProject(id)
      addAction('delete', `Permanently deleted: ${title}`, null, 'warn')
      closeModal()
      showToast(`${title} permanently deleted`)
      await loadBin()
      window.updateBinBadge?.()
    }
  })
}

window.emptyBinConfirm = function() {
  showModal({
    icon: '⚠️',
    title: 'Empty Entire Bin?',
    desc: 'All projects in the bin will be permanently deleted. This cannot be undone.',
    confirmLabel: 'Empty Everything',
    confirmClass: 'modal-confirm-delete',
    onConfirm: async () => {
      const bin = await API.getBin()
      for (const p of bin) await API.permDeleteProject(p.id)
      addAction('delete', `Emptied recycle bin`, `${bin.length} projects deleted`, 'warn')
      closeModal()
      showToast('Bin emptied')
      await loadBin()
      window.updateBinBadge?.()
    }
  })
}
