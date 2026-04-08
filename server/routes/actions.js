import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACTIONS_FILE = path.join(__dirname, '../../data/actions.json')
const MAX_ACTIONS = 200

function readActions() {
  return fs.existsSync(ACTIONS_FILE) ? fs.readJsonSync(ACTIONS_FILE) : []
}
function writeActions(list) {
  fs.writeJsonSync(ACTIONS_FILE, list.slice(0, MAX_ACTIONS), { spaces: 2 })
}

// Log an action (called by other routes internally, or by frontend)
export function logAction(type, desc, detail = null, status = 'ok') {
  const actions = readActions()
  actions.unshift({
    id: Date.now(),
    time: new Date().toISOString(),
    type,      // 'save' | 'create' | 'delete' | 'import' | 'export' | 'image' | 'error' | 'run' | 'analyze'
    desc,      // Human-readable: "Saved scene: startup"
    detail,    // Extra info: file path, word count, etc.
    status     // 'ok' | 'warn' | 'error'
  })
  writeActions(actions)
}

// GET actions log
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  res.json(readActions().slice(0, limit))
})

// POST log action from frontend
router.post('/', (req, res) => {
  const { type, desc, detail, status } = req.body
  if (!type || !desc) return res.status(400).json({ error: 'type and desc required' })
  logAction(type, desc, detail, status || 'ok')
  res.json({ ok: true })
})

// DELETE clear log
router.delete('/', (req, res) => {
  fs.writeJsonSync(ACTIONS_FILE, [])
  res.json({ ok: true })
})

export default router
