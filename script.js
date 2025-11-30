const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizeSlider = document.getElementById('sizeSlider');
const clearButton = document.getElementById('clearCanvas');
const completeButton = document.getElementById('completeStroke');
const downloadButton = document.getElementById('downloadImage');
const emptyState = document.getElementById('emptyState');
const supportsPointerEvents = typeof window.PointerEvent !== 'undefined';

let drawing = false;
let currentStroke = null;
const strokes = [];
let pointerId = null;
let devicePixelRatioValue = window.devicePixelRatio || 1;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  devicePixelRatioValue = window.devicePixelRatio || 1;
  const { width, height } = rect;
  canvas.width = width * devicePixelRatioValue;
  canvas.height = height * devicePixelRatioValue;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatioValue, devicePixelRatioValue);
  redrawCanvas();
}

function getCanvasSize() {
  return {
    width: canvas.width / devicePixelRatioValue,
    height: canvas.height / devicePixelRatioValue
  };
}

function clearCanvasVisual() {
  const { width, height } = getCanvasSize();
  ctx.clearRect(0, 0, width, height);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  let clientX = event.clientX;
  let clientY = event.clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function getEventPointerId(event) {
  if (supportsPointerEvents) {
    return event.pointerId;
  }

  if ((event.touches && event.touches.length > 0) || (event.changedTouches && event.changedTouches.length > 0)) {
    return 'touch';
  }

  return 'mouse';
}

function startStroke(event) {
  event.preventDefault();
  if (drawing) {
    return;
  }

  if (event.button !== undefined && event.button !== 0 && !event.touches) {
    return;
  }

  pointerId = getEventPointerId(event);

  if (supportsPointerEvents && pointerId !== null && pointerId !== undefined) {
    canvas.setPointerCapture(pointerId);
  }

  drawing = true;
  currentStroke = {
    color: colorPicker.value,
    size: Number(sizeSlider.value),
    points: [],
    closed: false
  };

  addPointToStroke(event);
  redrawCanvas();
}

function addPointToStroke(event) {
  const point = pointerPosition(event);
  currentStroke.points.push(point);
}

function drawStroke(targetCtx, stroke, closePath = false) {
  const points = stroke.points;
  if (!points.length) {
    return;
  }

  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';
  targetCtx.strokeStyle = stroke.color;
  targetCtx.lineWidth = stroke.size;

  if (points.length === 1) {
    targetCtx.beginPath();
    targetCtx.fillStyle = stroke.color;
    targetCtx.arc(points[0].x, points[0].y, stroke.size / 2, 0, Math.PI * 2);
    targetCtx.fill();
    return;
  }

  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const midPoint = {
      x: (previous.x + current.x) / 2,
      y: (previous.y + current.y) / 2
    };

    targetCtx.quadraticCurveTo(previous.x, previous.y, midPoint.x, midPoint.y);
  }

  const lastPoint = points[points.length - 1];
  targetCtx.lineTo(lastPoint.x, lastPoint.y);

  if (closePath && points.length > 2) {
    targetCtx.lineTo(points[0].x, points[0].y);
    targetCtx.closePath();
    targetCtx.fillStyle = hexToRgba(stroke.color, 0.18);
    targetCtx.fill();
  }

  targetCtx.stroke();
}

function redrawCanvas() {
  clearCanvasVisual();

  strokes.forEach((stroke) => drawStroke(ctx, stroke, stroke.closed));

  if (currentStroke) {
    drawStroke(ctx, currentStroke, currentStroke.closed);
  }

  toggleEmptyState();
}

function toggleEmptyState() {
  const shouldHide = strokes.length > 0 || (currentStroke && currentStroke.points.length > 0);
  emptyState.classList.toggle('hidden', shouldHide);
}

function continueStroke(event) {
  event.preventDefault();

  const eventPointerId = getEventPointerId(event);

  if (!drawing || eventPointerId !== pointerId) {
    return;
  }

  addPointToStroke(event);
  redrawCanvas();
}

function endStroke(event) {
  event.preventDefault();

  const eventPointerId = getEventPointerId(event);

  if (!drawing || eventPointerId !== pointerId) {
    return;
  }

  addPointToStroke(event);
  strokes.push(currentStroke);
  currentStroke = null;
  drawing = false;
  if (supportsPointerEvents && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  pointerId = null;
  redrawCanvas();
}

function cancelStroke(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  if (!drawing) {
    return;
  }
  drawing = false;
  currentStroke = null;
  if (supportsPointerEvents && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  pointerId = null;
  redrawCanvas();
}

function completeLastStroke() {
  const targetStroke = currentStroke || strokes[strokes.length - 1];
  if (!targetStroke || targetStroke.points.length < 3) {
    return;
  }

  targetStroke.closed = true;
  redrawCanvas();
  animateButton(completeButton);
}

function clearCanvas() {
  strokes.length = 0;
  currentStroke = null;
  drawing = false;
  pointerId = null;
  redrawCanvas();
}

function downloadImage() {
  if (!strokes.length && !currentStroke) {
    animateButton(downloadButton);
    return;
  }

  const exportCanvas = document.createElement('canvas');
  const { width, height } = getCanvasSize();
  exportCanvas.width = width * devicePixelRatioValue;
  exportCanvas.height = height * devicePixelRatioValue;
  const exportCtx = exportCanvas.getContext('2d');

  exportCtx.setTransform(1, 0, 0, 1, 0, 0);
  exportCtx.scale(devicePixelRatioValue, devicePixelRatioValue);
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, width, height);

  strokes.forEach((stroke) => drawStroke(exportCtx, stroke, stroke.closed));
  if (currentStroke) {
    drawStroke(exportCtx, currentStroke, currentStroke.closed);
  }

  const link = document.createElement('a');
  link.download = 'creative-canvas.png';
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  animateButton(downloadButton);
}

function animateButton(button) {
  button.classList.add('active');
  setTimeout(() => button.classList.remove('active'), 180);
}

function hexToRgba(hex, alpha) {
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const numericValue = parseInt(sanitized, 16);
  const r = (numericValue >> 16) & 255;
  const g = (numericValue >> 8) & 255;
  const b = numericValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas, { passive: true });

if (supportsPointerEvents) {
  const pointerListenerOptions = { passive: false };

  canvas.addEventListener('pointerdown', startStroke, pointerListenerOptions);
  canvas.addEventListener('pointermove', continueStroke, pointerListenerOptions);
  canvas.addEventListener('pointerup', endStroke, pointerListenerOptions);
  canvas.addEventListener('pointerleave', cancelStroke, pointerListenerOptions);
  canvas.addEventListener('pointercancel', cancelStroke, pointerListenerOptions);

  window.addEventListener('pointerup', endStroke, pointerListenerOptions);
  window.addEventListener('pointercancel', cancelStroke, pointerListenerOptions);
} else {
  canvas.addEventListener('mousedown', startStroke);
  canvas.addEventListener('mousemove', continueStroke);
  canvas.addEventListener('mouseup', endStroke);
  canvas.addEventListener('mouseleave', cancelStroke);
  window.addEventListener('mouseup', endStroke);

  canvas.addEventListener('touchstart', startStroke, { passive: false });
  canvas.addEventListener('touchmove', continueStroke, { passive: false });
  canvas.addEventListener('touchend', endStroke, { passive: false });
  canvas.addEventListener('touchcancel', cancelStroke, { passive: false });
  window.addEventListener('touchend', endStroke, { passive: false });
  window.addEventListener('touchcancel', cancelStroke, { passive: false });
}

clearButton.addEventListener('click', clearCanvas);
completeButton.addEventListener('click', completeLastStroke);
downloadButton.addEventListener('click', downloadImage);
