// The code are inspired and copied from https://github.com/facebook/react/issues/16604 and https://github.com/vitejs/vite/tree/main/packages/plugin-react

import fs from 'fs'
import ExportNameCollector from './ExportNameCollector'

const runtimeFilePath = require.resolve(
  'react-refresh/cjs/react-refresh-runtime.development.js',
)

const reactRefreshExports = `
(function (){
  window.$react_refresh_exports$ = null
  let exports = {}
  return () => {
    if (window.$react_refresh_exports$) return window.$react_refresh_exports$
    ${fs
      .readFileSync(runtimeFilePath, 'utf-8')
      .replace('process.env.NODE_ENV', JSON.stringify('development'))}
    exports.performReactRefresh = (function debounce(fn) {
      let handle
      return () => {
        cancelAnimationFrame(handle)
        handle = requestAnimationFrame(fn)
      }
    }(exports.performReactRefresh))
    window.$react_refresh_exports$ = exports
    return exports
  }
}())()
`

export const reactRefreshRuntimeCode = `
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  const runtime = ${reactRefreshExports};
  runtime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
}
`.replace('process.env.NODE_ENV', JSON.stringify('development'))

export const addReactFreshWrapper = (
  id: string,
  code: string,
  collector: ExportNameCollector,
) => {
  let updater: string
  if (
    collector.isAbsolutelyNotReactRefreshBoundary ||
    collector.exportedNames.size === 0
  ) {
    updater = ''
  } else {
    updater = `
    if (${[...collector.exportedNames.values()]
      // .map((name) => `typeof ${name} === 'function'`)
      .map((name) => `RefreshRuntime.isLikelyComponentType(${name})`)
      .join('&&')}) {
      import.meta.hot.accept()
    } else {
      // For now, calling import.meta.hot.invalidate() simply reloads the page. https://vitejs.dev/guide/api-hmr.html#hot-dispose-cb
      // TODO: We should ask user before reloading the page.
      import.meta.hot.invalidate()
    }
`
  }

  return `
let prevRefreshReg;
let prevRefreshSig;
const RefreshRuntime = window.$react_refresh_exports$;

if (import.meta.hot) {
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    const fullId = ${JSON.stringify(id)} + ' ' + id;
    RefreshRuntime.register(type, fullId);
  }
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}

${code}

if (import.meta.hot) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
  ${updater}
  RefreshRuntime.performReactRefresh()
}`
}
