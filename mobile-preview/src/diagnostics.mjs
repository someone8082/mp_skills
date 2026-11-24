export const DIAGNOSTIC_CHANNEL = 'solver-lab-preview'

// Runs inside the isolated document before the lesson so early errors are visible.
export const diagnosticScript = `<script>
(() => {
  const channel = ${JSON.stringify(DIAGNOSTIC_CHANNEL)};
  let reports = 0;
  function report(message) {
    if (reports++ < 6) parent.postMessage({ channel, message: String(message).slice(0, 300) }, '*');
  }
  window.addEventListener('error', event => {
    if (event.message) report('脚本报错：' + event.message);
    else if (event.target && event.target !== window) report('资源加载失败：' + event.target.tagName);
  }, true);
  window.addEventListener('unhandledrejection', event => {
    report('异步脚本报错：' + (event.reason?.message || event.reason || '未知错误'));
  });
  document.addEventListener('securitypolicyviolation', event => {
    report('预览器拦截了资源或操作（' + event.effectiveDirective + '）。请检查外链或联网请求。');
  });
})();
</script>`

export function diagnosticMessage(event, frame) {
  if (!event.source || event.source !== frame.contentWindow || event.origin !== 'null') return null
  if (event.data?.channel !== DIAGNOSTIC_CHANNEL || typeof event.data.message !== 'string') return null
  return event.data.message.trim().slice(0, 300) || null
}
