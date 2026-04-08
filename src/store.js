// store.js — App state. Import this wherever you need state.

export const state = {
  // Currently active project
  activeProject: null,  // { id, title, genre, ... }
  activeScene: null,    // scene name string

  // Loaded data
  projects: [],         // All dashboard projects
  scenes: [],           // Scene list for active project
  images: [],           // Images for active project
  actions: [],          // Activity log entries
  binProjects: [],      // Recycle bin

  // UI flags
  actionsOpen: false,
  writeModeOn: false,
  sidebarCollapsed: false,
  focusModeOn: false,

  // Autosave
  autosaveTimeout: null,
  lastSaved: null,

  // Game path per project (persisted to server)
  gamePath: null,

  // Listeners (simple event bus)
  _listeners: {},

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
  },
  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data))
  },
  set(key, value) {
    this[key] = value
    this.emit('change:' + key, value)
    this.emit('change', { key, value })
  }
}

export default state
