// This function is serialized into the isolated Chrome document. Keep it
// self-contained; it must not depend on module scope or fetch external code.
export function installPrerenderReadiness(window, { fallbackDelayMs = 25000 } = {}) {
  const document = window.document;
  let fallbackAllowed = false;
  const ready = () => {
    const heading = document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6');
    return document.documentElement.classList.contains('app-ready')
      && !document.querySelector('[data-app-loading], [data-website-error-boundary]')
      && Boolean(heading?.textContent.trim())
      && (!window.location.pathname.startsWith('/demos')
        || Boolean(document.querySelector('[data-demo-render-state="settled"]')));
  };
  function mark(source) {
    if (!ready()) return;
    const root = document.documentElement;
    // A later normal signal is stronger evidence than an earlier fallback.
    // Do not let a later DOM mutation downgrade an observed signal.
    if (source === 'app-ready-fallback' && root.getAttribute('data-website-render-source') === 'signal') return;
    root.setAttribute('data-website-rendered', 'true');
    root.setAttribute('data-website-render-source', source);
    root.setAttribute('data-website-final-path', window.location.pathname);
  }
  const onSignal = () => mark('signal');
  document.addEventListener('app-rendered', onSignal);
  const observer = new window.MutationObserver(() => {
    if (fallbackAllowed && document.documentElement.getAttribute('data-website-rendered') !== 'true') {
      mark('app-ready-fallback');
    }
  });
  observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  const timer = window.setTimeout(() => {
    fallbackAllowed = true;
    if (document.documentElement.getAttribute('data-website-rendered') !== 'true') {
      mark('app-ready-fallback');
      if (document.documentElement.getAttribute('data-website-rendered') !== 'true') {
        document.documentElement.setAttribute('data-website-render-source', 'timeout');
      }
    }
  }, fallbackDelayMs);
  return () => {
    document.removeEventListener('app-rendered', onSignal);
    observer.disconnect();
    window.clearTimeout(timer);
  };
}
