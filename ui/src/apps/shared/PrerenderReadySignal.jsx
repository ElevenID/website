import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { waitForFonts } from '../../utils/waitForFonts';
import i18n from '../../i18n';

function isApplicationReady() {
  return document.documentElement.classList.contains('app-ready')
    && !document.querySelector('[data-app-loading]')
    && Boolean(document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6'));
}

function PrerenderReadySignal() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    let frame = null;
    const pendingWaits = new Set();

    // Settling a wait also releases its resources. Cleanup settles only this
    // effect's waits, so abandoned routes cannot retain observers or deadlines.
    const waitForCompletion = (start) => new Promise((resolve) => {
      let settled = false;
      let dispose = () => {};
      const finish = () => {
        if (settled) return;
        settled = true;
        dispose();
        pendingWaits.delete(finish);
        resolve();
      };
      pendingWaits.add(finish);
      dispose = start(finish);
      if (settled) dispose();
    });

    const waitForTranslations = () => {
      const namespaces = Array.isArray(i18n.options.ns) ? i18n.options.ns : [];
      let translationsReady;
      try {
        translationsReady = Promise.resolve(i18n.loadNamespaces(namespaces)).catch(() => {});
      } catch {
        translationsReady = Promise.resolve();
      }
      return waitForCompletion((finish) => {
        const timeout = window.setTimeout(finish, 10000);
        translationsReady.then(finish);
        return () => window.clearTimeout(timeout);
      });
    };

    const waitForAppContent = () => {
      if (!document.querySelector('[data-app-loading]')) return Promise.resolve();

      return waitForCompletion((finish) => {
        const timeout = window.setTimeout(finish, 10000);
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-app-loading]')) finish();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
          window.clearTimeout(timeout);
          observer.disconnect();
        };
      });
    };

    const waitForApplicationReady = () => {
      if (isApplicationReady()) return Promise.resolve();

      return waitForCompletion((finish) => {
        const observer = new MutationObserver(() => {
          if (isApplicationReady()) finish();
        });
        observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
        if (isApplicationReady()) finish();
        return () => observer.disconnect();
      });
    };

    const waitForRouteContent = () => {
      if (!location.pathname.startsWith('/demos')) return Promise.resolve();
      if (document.querySelector('[data-demo-render-state="settled"]')) return Promise.resolve();

      return waitForCompletion((finish) => {
        const timeout = window.setTimeout(finish, 15000);
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-demo-render-state="settled"]')) finish();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        return () => {
          window.clearTimeout(timeout);
          observer.disconnect();
        };
      });
    };

    Promise.all([
      waitForFonts(),
      waitForTranslations(),
      waitForAppContent(),
      waitForRouteContent(),
      waitForApplicationReady(),
    ]).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (cancelled) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          if (!cancelled) document.dispatchEvent(new Event('app-rendered'));
        });
      });
    });

    return () => {
      cancelled = true;
      for (const finish of [...pendingWaits]) finish();
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
  }, [location.pathname, location.search]);

  return null;
}

export default PrerenderReadySignal;
