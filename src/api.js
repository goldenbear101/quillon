// api.js — detects environment and points to correct backend
const isElectron = window.electronAPI?.isElectron === true

// In production (Cloudflare Pages), API calls go to Railway backend
// In Electron, they go to the local embedded server
// In dev, they go to localhost:3001
const RAILWAY_URL = 'YOUR_RAILWAY_URL'  // replaced after Railway deploy

const BASE = isElectron
  ? 'http://localhost:3941/api'
  : (RAILWAY_URL !== 'YOUR_RAILWAY_URL' && location.hostname !== 'localhost')
    ? `${RAILWAY_URL}/api`
    : 'http://localhost:3001/api'

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const API = {
  health: () => req('GET', '/health'),

  getProjects:      ()          => req('GET',    '/projects'),
  createProject:    (data)      => req('POST',   '/projects', data),
  updateProject:    (id, d)     => req('PUT',    `/projects/${id}`, d),
  deleteProject:    (id)        => req('DELETE', `/projects/${id}`),
  importProject:    (data)      => req('POST',   '/projects/import', data),
  getBin:           ()          => req('GET',    '/projects/bin'),
  restoreProject:   (id)        => req('POST',   `/projects/${id}/restore`),
  permDeleteProject:(id)        => req('DELETE', `/projects/${id}/permanent`),

  getScenes:   (pid)            => req('GET',    `/scenes/${pid}`),
  getScene:    (pid, name)      => req('GET',    `/scenes/${pid}/${name}`),
  createScene: (pid, name)      => req('POST',   `/scenes/${pid}`, { name }),
  saveScene:   (pid, name, c)   => req('PUT',    `/scenes/${pid}/${name}`, { content: c }),
  deleteScene: (pid, name)      => req('DELETE', `/scenes/${pid}/${name}`),
  analyzeScene:(pid, name)      => req('GET',    `/scenes/${pid}/${name}/analyze`),

  getImages:   (pid)            => req('GET',    `/images/${pid}`),
  deleteImage: (pid, file)      => req('DELETE', `/images/${pid}/${file}`),
  uploadImage: async (pid, file) => {
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch(`${BASE}/images/${pid}`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  getActions:   (limit) => req('GET',    `/actions?limit=${limit || 50}`),
  logAction:    (type, desc, detail, status) => req('POST', '/actions', { type, desc, detail, status }),
  clearActions: ()      => req('DELETE', '/actions'),

  runGame:     (pid, gamePath)  => req('POST',   `/run/${pid}`, { gamePath }),
  setGamePath: (pid, gamePath)  => req('PUT',    `/run/${pid}/path`, { gamePath }),

  exportProject: (pid) => `${BASE}/export/${pid}`,
  imageURL:      (pid, file) => `${BASE}/images/${pid}/file/${file}`
}
