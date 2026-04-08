import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import archiver from 'archiver'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_DIR = path.join(__dirname, '../../data/projects')

// GET /api/export/:projectId — streams a zip of the whole project
router.get('/:projectId', (req, res) => {
  try {
    const projectDir = path.join(PROJECTS_DIR, req.params.projectId)
    const metaPath = path.join(projectDir, 'meta.json')
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Project not found' })

    const meta = fs.readJsonSync(metaPath)
    const safeName = meta.title.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase()

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(res)

    // Add all scene .txt files flat (ready for ChoiceScript mygame/scenes/)
    const scenesDir = path.join(projectDir, 'scenes')
    if (fs.existsSync(scenesDir)) {
      archive.directory(scenesDir, 'scenes')
    }

    // Add images folder
    const imagesDir = path.join(projectDir, 'images')
    if (fs.existsSync(imagesDir)) {
      archive.directory(imagesDir, 'images')
    }

    // Add a README with project info
    const readme = [
      `# ${meta.title}`,
      `Author: ${meta.author || 'Unknown'}`,
      `Genre: ${meta.genre || 'Unknown'}`,
      `Description: ${meta.desc || '—'}`,
      `Exported: ${new Date().toISOString()}`,
      ``,
      `## How to use`,
      `1. Copy all files from /scenes into your ChoiceScript mygame/scenes/ folder`,
      `2. Copy images into your mygame/ folder`,
      `3. Open index.html in your ChoiceScript web/ folder to play`,
    ].join('\n')

    archive.append(readme, { name: 'README.md' })
    archive.finalize()
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
