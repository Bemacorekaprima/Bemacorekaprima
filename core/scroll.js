const DEFAULT_MAIN_SELECTOR = ".main";

function getMainScroller(mainSelector = DEFAULT_MAIN_SELECTOR) {
  return document.querySelector(mainSelector);
}

export function captureViewScrollState(options = {}) {
  const main = getMainScroller(options.mainSelector);
  return {
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0,
    documentTop: document.scrollingElement?.scrollTop || 0,
    documentLeft: document.scrollingElement?.scrollLeft || 0,
    mainTop: main?.scrollTop || 0,
    mainLeft: main?.scrollLeft || 0
  };
}

export function restoreViewScrollState(snapshot, options = {}) {
  if (!snapshot) return;
  const restore = () => {
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = snapshot.documentTop || 0;
      document.scrollingElement.scrollLeft = snapshot.documentLeft || 0;
    }
    const main = getMainScroller(options.mainSelector);
    if (main) {
      main.scrollTop = snapshot.mainTop || 0;
      main.scrollLeft = snapshot.mainLeft || 0;
    }
    window.scrollTo(snapshot.windowX || 0, snapshot.windowY || 0);
  };
  restore();
  requestAnimationFrame(restore);
}

export function scrollViewToTop(options = {}) {
  const scrollTop = () => {
    const main = getMainScroller(options.mainSelector);
    if (main) {
      main.scrollTop = 0;
      main.scrollLeft = 0;
    }
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
      document.scrollingElement.scrollLeft = 0;
    }
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  };
  scrollTop();
  requestAnimationFrame(scrollTop);
}

export function scrollViewToElement(target, options = {}) {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return;
  const main = getMainScroller(options.mainSelector);
  const behavior = options.behavior || "smooth";
  const block = options.block || "start";
  if (main && main.contains(element)) {
    const mainRect = main.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    main.scrollTo({
      top: main.scrollTop + targetRect.top - mainRect.top,
      left: main.scrollLeft,
      behavior
    });
    return;
  }
  const rect = element.getBoundingClientRect();
  const offset = block === "center"
    ? rect.top + window.scrollY - (window.innerHeight / 2) + (rect.height / 2)
    : rect.top + window.scrollY;
  window.scrollTo({
    top: Math.max(0, offset),
    left: window.scrollX || 0,
    behavior
  });
}

export function applyViewScrollMode(scroll = "preserve", snapshot = null, options = {}) {
  if (scroll === "none") return;
  if (scroll === "top") {
    scrollViewToTop(options);
    return;
  }
  if (scroll && scroll !== "preserve") {
    scrollViewToElement(scroll, options);
    return;
  }
  restoreViewScrollState(snapshot, options);
}
