#!/usr/bin/env node
/* ============================================================================
 * dsh-taffy-boot — Host 半侧
 * ----------------------------------------------------------------------------
 * 把永雏塔菲启动动画注入 DSH 的 Web GUI 首屏：
 *   1) 往 index.html 的 <head> 注入 critical CSS + 关键上锁脚本 + 样式表
 *   2) 往 <body> 开头注入粉色遮罩层、素材清单与 splash.js
 *   3) 提供 /dsh-taffy/splash.css · splash.js · asset · config 路由
 *   4) 读取 ~/.dsh/taffy-boot.json 配置（enabled / duration / playOnce / allowSkip）
 *
 * 不修改任何 DSH 官方文件；卸载插件即完全恢复。
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB_DIR = path.join(PKG_ROOT, 'lib')
const ASSET_DIR = path.join(LIB_DIR, 'assets')

export const name = 'dsh-taffy-boot'
export const inject = ['webServer']

const ROUTE_BASE = '/dsh-taffy'
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'taffy-boot.json')
const LOG_FILE = path.join(DSH_HOME, 'taffy-boot.log')

const DEFAULTS = {
  enabled: true,
  // tap：Host 往 index.html 注入；client：客户端 bundle 兜底渲染（两条通道互为保险）
  tap: true,
  client: true,
  duration: 9000,
  playOnce: true,
  allowSkip: true
}

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

const CRITICAL_CSS = [
  'html.dtb-lock,html.dtb-lock body{background:linear-gradient(160deg,#fff6fb 0%,#ffd9ea 55%,#ffc4df 100%);overflow:hidden}',
  '#dsh-taffy-veil{position:fixed;inset:0;z-index:2147482900;background:linear-gradient(160deg,#fff6fb 0%,#ffe3f0 45%,#ffcfe3 100%)}',
  '#dsh-taffy-veil.dtb-gone{display:none}'
].join('')

function log(line) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`)
  } catch (err) { /* 忽略日志失败 */ }
}

function readConfig() {
  let cfg = {}
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    if (!cfg || typeof cfg !== 'object') cfg = {}
  } catch (err) { cfg = {} }
  return Object.assign({}, DEFAULTS, cfg)
}

/* ---------------- 插件入口 ---------------- */
export function apply(ctx) {
  const webServer =
    (typeof ctx.get === 'function' ? ctx.get('webServer') : undefined) || ctx.webServer

  const usable =
    webServer &&
    typeof webServer.register === 'function' &&
    typeof webServer.tapIndex === 'function'

  if (!usable) {
    log('跳过：当前 profile 没有可用的 webServer（桌面端可能是 file:// + IPC 形态）')
    console.warn('[dsh-taffy-boot] 当前 profile 没有可用的 webServer，启动动画未启用')
    return
  }

  const disposers = []

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function listAssets() {
    try {
      return fs
        .readdirSync(ASSET_DIR)
        .filter((f) => !f.startsWith('.') && MIME[path.extname(f).toLowerCase()])
        .sort()
    } catch (err) {
      return []
    }
  }

  function readLib(file) {
    try {
      return fs.readFileSync(path.join(LIB_DIR, file), 'utf8')
    } catch (err) {
      return ''
    }
  }

  disposers.push(
    webServer.register({
      kind: 'exact',
      path: ROUTE_BASE + '/splash.css',
      handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readLib('splash.css'))
    })
  )

  disposers.push(
    webServer.register({
      kind: 'exact',
      path: ROUTE_BASE + '/splash.js',
      handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readLib('splash.js'))
    })
  )

  disposers.push(
    webServer.register({
      kind: 'exact',
      path: ROUTE_BASE + '/config',
      handler: (req, res) => sendJson(res, 200, {
        ok: true,
        version: readPkgVersion(),
        config: readConfig(),
        defaults: DEFAULTS,
        files: listAssets(),
        file: CONFIG_FILE
      })
    })
  )

  /* 素材：/dsh-taffy/asset?f=<文件名>（只允许 assets 目录内的白名单文件） */
  /* 诊断信标：客户端 bundle 每次启动会打一条，便于本地排查是否走到了客户端通道 */
  disposers.push(
    webServer.register({
      kind: 'exact',
      path: ROUTE_BASE + '/beacon',
      handler: (req, res) => {
        let src = 'unknown'
        try { src = new URL(req.url || '', 'http://127.0.0.1').searchParams.get('src') || 'unknown' } catch (err) { /* noop */ }
        log('beacon: ' + src + ' ua=' + String(req.headers['user-agent'] || '').slice(0, 40))
        res.writeHead(204)
        res.end()
      }
    })
  )

  disposers.push(
    webServer.register({
      kind: 'exact',
      path: ROUTE_BASE + '/asset',
      handler: (req, res) => {
        let file = ''
        try {
          const u = new URL(req.url || '', 'http://127.0.0.1')
          file = path.basename(u.searchParams.get('f') || '')
        } catch (err) { file = '' }
        const allowed = listAssets()
        if (!file || !allowed.includes(file)) {
          res.statusCode = 404
          res.end()
          return
        }
        const full = path.join(ASSET_DIR, file)
        let buf
        try {
          buf = fs.readFileSync(full)
        } catch (err) {
          res.statusCode = 404
          res.end()
          return
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'Content-Length': String(buf.length)
        })
        res.end(buf)
      }
    })
  )

  disposers.push(
    webServer.tapIndex((html) => {
      if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
      const cfg = readConfig()
      if (cfg.enabled === false || cfg.tap === false) return html

      const files = listAssets()
      const imageUrls = files.map((f) => `${ROUTE_BASE}/asset?f=${encodeURIComponent(f)}`)
      const bootCfg = {
        duration: Number(cfg.duration) || DEFAULTS.duration,
        playOnce: cfg.playOnce !== false,
        allowSkip: cfg.allowSkip !== false,
        waitApp: true,
        preview: false
      }

      const head =
        '<style id="dsh-taffy-critical">' + CRITICAL_CSS + '</style>' +
        '<script>try{document.documentElement.classList.add(\'dtb-lock\')}catch(e){}</script>' +
        '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">'

      const body =
        '<div id="dsh-taffy-veil" aria-hidden="true"></div>' +
        '<script>window.TAFFY_BOOT_IMAGES=' + JSON.stringify(imageUrls) + ';' +
        'window.__TAFFY_BOOT_CONFIG__=' + JSON.stringify(bootCfg) + ';' +
        'window.__TAFFY_BOOT_VERSION__=' + JSON.stringify(readPkgVersion()) + ';' +
        'window.__TAFFY_BOOT_HEALTH__=' + JSON.stringify(ROUTE_BASE + '/config') + ';</script>' +
        '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

      let out = html
      if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
      else out = head + out
      if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
      else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
      else out = out + body

      log(`inject ok: images=${imageUrls.length} duration=${bootCfg.duration} playOnce=${bootCfg.playOnce}`)
      return out
    })
  )

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch (err) { /* noop */ }
      }
    })
  }

  log(`plugin ready: assets=${listAssets().length} enabled=${readConfig().enabled}`)
}

function readPkgVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
    return String(pkg.version || '0.0.0')
  } catch (err) {
    return '0.0.0'
  }
}
