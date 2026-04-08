import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_DIR = path.join(__dirname, '../../data/projects')
const BIN_FILE = path.join(__dirname, '../../data/bin.json')

function readBin() {
  return fs.existsSync(BIN_FILE) ? fs.readJsonSync(BIN_FILE) : []
}
function writeBin(data) {
  fs.writeJsonSync(BIN_FILE, data, { spaces: 2 })
}

// GET all projects
router.get('/', (req, res) => {
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR).filter(d =>
      fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
    )
    const projects = dirs.map(id => {
      const meta = path.join(PROJECTS_DIR, id, 'meta.json')
      return fs.existsSync(meta) ? fs.readJsonSync(meta) : null
    }).filter(Boolean)
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET single project
router.get('/:id', (req, res) => {
  const meta = path.join(PROJECTS_DIR, req.params.id, 'meta.json')
  if (!fs.existsSync(meta)) return res.status(404).json({ error: 'Not found' })
  res.json(fs.readJsonSync(meta))
})

// POST create new project
router.post('/', (req, res) => {
  try {
    const { title, genre, desc, author } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' })

    const id = uuidv4()
    const projectDir = path.join(PROJECTS_DIR, id)
    const scenesDir = path.join(projectDir, 'scenes')
    const imagesDir = path.join(projectDir, 'images')
    fs.ensureDirSync(scenesDir)
    fs.ensureDirSync(imagesDir)

    const meta = {
      id, title: title.trim(), genre: genre || 'Other',
      desc: desc?.trim() || '', author: author?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      words: 0, scenes: 0, vars: 0, completion: 0,
      coverColor: null, coverImage: null,
      sceneList: []
    }
    fs.writeJsonSync(path.join(projectDir, 'meta.json'), meta, { spaces: 2 })

    res.json(meta)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST import existing project (from user's local files)
router.post('/import', (req, res) => {
  try {
    const { title, genre, desc, author, files } = req.body
    // files = [{ name: 'startup.txt', content: '...' }, ...]
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' })
    if (!files?.length) return res.status(400).json({ error: 'No files provided' })

    const id = uuidv4()
    const projectDir = path.join(PROJECTS_DIR, id)
    const scenesDir = path.join(projectDir, 'scenes')
    const imagesDir = path.join(projectDir, 'images')
    fs.ensureDirSync(scenesDir)
    fs.ensureDirSync(imagesDir)

    const sceneList = []
    let totalWords = 0

    for (const file of files) {
      const sceneName = file.name.replace(/\.txt$/i, '')
      const scenePath = path.join(scenesDir, `${sceneName}.txt`)
      fs.writeFileSync(scenePath, file.content, 'utf8')
      const words = file.content.split(/\s+/).filter(Boolean).length
      totalWords += words
      sceneList.push({ name: sceneName, words, status: 'imported' })
    }

    const meta = {
      id, title: title.trim(), genre: genre || 'Other',
      desc: desc?.trim() || '', author: author?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      words: totalWords, scenes: sceneList.length, vars: 0, completion: 0,
      coverColor: null, coverImage: null,
      sceneList
    }
    fs.writeJsonSync(path.join(projectDir, 'meta.json'), meta, { spaces: 2 })

    res.json(meta)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH update project meta
router.patch('/:id', (req, res) => {
  try {
    const metaPath = path.join(PROJECTS_DIR, req.params.id, 'meta.json')
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' })
    const meta = fs.readJsonSync(metaPath)
    const updated = { ...meta, ...req.body, id: meta.id, updatedAt: new Date().toISOString() }
    fs.writeJsonSync(metaPath, updated, { spaces: 2 })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE move to bin
router.delete('/:id', (req, res) => {
  try {
    const projectDir = path.join(PROJECTS_DIR, req.params.id)
    if (!fs.existsSync(projectDir)) return res.status(404).json({ error: 'Not found' })
    const meta = fs.readJsonSync(path.join(projectDir, 'meta.json'))
    const bin = readBin()
    bin.unshift({ ...meta, deletedAt: new Date().toISOString() })
    writeBin(bin)
    fs.moveSync(projectDir, path.join(__dirname, '../../data/bin', req.params.id), { overwrite: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST restore from bin
router.post('/bin/restore/:id', (req, res) => {
  try {
    const binDir = path.join(__dirname, '../../data/bin', req.params.id)
    const projectDir = path.join(PROJECTS_DIR, req.params.id)
    if (!fs.existsSync(binDir)) return res.status(404).json({ error: 'Not in bin' })
    fs.moveSync(binDir, projectDir, { overwrite: true })
    const bin = readBin().filter(p => p.id !== req.params.id)
    writeBin(bin)
    const meta = fs.readJsonSync(path.join(projectDir, 'meta.json'))
    res.json(meta)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE permanently from bin
router.delete('/bin/:id', (req, res) => {
  try {
    const binDir = path.join(__dirname, '../../data/bin', req.params.id)
    if (fs.existsSync(binDir)) fs.removeSync(binDir)
    const bin = readBin().filter(p => p.id !== req.params.id)
    writeBin(bin)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET bin contents
router.get('/bin/list', (req, res) => {
  res.json(readBin())
})

export default router
