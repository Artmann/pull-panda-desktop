#!/usr/bin/env node

const { spawn } = require('node:child_process')
const path = require('node:path')

const electronPath = require('electron')
const appRoot = path.join(__dirname, '..')

const child = spawn(electronPath, [appRoot], {
  stdio: 'inherit',
  windowsHide: false
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})
