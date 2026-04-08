// modals.js
export function showModal({ icon, title, desc, bodyHTML, confirmLabel, confirmClass, onConfirm, cancelLabel }) {
  closeModal()
  const container = document.getElementById('modal-container')
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.id = 'active-modal'
  backdrop.innerHTML = `
    <div class="modal-box">
      ${icon ? `<div class="modal-icon">${icon}</div>` : ''}
      <div class="modal-title">${title}</div>
      ${desc ? `<div class="modal-desc">${desc}</div>` : ''}
      ${bodyHTML ? `<div class="modal-body">${bodyHTML}</div>` : ''}
      <div class="modal-actions">
        <button class="modal-cancel" onclick="window.closeModal()">${cancelLabel || 'Cancel'}</button>
        <button class="${confirmClass || 'modal-confirm-ok'}" id="modal-confirm-btn">${confirmLabel || 'Confirm'}</button>
      </div>
    </div>`
  container.appendChild(backdrop)
  requestAnimationFrame(() => backdrop.classList.add('visible'))

  document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    if (onConfirm) onConfirm()
  })

  // ESC closes
  const esc = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', esc) } }
  document.addEventListener('keydown', esc)
}

export function closeModal() {
  const modal = document.getElementById('active-modal')
  if (modal) {
    modal.classList.remove('visible')
    setTimeout(() => modal.remove(), 200)
  }
}

window.closeModal = closeModal
