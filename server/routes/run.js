import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_DIR = path.join(__dirname, '../../data/projects')

// ── Sync helper ───────────────────────────────────────────────────────────
function syncScenes(projectId, gamePath) {
  const skeinScenesDir = path.join(PROJECTS_DIR, projectId, 'scenes')
  const gameScenesDir = path.join(gamePath, 'mygame', 'scenes')
  const results = []
  let synced = 0

  if (!fs.existsSync(skeinScenesDir) || !fs.existsSync(gameScenesDir)) {
    return { results: ['No scenes to sync yet'], synced: 0 }
  }

  const sceneFiles = fs.readdirSync(skeinScenesDir).filter(f => f.endsWith('.txt'))
  for (const f of sceneFiles) {
    const src = path.join(skeinScenesDir, f)
    const dest = path.join(gameScenesDir, f)
    try {
      const srcMtime = fs.statSync(src).mtimeMs
      const destMtime = fs.existsSync(dest) ? fs.statSync(dest).mtimeMs : 0
      if (srcMtime > destMtime) {
        fs.copySync(src, dest, { overwrite: true })
        results.push(`✓ synced ${f}`)
        synced++
      } else {
        results.push(`— unchanged ${f}`)
      }
    } catch (e) {
      results.push(`✗ failed ${f}: ${e.message}`)
    }
  }
  return { results, synced }
}

// ── POST /api/run/:projectId — run with modal (sets path) ─────────────────
router.post('/:projectId', async (req, res) => {
  try {
    const { gamePath } = req.body
    if (!gamePath) return res.status(400).json({ error: 'gamePath required' })

    if (!fs.existsSync(path.join(gamePath, 'index.html'))) {
      return res.status(404).json({ error: `index.html not found at: ${gamePath}` })
    }

    // Save path to meta
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (fs.existsSync(metaPath)) {
      const meta = fs.readJsonSync(metaPath)
      meta.gamePath = gamePath
      meta.updatedAt = new Date().toISOString()
      fs.writeJsonSync(metaPath, meta, { spaces: 2 })
    }

    const { results, synced } = syncScenes(req.params.projectId, gamePath)
    const playUrl = `http://localhost:3001/play/${req.params.projectId}/`
    openBrowser(playUrl)

    res.json({ ok: true, playUrl, synced: `${synced} file(s) synced`, syncDetails: results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/run/:projectId/quick — one-click, uses saved path ────────────
router.get('/:projectId/quick', async (req, res) => {
  try {
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Project not found' })

    const meta = fs.readJsonSync(metaPath)
    if (!meta.gamePath) {
      return res.status(400).json({
        error: 'No game path saved yet',
        hint: 'Use the Run Game option from the three-dot menu first to set your game folder'
      })
    }

    const { results, synced } = syncScenes(req.params.projectId, meta.gamePath)
    const playUrl = `http://localhost:3001/play/${req.params.projectId}/`
    openBrowser(playUrl)

    res.json({ ok: true, playUrl, synced: `${synced} file(s) synced`, syncDetails: results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/run/:projectId/path ──────────────────────────────────────────
router.get('/:projectId/path', (req, res) => {
  const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
  if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Project not found' })
  const meta = fs.readJsonSync(metaPath)
  res.json({ gamePath: meta.gamePath || null })
})

// ── POST /api/run/:projectId/set-path ────────────────────────────────────
router.post('/:projectId/set-path', (req, res) => {
  try {
    const { gamePath } = req.body
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Project not found' })
    const meta = fs.readJsonSync(metaPath)
    meta.gamePath = gamePath
    meta.updatedAt = new Date().toISOString()
    fs.writeJsonSync(metaPath, meta, { spaces: 2 })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Open browser helper ───────────────────────────────────────────────────
function openBrowser(url) {
  const platform = process.platform
  const cmd = platform === 'win32' ? `start "" "${url}"`
    : platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd)
}

export default router
