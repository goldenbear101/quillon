// storymap.js — Interactive scene graph using Canvas
import state from '../store.js'
import { API } from '../api.js'

let canvas, ctx, nodes = [], edges = [], dragging = null, dragOffX = 0, dragOffY = 0
let panX = 0, panY = 0, isPanning = false, panStartX = 0, panStartY = 0, scale = 1

export async function renderStoryMap() {
  const view = document.getElementById('view-storymap')
  if (!state.activeProject) {
    view.innerHTML = `<div class="editor-empty"><p>Open a project from the Dashboard to see its Story Map.</p></div>`
    return
  }

  view.innerHTML = `
    <div class="storymap-shell">
      <div class="storymap-toolbar">
        <span class="storymap-title">${state.activeProject.title} — Story Map</span>
        <div class="storymap-toolbar-right">
          <span class="storymap-hint">Drag nodes · Scroll to zoom · Click node to open scene</span>
          <button class="storymap-btn" onclick="smResetView()">⌖ Reset View</button>
          <button class="storymap-btn" onclick="smReLayout()">⟳ Re-layout</button>
        </div>
      </div>
      <div class="storymap-legend">
        <div class="sm-legend-item"><div class="sm-legend-dot" style="background:#5a9e6e"></div>No errors</div>
        <div class="sm-legend-item"><div class="sm-legend-dot" style="background:#c4825c"></div>Warnings</div>
        <div class="sm-legend-item"><div class="sm-legend-dot" style="background:#c45c5c"></div>Errors</div>
        <div class="sm-legend-item"><div class="sm-legend-dot" style="background:#5c8ec4"></div>Startup</div>
        <div class="sm-legend-item sm-legend-edge"><div class="sm-legend-line"></div>*goto / *gosub</div>
      </div>
      <canvas id="storymap-canvas" class="storymap-canvas"></canvas>
      <div class="storymap-tooltip" id="sm-tooltip" style="display:none"></div>
    </div>`

  canvas = document.getElementById('storymap-canvas')
  ctx = canvas.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  // Load scenes
  let scenes = []
  try { scenes = await API.getScenes(state.activeProject.id) } catch {}

  // Build nodes + edges
  await buildGraph(scenes)
  layoutNodes()
  draw()
  wireCanvasEvents()
}

async function buildGraph(scenes) {
  nodes = []
  edges = []

  // Create nodes
  scenes.forEach((s, i) => {
    nodes.push({
      id: s.name,
      label: s.name,
      words: s.words || 0,
      status: s.status || 'complete',
      x: 0, y: 0,
      w: Math.max(120, Math.min(180, s.name.length * 9 + 40)),
      h: 44,
      isStartup: s.name === 'startup'
    })
  })

  // Parse scene content to find *goto and *gosub links
  for (const scene of scenes) {
    try {
      const data = await API.getScene(state.activeProject.id, scene.name)
      const lines = data.content.split('\n')
      const linked = new Set()
      lines.forEach(line => {
        const m = line.trim().match(/^\*(goto|gosub|goto_scene|gosub_scene)\s+(\w+)/)
        if (m) {
          const target = m[2]
          if (nodes.find(n => n.id === target) && !linked.has(target)) {
            linked.add(target)
            edges.push({ from: scene.name, to: target })
          }
        }
      })
    } catch {}
  }
}

function layoutNodes() {
  // Layered layout — startup first, then build layers by connectivity
  const placed = new Set()
  const layers = []

  // Find startup node
  const startup = nodes.find(n => n.isStartup) || nodes[0]
  if (!startup) return

  // BFS layering
  let currentLayer = [startup.id]
  placed.add(startup.id)

  while (currentLayer.length > 0) {
    layers.push(currentLayer)
    const nextLayer = []
    currentLayer.forEach(id => {
      edges.filter(e => e.from === id).forEach(e => {
        if (!placed.has(e.to)) {
          placed.add(e.to)
          nextLayer.push(e.to)
        }
      })
    })
    currentLayer = nextLayer
  }

  // Any orphan nodes not reachable
  nodes.forEach(n => {
    if (!placed.has(n.id)) layers.push([n.id])
  })

  // Position nodes
  const layerGapX = 220
  const nodeGapY = 70
  const startX = 80
  const canvasMidY = canvas.height / 2

  layers.forEach((layer, li) => {
    const totalH = layer.length * nodeGapY
    layer.forEach((id, ni) => {
      const node = nodes.find(n => n.id === id)
      if (node) {
        node.x = startX + li * layerGapX
        node.y = canvasMidY - totalH / 2 + ni * nodeGapY
      }
    })
  })
}

function draw() {
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(panX, panY)
  ctx.scale(scale, scale)

  // Draw grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  const gridSize = 40
  for (let x = -panX/scale; x < (canvas.width - panX)/scale + gridSize; x += gridSize) {
    for (let y = -panY/scale; y < (canvas.height - panY)/scale + gridSize; y += gridSize) {
      ctx.beginPath()
      ctx.arc(Math.round(x/gridSize)*gridSize, Math.round(y/gridSize)*gridSize, 1.5, 0, Math.PI*2)
      ctx.fill()
    }
  }

  // Draw edges first (behind nodes)
  edges.forEach(e => drawEdge(e))

  // Draw nodes
  nodes.forEach(n => drawNode(n))

  ctx.restore()
}

function drawEdge(edge) {
  const from = nodes.find(n => n.id === edge.from)
  const to = nodes.find(n => n.id === edge.to)
  if (!from || !to) return

  const x1 = from.x + from.w
  const y1 = from.y + from.h / 2
  const x2 = to.x
  const y2 = to.y + to.h / 2
  const cp = (x2 - x1) * 0.5

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.bezierCurveTo(x1 + cp, y1, x2 - cp, y2, x2, y2)
  ctx.strokeStyle = 'rgba(200,169,110,0.25)'
  ctx.lineWidth = 1.5 / scale
  ctx.stroke()

  // Arrowhead
  const angle = Math.atan2(y2 - (y1 + y2)/2, x2 - (x1 + x2)/2)
  const aw = 8 / scale
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - aw * Math.cos(angle - 0.4), y2 - aw * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - aw * Math.cos(angle + 0.4), y2 - aw * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fillStyle = 'rgba(200,169,110,0.5)'
  ctx.fill()
}

function drawNode(node) {
  const { x, y, w, h, label, words, status, isStartup } = node
  const r = 6

  // Colors by status
  const colors = {
    complete: { bg: 'rgba(90,158,110,0.12)', border: '#5a9e6e', text: '#e8e4dc' },
    draft:    { bg: 'rgba(196,130,92,0.12)', border: '#c4825c', text: '#e8e4dc' },
    error:    { bg: 'rgba(196,92,92,0.12)',  border: '#c45c5c', text: '#e8e4dc' },
    complete_startup: { bg: 'rgba(92,142,196,0.15)', border: '#5c8ec4', text: '#e8e4dc' }
  }
  const key = isStartup ? 'complete_startup' : (status || 'complete')
  const c = colors[key] || colors.complete

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12 / scale

  // Background
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = c.bg
  ctx.fill()
  ctx.shadowBlur = 0

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.strokeStyle = c.border
  ctx.lineWidth = 1.5 / scale
  ctx.stroke()

  // Left accent bar
  ctx.beginPath()
  ctx.roundRect(x, y + 6, 3, h - 12, 2)
  ctx.fillStyle = c.border
  ctx.fill()

  // Label
  ctx.fillStyle = c.text
  ctx.font = `${Math.round(12/scale * scale)}px JetBrains Mono, monospace`
  ctx.font = '12px JetBrains Mono, monospace'
  ctx.fillText(label.length > 16 ? label.slice(0,14) + '…' : label, x + 14, y + h/2 - 4)

  // Word count
  ctx.fillStyle = 'rgba(200,169,110,0.7)'
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.fillText(words > 0 ? words + 'w' : '—', x + 14, y + h/2 + 10)

  // Startup crown
  if (isStartup) {
    ctx.fillStyle = '#5c8ec4'
    ctx.font = '10px sans-serif'
    ctx.fillText('START', x + w - 42, y + 14)
  }
}

function resizeCanvas() {
  if (!canvas) return
  const parent = canvas.parentElement
  canvas.width = parent.clientWidth
  canvas.height = parent.clientHeight - 80
  draw()
}

function wireCanvasEvents() {
  canvas.addEventListener('mousedown', e => {
    const pos = getCanvasPos(e)
    const hit = hitTest(pos)
    if (hit) {
      dragging = hit
      dragOffX = pos.x - hit.x
      dragOffY = pos.y - hit.y
    } else {
      isPanning = true
      panStartX = e.clientX - panX
      panStartY = e.clientY - panY
    }
  })

  canvas.addEventListener('mousemove', e => {
    const pos = getCanvasPos(e)
    const hit = hitTest(pos)
    canvas.style.cursor = hit ? 'pointer' : isPanning ? 'grabbing' : 'grab'

    if (dragging) {
      dragging.x = pos.x - dragOffX
      dragging.y = pos.y - dragOffY
      draw()
    } else if (isPanning) {
      panX = e.clientX - panStartX
      panY = e.clientY - panStartY
      draw()
    }

    // Tooltip
    const tooltip = document.getElementById('sm-tooltip')
    if (tooltip) {
      if (hit) {
        tooltip.style.display = 'block'
        tooltip.style.left = (e.clientX + 12) + 'px'
        tooltip.style.top = (e.clientY - 10) + 'px'
        const outgoing = edges.filter(ed => ed.from === hit.id).length
        const incoming = edges.filter(ed => ed.to === hit.id).length
        tooltip.innerHTML = `<strong>${hit.label}</strong><br>${hit.words.toLocaleString()} words · ${incoming} in · ${outgoing} out`
      } else {
        tooltip.style.display = 'none'
      }
    }
  })

  canvas.addEventListener('mouseup', e => {
    if (dragging) {
      // Click (no move) = open scene
      const pos = getCanvasPos(e)
      const dist = Math.hypot(pos.x - (dragging.x + dragOffX), pos.y - (dragging.y + dragOffY))
      if (dist < 4) {
        window.loadSceneByName?.(dragging.id)
        window.showView?.('editor')
      }
      dragging = null
    }
    isPanning = false
  })

  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    scale = Math.max(0.3, Math.min(2.5, scale * delta))
    draw()
  }, { passive: false })
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - panX) / scale,
    y: (e.clientY - rect.top - panY) / scale
  }
}

function hitTest(pos) {
  return nodes.find(n => pos.x >= n.x && pos.x <= n.x + n.w && pos.y >= n.y && pos.y <= n.y + n.h) || null
}

window.smResetView = function() { panX = 0; panY = 0; scale = 1; draw() }
window.smReLayout = function() { layoutNodes(); draw() }
