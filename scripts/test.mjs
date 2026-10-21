#!/usr/bin/env node
/* ============================================================
 * 离线验证：不启动 DSH，验证插件的注入逻辑与首屏渲染
 *
 *   node scripts/test.mjs
 *
 * 1. 用假 webServer 调用插件的 apply()
 * 2. 断言注入后的 index.html 含动画标签、配置与素材清单
 * 3. 起本地服务用真实路由处理器响应
 * 4. 若本机有 Chrome，则无头截图到 /tmp/taffy-shots
 * ============================================================ */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const { apply } = await import(path.join(ROOT, 'lib/index.js'))

const routes = new Map()
let tap = null
apply({
  webServer: {
    register(r) { routes.set(r.path, r.handler); return () => routes.delete(r.path) },
    tapIndex(fn) { tap = fn; return () => { tap = null } }
  }
})

const fail = (msg) => { console.error('✗ ' + msg); process.exit(1) }

console.log('· 路由：' + [...routes.keys()].join(', '))
if (!tap) fail('tapIndex 未注册')
if (!routes.has('/dsh-taffy/splash.js')) fail('缺少 splash.js 路由')
if (!routes.has('/dsh-taffy/asset')) fail('缺少 asset 路由')

const MOCK = '<!doctype html><html><head><meta charset="utf-8"><title>mock</title></head><body><div id="root"></div></body></html>'
const html = tap(MOCK)
for (const [name, ok] of Object.entries({
  '注入 splash.js': html.includes('/dsh-taffy/splash.js'),
  '注入 splash.css': html.includes('/dsh-taffy/splash.css'),
  '注入首屏遮罩': html.includes('dsh-taffy-veil'),
  '注入素材清单': html.includes('TAFFY_BOOT_IMAGES'),
  '注入配置': html.includes('__TAFFY_BOOT_CONFIG__')
})) {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fail(name)
}
const imgs = JSON.parse(html.match(/window\.TAFFY_BOOT_IMAGES=(\[[^\]]*\])/)[1])
console.log('· 图片数量：' + imgs.length + (imgs.length === 0 ? '（未放图，将显示占位角色）' : ''))

// 本地服务：复用真实路由处理器
const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1')
  if (u.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }
  const h = routes.get(u.pathname)
  if (!h) { res.statusCode = 404; res.end(); return }
  h(req, res)
})
await new Promise((r) => server.listen(18991, '127.0.0.1', r))
const cfg = await (await fetch('http://127.0.0.1:18991/dsh-taffy/config')).json()
console.log('· config：' + JSON.stringify(cfg.config) + '，files=' + (cfg.files || []).length)

// 可选截图
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (fs.existsSync(CHROME)) {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(HERE, 'shoot.mjs'),
        'http://127.0.0.1:18991/', path.join(os.tmpdir(), 'taffy-shots'), '1200,3200'], { stdio: 'inherit' })
      child.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('shoot 退出码 ' + c))))
    })
    console.log('· 截图：' + path.join(os.tmpdir(), 'taffy-shots'))
  } catch (e) {
    console.log('· 跳过截图：' + e.message)
  }
}
server.close()
console.log('✓ 全部通过')
