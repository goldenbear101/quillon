// server-wrapper.cjs — bridges Electron's CJS environment to the ESM server
const path = require('path')
const { pathToFileURL } = require('url')

process.env.QUILLON_PORT = process.env.QUILLON_PORT || '3941'

// On Windows, dynamic import needs a file:// URL not a bare path
const serverPath = path.join(__dirname, '../server/index.js')
const serverURL = pathToFileURL(serverPath).href

import(serverURL).catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
