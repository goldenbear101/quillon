import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'

import projectsRouter from './routes/projects.js'
import scenesRouter from './routes/scenes.js'
import imagesRouter from './routes/images.js'
import actionsRouter from './routes/actions.js'
import runRouter from './routes/run.js'
import exportRouter from './routes/export.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Port: Railway sets PORT, Electron sets QUILLON_PORT, dev uses 3001
const PORT = process.env.PORT || process.env.QUILLON_PORT || 3001
const IS_ELECTRON = !!process.env.QUILLON_DATA
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT

// Data directory
const DATA_DIR = process.env.QUILLON_DATA
  ? path.resolve(process.env.QUILLON_DATA)
  : path.join(__dirname, '../data')

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const PROJECTS_DIR = path.join(DATA_DIR, 'projects')

fs.ensureDirSync(DATA_DIR)
fs.ensureDirSync(UPLOADS_DIR)
fs.ensureDirSync(PROJECTS_DIR)

// CORS — allow all origins (Cloudflare Pages domain + localhost)
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({ limit: '500mb', extended: true }))
app.use('/uploads', express.static(UPLOADS_DIR))

// Serve landing page
const landingPath = path.join(__dirname, '../landing.html')
app.get('/landing', (req, res) => {
  if (fs.existsSync(landingPath)) res.sendFile(landingPath)
  else res.status(404).send('Landing page not found')
})

// Serve built frontend for Electron
if (IS_ELECTRON) {
  const distDir = path.join(__dirname, '../dist')
  app.use('/app', express.static(distDir))
  app.get('/app', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

// API routes
app.use('/api/projects', projectsRouter)
app.use('/api/scenes', scenesRouter)
app.use('/api/images', imagesRouter)
app.use('/api/actions', actionsRouter)
app.use('/api/run', runRouter)
app.use('/api/export', exportRouter)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    env: IS_RAILWAY ? 'railway' : IS_ELECTRON ? 'electron' : 'dev'
  })
})

// Game play server
app.use('/play/:projectId', (req, res) => {
  try {
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (!fs.existsSync(metaPath)) return res.status(404).send('<h2>Project not found</h2>')
    const meta = fs.readJsonSync(metaPath)
    if (!meta.gamePath) return res.status(400).send('<h2>Game path not set</h2>')
    const requestedFile = req.path.replace(/^\//, '') || 'index.html'
    const filePath = path.join(meta.gamePath, requestedFile)
    if (!fs.existsSync(filePath)) return res.status(404).send(`Not found: ${requestedFile}`)
    res.sendFile(filePath)
  } catch (e) { res.status(500).send(e.message) }
})

app.listen(PORT, () => {
  console.log(`✦ Quillon Server running at http://localhost:${PORT}`)
  console.log(`  Data: ${DATA_DIR}`)
  if (!IS_ELECTRON && !IS_RAILWAY) {
    console.log(`  App:  http://localhost:5173`)
    console.log(`  Landing: http://localhost:${PORT}/landing`)
  }
})

export { DATA_DIR, UPLOADS_DIR, PROJECTS_DIR }
