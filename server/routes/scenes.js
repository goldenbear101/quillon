import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_DIR = path.join(__dirname, '../../data/projects')

// GET all scenes for a project
router.get('/:projectId', (req, res) => {
  try {
    const scenesDir = path.join(PROJECTS_DIR, req.params.projectId, 'scenes')
    if (!fs.existsSync(scenesDir)) return res.json([])
    const files = fs.readdirSync(scenesDir).filter(f => f.endsWith('.txt'))
    const scenes = files.map(f => {
      const name = f.replace('.txt', '')
      const content = fs.readFileSync(path.join(scenesDir, f), 'utf8')
      const words = content.split(/\s+/).filter(Boolean).length
      const lines = content.split('\n').length
      const errors = analyzeScene(content, name)
      return { name, words, lines, errors, status: errors.errors > 0 ? 'error' : errors.warnings > 0 ? 'draft' : 'complete' }
    })
    res.json(scenes)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET single scene content
router.get('/:projectId/:sceneName', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'scenes', `${req.params.sceneName}.txt`)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Scene not found' })
    const content = fs.readFileSync(filePath, 'utf8')
    const errors = analyzeScene(content, req.params.sceneName)
    res.json({ name: req.params.sceneName, content, errors })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT save scene content (autosave + manual)
router.put('/:projectId/:sceneName', (req, res) => {
  try {
    const { content } = req.body
    const scenesDir = path.join(PROJECTS_DIR, req.params.projectId, 'scenes')
    fs.ensureDirSync(scenesDir)
    const filePath = path.join(scenesDir, `${req.params.sceneName}.txt`)
    fs.writeFileSync(filePath, content, 'utf8')

    // Update project meta word count
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (fs.existsSync(metaPath)) {
      const meta = fs.readJsonSync(metaPath)
      const allScenes = fs.readdirSync(scenesDir).filter(f => f.endsWith('.txt'))
      meta.words = allScenes.reduce((sum, f) => {
        const c = fs.readFileSync(path.join(scenesDir, f), 'utf8')
        return sum + c.split(/\s+/).filter(Boolean).length
      }, 0)
      meta.scenes = allScenes.length
      meta.updatedAt = new Date().toISOString()
      // Update sceneList
      const idx = meta.sceneList.findIndex(s => s.name === req.params.sceneName)
      const words = content.split(/\s+/).filter(Boolean).length
      const errors = analyzeScene(content, req.params.sceneName)
      if (idx >= 0) meta.sceneList[idx] = { ...meta.sceneList[idx], words, status: errors.errors > 0 ? 'error' : errors.warnings > 0 ? 'draft' : 'complete' }
      else meta.sceneList.push({ name: req.params.sceneName, words, status: 'draft' })
      fs.writeJsonSync(metaPath, meta, { spaces: 2 })
    }

    const errors = analyzeScene(content, req.params.sceneName)
    res.json({ ok: true, savedAt: new Date().toISOString(), errors })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST create new scene
router.post('/:projectId', (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Scene name required' })
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'scenes', `${cleanName}.txt`)
    if (fs.existsSync(filePath)) return res.status(409).json({ error: 'Scene already exists' })
    fs.writeFileSync(filePath, `*comment Scene: ${cleanName}\n\n`, 'utf8')

    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (fs.existsSync(metaPath)) {
      const meta = fs.readJsonSync(metaPath)
      meta.sceneList.push({ name: cleanName, words: 0, status: 'empty' })
      meta.scenes = meta.sceneList.length
      meta.updatedAt = new Date().toISOString()
      fs.writeJsonSync(metaPath, meta, { spaces: 2 })
    }
    res.json({ name: cleanName, content: '' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE scene
router.delete('/:projectId/:sceneName', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'scenes', `${req.params.sceneName}.txt`)
    if (fs.existsSync(filePath)) fs.removeSync(filePath)
    const metaPath = path.join(PROJECTS_DIR, req.params.projectId, 'meta.json')
    if (fs.existsSync(metaPath)) {
      const meta = fs.readJsonSync(metaPath)
      meta.sceneList = meta.sceneList.filter(s => s.name !== req.params.sceneName)
      meta.scenes = meta.sceneList.length
      meta.updatedAt = new Date().toISOString()
      fs.writeJsonSync(metaPath, meta, { spaces: 2 })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET analyze scene for errors (Grammarly-style)
router.get('/:projectId/:sceneName/analyze', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, req.params.projectId, 'scenes', `${req.params.sceneName}.txt`)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
    const content = fs.readFileSync(filePath, 'utf8')
    const result = analyzeScene(content, req.params.sceneName)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Deep ChoiceScript Error Analyzer ──────────────────────────────────────
function analyzeScene(content, sceneName) {
  const lines = content.split('\n')
  const issues = []
  const labels = new Set()
  const gotos = []
  const gosubs = []
  const choices = []
  let inChoice = false
  let choiceIndent = 0
  let hasStartup = sceneName === 'startup'

  // Pass 1: collect labels and gotos
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const lineNum = i + 1

    // Collect all *label declarations
    const labelMatch = trimmed.match(/^\*label\s+(\w+)/)
    if (labelMatch) labels.add(labelMatch[1])

    // Collect all *goto and *gosub references
    const gotoMatch = trimmed.match(/^\*(goto|goto_scene|gosub|gosub_scene)\s+(\S+)/)
    if (gotoMatch) {
      const list = gotoMatch[1].startsWith('gosub') ? gosubs : gotos
      list.push({ target: gotoMatch[2], line: lineNum, type: gotoMatch[1] })
    }
  })

  // Pass 2: line-by-line checks
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const lineNum = i + 1
    const indent = line.search(/\S/)

    if (!trimmed) return

    // Check for *if without closing branch
    if (/^\*(if|elseif)\s/.test(trimmed) && !trimmed.includes('{')) {
      const condition = trimmed.replace(/^\*(if|elseif)\s+/, '')
      if (!condition.trim()) {
        issues.push({ type: 'error', line: lineNum, msg: `*if statement has no condition`, category: 'logic' })
      }
    }

    // Check *set with invalid operator
    if (/^\*set\s/.test(trimmed)) {
      const setMatch = trimmed.match(/^\*set\s+(\w+)\s+(.*)/)
      if (setMatch && !setMatch[2].trim()) {
        issues.push({ type: 'error', line: lineNum, msg: `*set "${setMatch[1]}" has no value assigned`, category: 'variable' })
      }
    }

    // Check *choice indentation
    if (/^\*choice/.test(trimmed)) {
      inChoice = true
      choiceIndent = indent
      choices.push({ line: lineNum, indent })
    }

    if (inChoice && trimmed.startsWith('#')) {
      if (indent <= choiceIndent) {
        issues.push({ type: 'error', line: lineNum, msg: `Choice option "#..." must be indented further than *choice at line ${choiceIndent > 0 ? 'with indent ' + choiceIndent : '(root)'}`, category: 'indent' })
      }
    }

    // Check *finish/*ending in non-ending scenes
    if (/^\*ending/.test(trimmed) && sceneName !== 'ending') {
      issues.push({ type: 'warning', line: lineNum, msg: `*ending is typically only in the "ending" scene`, category: 'structure' })
    }

    // Check *title and *author only in startup
    if (/^\*title\s/.test(trimmed) && sceneName !== 'startup') {
      issues.push({ type: 'warning', line: lineNum, msg: `*title should only appear in startup`, category: 'structure' })
    }
    if (/^\*author\s/.test(trimmed) && sceneName !== 'startup') {
      issues.push({ type: 'warning', line: lineNum, msg: `*author should only appear in startup`, category: 'structure' })
    }

    // Check create vs temp
    if (/^\*create\s/.test(trimmed) && sceneName !== 'startup') {
      issues.push({ type: 'error', line: lineNum, msg: `*create must only be in startup. Use *temp for local variables.`, category: 'variable' })
    }

    // Check image syntax
    const imgMatch = trimmed.match(/^\*image\s+(\S+)/)
    if (imgMatch) {
      const imgName = imgMatch[1]
      if (!imgName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        issues.push({ type: 'warning', line: lineNum, msg: `Image "${imgName}" has no extension — should be .jpg, .png, or .webp`, category: 'image' })
      }
    }

    // Check *page_break followed by nothing
    if (/^\*page_break/.test(trimmed)) {
      const nextLine = lines[i + 1]?.trim()
      if (!nextLine || nextLine === '') {
        issues.push({ type: 'info', line: lineNum, msg: `*page_break at end of scene — nothing follows`, category: 'structure' })
      }
    }

    // Unknown commands
    const cmdMatch = trimmed.match(/^\*(\w+)/)
    if (cmdMatch) {
      const cmd = cmdMatch[1]
      const validCmds = new Set([
        'title','author','scene_list','create','temp','set','delete',
        'if','else','elseif','elsif','endif',
        'goto','goto_scene','gosub','gosub_scene','return',
        'choice','fake_choice','hide_reuse','allow_reuse','disable_reuse',
        'finish','ending','page_break','line_break',
        'image','text_image','sound','stat_chart',
        'achieve','achievement','check_achievements','check_purchase','purchase','restore_purchases','track_event',
        'comment','label','rand','input_text','input_number',
        'print','params','config','setref','gotoref','bug'
      ])
      if (!validCmds.has(cmd)) {
        issues.push({ type: 'error', line: lineNum, msg: `Unknown command "*${cmd}"`, category: 'syntax' })
      }
    }
  })

  // Pass 3: cross-reference gotos against labels (within-scene only)
  for (const g of gotos) {
    if (g.type === 'goto' && !labels.has(g.target)) {
      issues.push({ type: 'error', line: g.line, msg: `*goto "${g.target}" — label not found in this scene`, category: 'dead-end' })
    }
  }

  // Startup-specific checks
  if (sceneName === 'startup') {
    const hasTitleCmd = lines.some(l => /^\*title\s/.test(l.trim()))
    const hasAuthorCmd = lines.some(l => /^\*author\s/.test(l.trim()))
    const hasSceneList = lines.some(l => /^\*scene_list/.test(l.trim()))
    if (!hasTitleCmd) issues.push({ type: 'warning', line: 1, msg: `startup is missing *title`, category: 'structure' })
    if (!hasAuthorCmd) issues.push({ type: 'warning', line: 1, msg: `startup is missing *author`, category: 'structure' })
    if (!hasSceneList) issues.push({ type: 'warning', line: 1, msg: `startup is missing *scene_list`, category: 'structure' })
  }

  return {
    errors: issues.filter(i => i.type === 'error').length,
    warnings: issues.filter(i => i.type === 'warning').length,
    info: issues.filter(i => i.type === 'info').length,
    issues
  }
}

export default router
