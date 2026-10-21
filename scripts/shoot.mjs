#!/usr/bin/env node
/* ============================================================
 * 无头 Chrome 截图工具（测试用）
 *
 *   node shoot.mjs <url> <输出目录> <毫秒1,毫秒2,...>
 *
 * 每次使用独立 user-data-dir 与随机调试端口，避免 Profile 锁；
 * WebSocket 连接与截图均带超时，不会挂死。
 * ============================================================ */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.argv[2]
const OUT = process.argv[3]
const TIMES = (process.argv[4] || '1200,3200').split(',').map(Number)
const PORT = 18000 + Math.floor(Math.random() * 900)
const PROFILE = path.join(os.tmpdir(), `taffy-shoot-${Date.now()}-${PORT}`)
fs.mkdirSync(OUT, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--window-size=1440,900', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, URL
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cleanup = () => {
  try { chrome.kill('SIGKILL') } catch (e) { /* ignore */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch (e) { /* ignore */ }
}

async function getJson(p) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${p}`)
      if (res.ok) return await res.json()
    } catch (e) { /* retry */ }
    await sleep(200)
  }
  throw new Error('调试端口未就绪')
}

try {
  const list = await getJson('/json/list')
  const target = list.find((t) => t.type === 'page' && !t.url.startsWith('chrome') && !t.url.startsWith('devtools'))
  if (!target) throw new Error('找不到页面目标：' + JSON.stringify(list.map((t) => t.url)))

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch (e) { return }
    const slot = msg.id && pending.get(msg.id)
    if (!slot) return
    pending.delete(msg.id)
    clearTimeout(slot.timer)
    msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' 超时')) }
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), 8000)
    ws.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')) }, { once: true })
  })

  await send('Page.enable')
  await send('Runtime.enable')

  const t0 = Date.now()
  for (const ms of TIMES) {
    const wait = ms - (Date.now() - t0)
    if (wait > 0) await sleep(wait)
    console.log('  · 截图 ' + ms + 'ms …')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, `t${ms}.png`), Buffer.from(shot.data, 'base64'))
    const state = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const r = document.getElementById('taffy-boot');
        return { overlay: !!r, pct: r ? (r.querySelector('.tb-pct')||{}).textContent : null,
                 imgs: (window.TAFFY_BOOT_IMAGES||[]).length, active: !!window.__TAFFY_BOOT_ACTIVE__ };
      })()`
    })
    console.log(`t=${ms}ms ` + JSON.stringify(state.result.value))
  }
  ws.close()
  cleanup()
  process.exit(0)
} catch (err) {
  console.error('截图失败：', err.message)
  cleanup()
  process.exit(1)
}
