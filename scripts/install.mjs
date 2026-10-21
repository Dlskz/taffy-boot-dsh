#!/usr/bin/env node
/* ============================================================
 * 安装 / 卸载 dsh-taffy-boot 到 DSH 桌面端
 *
 *   node scripts/install.mjs              # 构建 + 打包 + 安装 + 关闭旧片头
 *   node scripts/install.mjs --uninstall  # 卸载并恢复旧片头配置
 *
 * 说明：
 *   - 通过 `dsh plugin --profile desktop add file:<tgz>` 安装
 *   - 自动把 dsh-taffy-boot 写入 profile 的 dsh.profile.bundles
 *   - 会把 ~/.dsh/dsh-startup.json 的 enabled 置 false（备份 .taffy-bak），
 *     避免与 dsh-startup-secret 的旧片头叠加
 * ============================================================ */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DSH_CLI = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh'
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const PROFILE_DIR = path.join(DSH_HOME, 'profiles', 'desktop')
const PROFILE_PKG = path.join(PROFILE_DIR, 'package.json')
const STARTUP_CFG = path.join(DSH_HOME, 'dsh-startup.json')
const PLUGIN = 'dsh-taffy-boot'
const uninstall = process.argv.includes('--uninstall')

const log = (...a) => console.log('[install]', ...a)
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const writeJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n', 'utf8')

function ensureCli() {
  if (!fs.existsSync(DSH_CLI)) {
    throw new Error(`找不到 dsh CLI：${DSH_CLI}\n请确认已安装 DeepSeek Harness 桌面端`)
  }
}

function runDsh(args) {
  log('dsh plugin --profile desktop ' + args.join(' '))
  execFileSync(DSH_CLI, ['plugin', '--profile', 'desktop', ...args], { stdio: 'inherit', cwd: PROFILE_DIR })
}

function setBundle(enable) {
  const pkg = readJson(PROFILE_PKG)
  pkg.dsh = pkg.dsh || {}
  pkg.dsh.profile = pkg.dsh.profile || {}
  const list = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : []
  const idx = list.indexOf(PLUGIN)
  if (enable && idx < 0) list.push(PLUGIN)
  if (!enable && idx >= 0) list.splice(idx, 1)
  pkg.dsh.profile.bundles = list
  writeJson(PROFILE_PKG, pkg)
  log('bundles: ' + list.join(', '))
}

function dropBundle(name) {
  const pkg = readJson(PROFILE_PKG)
  const list = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
  if (!list.includes(name)) return
  pkg.dsh.profile.bundles = list.filter((x) => x !== name)
  writeJson(PROFILE_PKG, pkg)
  log('已从 bundles 移除 ' + name)
}

function readdBundle(name) {
  if (!fs.existsSync(path.join(PROFILE_DIR, 'node_modules', name))) return
  const pkg = readJson(PROFILE_PKG)
  const list = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
  if (list.includes(name)) return
  list.push(name)
  pkg.dsh.profile.bundles = list
  writeJson(PROFILE_PKG, pkg)
  log('已恢复 bundles 中的 ' + name)
}

function disableOldSplash() {
  if (!fs.existsSync(STARTUP_CFG)) return
  const bak = STARTUP_CFG + '.taffy-bak'
  if (!fs.existsSync(bak)) fs.copyFileSync(STARTUP_CFG, bak)
  let cfg = {}
  try { cfg = readJson(STARTUP_CFG) } catch (e) { cfg = {} }
  cfg.enabled = false
  writeJson(STARTUP_CFG, cfg)
  log('已关闭 dsh-startup-secret 旧片头（备份 ' + bak + '）')
  // 仅改配置不够：它的设置页保存时会把 enabled 写回 true。
  // 从 bundles 摘掉，宿主才不会加载它、也就无法再注入第二层片头。
  dropBundle('dsh-startup-secret')
}

function restoreOldSplash() {
  const bak = STARTUP_CFG + '.taffy-bak'
  if (fs.existsSync(bak)) {
    fs.copyFileSync(bak, STARTUP_CFG)
    log('已恢复 dsh-startup.json')
  }
}

function pack() {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs'), '--pack'], { encoding: 'utf8' })
  process.stdout.write(out)
  const m = out.match(/打包完成：(.+\.tgz)/)
  if (!m) throw new Error('没有找到 tgz 产物')
  return m[1].trim()
}

function main() {
  ensureCli()
  if (uninstall) {
    log('卸载 ' + PLUGIN)
    try { runDsh(['remove', PLUGIN]) } catch (e) { log('remove 失败：' + e.message) }
    setBundle(false)
    restoreOldSplash()
    readdBundle('dsh-startup-secret')
    log('完成，请完全退出并重新打开 DSH')
    return
  }
  const tgz = pack()
  runDsh(['add', 'file:' + tgz])
  setBundle(true)
  disableOldSplash()
  log('安装完成 ✅ 完全退出 DSH（⌘Q）再打开即可看到启动动画')
  log('注入日志：' + path.join(DSH_HOME, 'taffy-boot.log'))
}

try { main() } catch (err) {
  console.error('[install] 失败：', err.message || err)
  process.exit(1)
}
