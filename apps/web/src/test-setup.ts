// jsdom doesn't implement canvas rendering; Chart.js only needs a context
// object it can call no-op methods on to mount without throwing in tests.
// Chart.js's acquireContext() also requires context.canvas === the element
// getContext() was called on (it discards the context otherwise) — a plain
// arrow function has no `this` to read the calling element from, so this
// has to be a regular function.
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return {
    canvas: this,
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    // Chart.js's teardown path (destroy() -> clearCanvas()) calls this one
    // specifically — only surfaces once a test actually unmounts a chart
    // mid-run rather than leaving it for the wrapper's final afterEach.
    resetTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
} as unknown as typeof HTMLCanvasElement.prototype.getContext;
