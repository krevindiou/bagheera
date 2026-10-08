// jsdom has no canvas; Chart.js only needs no-op methods. A regular
// function, since Chart.js requires `context.canvas` to be `this`.
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return {
    canvas: this,
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    // Called by Chart.js's destroy().
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
