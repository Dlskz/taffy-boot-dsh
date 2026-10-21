/* ============================================================================
 * dsh-taffy-boot — 浏览器半侧（客户端 bundle）
 * ----------------------------------------------------------------------------
 * 作用：当宿主走 dsh-app:// 直出文档、绕过 index.html 注入时，
 *       由客户端 bundle 在加载时主动拉取 /dsh-taffy/* 并渲染启动动画。
 *       两条通道互为保险：Host 注入的页面已含 splash.js 时，这里直接跳过。
 *
 * 走 ModuleLoader 手写 bundle 格式（与 dsh-boot-animation / dsh-startup-secret 一致）。
 * ========================================================================== */
window.__ModuleLoader__.load({
  id: 'dsh-taffy-boot',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var ROUTE = '/dsh-taffy'

    function boot() {
      try {
        if (window.__TAFFY_BOOT_LOADED__ || window.__TAFFY_BOOT_CLIENT__) return
        if (document.getElementById('taffy-boot')) return
        window.__TAFFY_BOOT_CLIENT__ = true

        // 样式（幂等）
        if (!document.querySelector('link[data-taffy-boot]')) {
          var link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = ROUTE + '/splash.css'
          link.setAttribute('data-taffy-boot', '1')
          ;(document.head || document.documentElement).appendChild(link)
        }

        // 配置 → 图片清单 → 载入动画引擎
        fetch(ROUTE + '/config', { cache: 'no-store' })
          .then(function (res) { return res.json() })
          .then(function (payload) {
            if (!payload || payload.ok !== true) return
            var cfg = payload.config || {}
            if (cfg.enabled === false || cfg.client === false) return

            var files = Array.isArray(payload.files) ? payload.files : []
            window.TAFFY_BOOT_IMAGES = files
              .filter(function (f) { return f && f.charAt(0) !== '.' })
              .map(function (f) { return ROUTE + '/asset?f=' + encodeURIComponent(f) })

            window.__TAFFY_BOOT_CONFIG__ = {
              duration: Number(cfg.duration) || 9000,
              playOnce: cfg.playOnce !== false,
              allowSkip: cfg.allowSkip !== false,
              waitApp: true,
              preview: false
            }
            window.__TAFFY_BOOT_VERSION__ = payload.version
            try { fetch(ROUTE + '/beacon?src=client', { cache: 'no-store' }) } catch (e2) { /* noop */ }

            if (window.__TAFFY_BOOT_LOADED__) return
            var script = document.createElement('script')
            script.src = ROUTE + '/splash.js'
            script.async = true
            ;(document.head || document.documentElement).appendChild(script)
          })
          .catch(function () { /* 路由不可用时静默跳过，不影响应用 */ })
      } catch (err) {
        /* 任何异常都不能影响 DSH 客户端启动 */
      }
    }

    function apply() {
      boot()
    }

    exports.name = 'dsh-taffy-boot'
    exports.apply = apply

    // 立即执行一次，尽量抢在 React 挂载前铺满首屏
    boot()

    return module.exports
  }
})
