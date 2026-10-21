#!/usr/bin/env node
/* ============================================================
 * 构建 dsh-taffy-boot
 *
 *   1. src/taffy-boot.{css,js}  → lib/splash.{css,js}
 *   2. backgrounds/ 图片        → lib/assets/（大图用 sips 压缩）
 *   3. 生成 demo/manifest.js    → 预览页使用
 *   4. --pack：打包 dist/dsh-taffy-boot-<version>.tgz
 *
 * 用法：
 *   node scripts/build.mjs           # 构建
 *   node scripts/build.mjs --pack    # 构建 + 打包 tgz
 * ============================================================ */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'src')
const LIB = path.join(ROOT, 'lib')
const ASSETS = path.join(LIB, 'assets')
const BG = path.join(ROOT, 'backgrounds')
const DIST = path.join(ROOT, 'dist')
const PACK = process.argv.includes('--pack')

const EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_BYTES = 350 * 1024
const MAX_WIDTH = 800
const LONG_SIDE = 1100

function log(...a) { console.log('[build]', ...a) }

function imageWidth(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', file], { encoding: 'utf8' })
    const m = out.match(/pixelWidth:\s*(\d+)/)
    return m ? Number(m[1]) : 0
  } catch (e) {
    return 0
  }
}

function syncAssets() {
  fs.mkdirSync(ASSETS, { recursive: true })
  const names = []
  if (!fs.existsSync(BG)) return names

  for (const f of fs.readdirSync(BG).sort()) {
    const ext = path.extname(f).toLowerCase()
    if (!EXTS.includes(ext) || f.startsWith('.')) continue
    const src = path.join(BG, f)
    const size = fs.statSync(src).size
    const width = imageWidth(src)
    const stem = path.basename(f, path.extname(f))

    if (size > MAX_BYTES || width > MAX_WIDTH) {
      // 压缩：最长边 1100，JPEG q80
      const dest = path.join(ASSETS, stem + '.jpg')
      try {
        execFileSync('sips', ['-Z', String(LONG_SIDE), '-s', 'format', 'jpeg',
          '-s', 'formatOptions', '80', src, '--out', dest], { stdio: 'ignore' })
        names.push(path.basename(dest))
        log(`压缩 ${f} (${Math.round(size / 1024)}KB) → assets/${path.basename(dest)}`)
        continue
      } catch (e) {
        log(`压缩失败，使用原图：${f}`)
      }
    }
    fs.copyFileSync(src, path.join(ASSETS, f))
    names.push(f)
    log(`复制 ${f}`)
  }
  return names
}

function writeManifest(names) {
  const demo = path.join(ROOT, 'demo')
  fs.mkdirSync(demo, { recursive: true })
  const body = 'window.TAFFY_BOOT_MANIFEST = ' + JSON.stringify(names, null, 2) + ';\n'
  fs.writeFileSync(path.join(demo, 'manifest.js'), body, 'utf8')
  log(`manifest: ${names.length} 张 → demo/manifest.js`)
}

function copySources() {
  fs.copyFileSync(path.join(SRC, 'taffy-boot.css'), path.join(LIB, 'splash.css'))
  fs.copyFileSync(path.join(SRC, 'taffy-boot.js'), path.join(LIB, 'splash.js'))
  log('src → lib/splash.{css,js}')
}

function pack() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  fs.mkdirSync(DIST, { recursive: true })
  const stage = path.join(DIST, 'package')
  fs.rmSync(stage, { recursive: true, force: true })
  for (const entry of ['package.json', 'cordis.patch.yml', 'README.md', 'README.en.md', 'LICENSE', 'lib']) {
    const from = path.join(ROOT, entry)
    if (!fs.existsSync(from)) continue
    fs.cpSync(from, path.join(stage, entry), { recursive: true })
  }
  const tgz = path.join(DIST, `dsh-taffy-boot-${pkg.version}.tgz`)
  fs.rmSync(tgz, { force: true })
  execFileSync('tar', ['-czf', tgz, '-C', DIST, 'package'], {
    stdio: 'inherit',
    env: { ...process.env, COPYFILE_DISABLE: '1' }
  })
  log(`打包完成：${tgz}（${(fs.statSync(tgz).size / 1024 / 1024).toFixed(2)} MB）`)
}

copySources()
const names = syncAssets()
writeManifest(names)
if (PACK) pack()
log('done')
