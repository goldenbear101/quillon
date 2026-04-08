import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_DIR = path.join(__dirname, '../../data/projects')

// Dynamic storage — puts image in project's images/ folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imgDir = path.join(PROJECTS_DIR, req.params.projectId, 'images')
    fs.ensureDirSync(imgDir)
    cb(null, imgDir)
  },
  filename: (req, file, cb) => {
    // Sanitize filename, keep original name
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
    cb(null, safe)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) cb(null, true)
    else cb(new Error('Only image files allowed'))
  }
})

// GET list all images for a project
router.get('/:projectId', (req, res) => {
  try {
    const imgDir = path.join(PROJECTS_DIR, req.params.projectId, 'images')
    if (!fs.existsSync(imgDir)) return res.json([])
    const files = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    const images = files.map(f => ({
      name: f,
      url: `/api/images/${req.params.projectId}/file/${f}`,
      size: fs.statSync(path.join(imgDir, f)).size,
      uploadedAt: fs.statSync(path.join(imgDir, f)).mtime
    }))
    res.json(images)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET serve individual image file
router.get('/:projectId/file/:filename', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'images', req.params.filename)
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found')
  res.sendFile(filePath)
})

// POST upload image to project
router.post('/:projectId', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    res.json({
      name: req.file.filename,
      url: `/api/images/${req.params.projectId}/file/${req.file.filename}`,
      size: req.file.size
    })
  })
})

// DELETE remove image
router.delete('/:projectId/:filename', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'images', req.params.filename)
    if (fs.existsSync(filePath)) fs.removeSync(filePath)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
