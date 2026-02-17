const imageInput = document.getElementById("image-input");
const moodSelect = document.getElementById("mood-select");
const fontSelect = document.getElementById("font-select");
const generateBtn = document.getElementById("generate-btn");
const randomizeBtn = document.getElementById("randomize-btn");
const downloadBtn = document.getElementById("download-btn");
const addTextBtn = document.getElementById("add-text-btn");
const textItemsContainer = document.getElementById("text-items");
const propText = document.getElementById("prop-text");
const propSize = document.getElementById("prop-size");
const propColor = document.getElementById("prop-color");
const propShape = document.getElementById("prop-shape");
const removeTextBtn = document.getElementById("remove-text-btn");
const bringFrontBtn = document.getElementById("bring-front-btn");
const addImageInput = document.getElementById("add-image-input");
const imageItemsContainer = document.getElementById("image-items");
const imgScale = document.getElementById("img-scale");
const imgRotate = document.getElementById("img-rotate");
const imgOpacity = document.getElementById("img-opacity");
const imgFlip = document.getElementById("img-flip");
const removeImgBtn = document.getElementById("remove-img-btn");
const bringImgFrontBtn = document.getElementById("bring-img-front-btn");
const canvas = document.getElementById("meme-canvas");
const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
const refreshBtn = document.getElementById('refresh-btn');

let loadedImage = null;
let textItems = [];
let selectedId = null;
let selectedType = null; // 'text' or 'image'
let dragging = false;
let dragOffset = { x: 0, y: 0 };
let selectedFont = fontSelect ? fontSelect.value : 'Anton';
let imageLayers = [];
// simple drag state (move only)
let dragMode = null; // 'move'
let activeHandle = null;

const captions = {
  funny: [
    ["When you open the fridge", "and forget what you wanted"],
    ["Me: I'll go to bed early", "Also me at 3am watching videos"],
    ["Parallel parking?", "More like parallel suffering"]
  ],
  sarcastic: [
    ["Oh great", "Another Monday"],
    ["Sure, tell me more", "—said no one ever"],
    ["I love being ignored", "—said no one who mattered"]
  ],
  sad: [
    ["It's fine", "—said with tears"],
    ["I smiled", "but my heart was crying"],
    ["Alone in a crowd", "is still alone"]
  ],
  wholesome: [
    ["You did great", "I'm proud of you"],
    ["Small acts", "big love"]
  ],
  angry: [
    ["When someone eats your food", "without asking"],
    ["You had one job", "and you ruined it"]
  ]
};

function pickRandomCaption(mood) {
  const list = captions[mood] || captions.funny;
  return list[Math.floor(Math.random() * list.length)];
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fitCanvasToImage(img) {
  const maxWidth = 800;
  const scale = Math.min(1, maxWidth / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
}

function drawMeme() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (loadedImage) {
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
  } else {
    // placeholder background
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // draw image layers (in order)
  for (let i = 0; i < imageLayers.length; i++) {
    drawImageLayer(imageLayers[i]);
  }

  // draw each text item
  for (let i = 0; i < textItems.length; i++) {
    drawTextItem(textItems[i], i === (textItems.length - 1));
  }
}

function drawImageLayer(layer) {
  if (!layer.img) return;
  const x = layer.x || canvas.width / 2;
  const y = layer.y || canvas.height / 2;
  const scale = (layer.scale || 100) / 100;
  const w = (layer.img.width * scale);
  const h = (layer.img.height * scale);

  ctx.save();
  ctx.globalAlpha = (typeof layer.opacity === 'number') ? layer.opacity : 1;
  ctx.translate(x, y);
  if (layer.flip) ctx.scale(-1, 1);
  if (layer.rotate) ctx.rotate((layer.rotate * Math.PI) / 180);
  ctx.drawImage(layer.img, -w / 2, -h / 2, w, h);
  ctx.restore();

  // compute bbox for hit testing (approx, axis-aligned)
  layer._bbox = { x: x - w / 2, y: y - h / 2, w: w, h: h };

  // highlight if selected
  if (selectedType === 'image' && selectedId === layer.id) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(layer._bbox.x - 4, layer._bbox.y - 4, layer._bbox.w + 8, layer._bbox.h + 8);
    ctx.restore();
  }
}

function drawTextItem(item, isTopLayer) {
  const family = item.font || selectedFont || 'Anton';
  const fontSize = item.size || Math.round(canvas.width / 12);
  ctx.font = `bold ${fontSize}px ${formatFontFamily(family)}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.08));
  ctx.fillStyle = item.color || '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';

  // measure text and wrap
  const lines = wrapTextLines((item.text || '').toUpperCase(), canvas.width - 40, fontSize, family);
  const lineHeight = Math.round(fontSize * 1.05);
  const textHeight = lines.length * lineHeight;
  const x = item.x;
  const y = item.y;

  // compute max line width
  let maxW = 0;
  for (const ln of lines) {
    const m = ctx.measureText(ln).width;
    if (m > maxW) maxW = m;
  }
  const w = maxW + 20;
  const h = textHeight;

  // draw centered text
  for (let i = 0; i < lines.length; i++) {
    const yy = y - h / 2 + i * lineHeight + lineHeight * 0.85;
    ctx.strokeText(lines[i], x, yy);
    ctx.fillText(lines[i], x, yy);
  }

  // bounding box for hit testing (axis-aligned)
  item._bbox = { x: x - w / 2 - 8, y: y - h / 2 - 6, w: w + 16, h: h + 12 };

  // highlight selected item
  if (selectedType === 'text' && selectedId === item.id) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(item._bbox.x - 2, item._bbox.y - 2, item._bbox.w + 4, item._bbox.h + 4);
    ctx.restore();
  }
}

function wrapTextLines(text, maxWidth, fontSize, family) {
  // returns array of lines that fit within maxWidth
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = (line + ' ' + words[n]).trim();
    ctx.font = `bold ${fontSize}px ${formatFontFamily(family)}`;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      lines.push(line);
      line = words[n];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatFontFamily(family) {
  if (!family) return 'sans-serif';
  if (family.includes(',') || family.includes("'") || family.includes('"')) return family;
  if (family.includes(' ')) return `'${family}'`;
  return family;
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

if (imageInput) {
  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const img = await readImageFile(file);
      loadedImage = img;
      fitCanvasToImage(img);
      // reposition existing items relative to new canvas size (simple center reset)
      textItems.forEach(it => { it.x = canvas.width / 2; it.y = canvas.height / 2; });
      drawMeme();
    } catch (err) {
      console.error('Image load error', err);
    }
  });
}

// add image layer from input
if (addImageInput) {
  addImageInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const img = await readImageFile(file);
      addImageLayer(img, file.name);
    } catch (err) {
      console.error('Image layer load error', err);
    }
  });
}

if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    if (!loadedImage) {
      alert('Please choose an image first');
      return;
    }
    // add a caption from mood as a new text item
    const mood = moodSelect ? moodSelect.value : 'funny';
    const [t, b] = pickRandomCaption(mood);
    addTextItem(t + ' ' + b);
  });
}

if (randomizeBtn) {
  randomizeBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    const mood = moodSelect ? moodSelect.value : 'funny';
    const [t, b] = pickRandomCaption(mood);
    // create a single random caption and clear other text layers
    textItems = [];
    const newId = addTextItem(`${t} ${b}`);
    selectedType = 'text';
    selectedId = newId;
    renderTextList();
    drawMeme();
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meme.png';
    a.click();
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    // reset inputs
    if (imageInput) imageInput.value = '';
    if (addImageInput) addImageInput.value = '';

    // reset state
    loadedImage = null;
    textItems = [];
    imageLayers = [];
    selectedId = null;
    selectedType = null;
    dragging = false;
    dragOffset = { x: 0, y: 0 };

    // reset UI lists and properties
    renderTextList();
    renderImageList();
    if (propText) propText.value = '';
    if (propSize) propSize.value = 48;
    if (propColor) propColor.value = '#ffffff';
    if (propShape) propShape.value = 'none';

    // reset canvas to placeholder
    if (canvas && ctx) {
      canvas.width = 640;
      canvas.height = 360;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#333';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Choose an image to start', canvas.width/2, canvas.height/2);
    }
  });
}

// Text item management
function addTextItem(text) {
  const id = Date.now().toString(36);
  const item = {
    id,
    text: text || 'New text',
    x: canvas.width / 2,
    y: canvas.height / 2,
    font: selectedFont,
    size: Math.round(canvas.width / 12),
    color: '#ffffff',
    shape: 'none'
  };
  textItems.push(item);
  selectedId = id;
  renderTextList();
  drawMeme();
  return id;
}

if (addTextBtn) addTextBtn.addEventListener('click', () => addTextItem('New Text'));

function renderTextList() {
  if (!textItemsContainer) return;
  textItemsContainer.innerHTML = '';
  textItems.forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'text-item';
    el.innerHTML = `<button class="sel-btn">${idx+1}</button><span class="ti-label">${it.text.slice(0,40)}</span>`;
    el.querySelector('.sel-btn').addEventListener('click', () => { selectedId = it.id; populateProperties(it); drawMeme(); });
    textItemsContainer.appendChild(el);
  });
}

// Image layer management
function addImageLayer(img, name) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const layer = {
    id,
    name: name || 'image',
    img,
    x: canvas.width / 2,
    y: canvas.height / 2,
    scale: 100,
    rotate: 0,
    opacity: 1,
    flip: false
  };
  imageLayers.push(layer);
  selectedId = id;
  selectedType = 'image';
  renderImageList();
  populateImageProperties(layer);
  drawMeme();
}

function renderImageList() {
  if (!imageItemsContainer) return;
  imageItemsContainer.innerHTML = '';
  imageLayers.forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'text-item';
    el.innerHTML = `<button class="sel-btn">I${idx+1}</button><span class="ti-label">${it.name}</span>`;
    el.querySelector('.sel-btn').addEventListener('click', () => { selectedId = it.id; selectedType = 'image'; populateImageProperties(it); drawMeme(); });
    imageItemsContainer.appendChild(el);
  });
}

function populateImageProperties(it) {
  if (!it) return;
  if (imgScale) imgScale.value = it.scale;
  if (imgRotate) imgRotate.value = it.rotate;
  if (imgOpacity) imgOpacity.value = Math.round((it.opacity || 1) * 100);
  if (imgFlip) imgFlip.checked = !!it.flip;
}

function findImageLayerById(id) { return imageLayers.find(i => i.id === id); }

if (imgScale) imgScale.addEventListener('input', () => { const it = findImageLayerById(selectedId); if (!it) return; it.scale = Number(imgScale.value); drawMeme(); });
if (imgRotate) imgRotate.addEventListener('input', () => { const it = findImageLayerById(selectedId); if (!it) return; it.rotate = Number(imgRotate.value); drawMeme(); });
if (imgOpacity) imgOpacity.addEventListener('input', () => { const it = findImageLayerById(selectedId); if (!it) return; it.opacity = Number(imgOpacity.value)/100; drawMeme(); });
if (imgFlip) imgFlip.addEventListener('change', () => { const it = findImageLayerById(selectedId); if (!it) return; it.flip = imgFlip.checked; drawMeme(); });

if (removeImgBtn) removeImgBtn.addEventListener('click', () => {
  if (!selectedId || selectedType !== 'image') return;
  imageLayers = imageLayers.filter(i => i.id !== selectedId);
  selectedId = null; selectedType = null;
  renderImageList();
  drawMeme();
});

if (bringImgFrontBtn) bringImgFrontBtn.addEventListener('click', () => {
  if (!selectedId || selectedType !== 'image') return;
  const idx = imageLayers.findIndex(i => i.id === selectedId);
  if (idx >= 0) { const [it] = imageLayers.splice(idx,1); imageLayers.push(it); renderImageList(); drawMeme(); }
});

function populateProperties(it) {
  if (!it) return;
  if (propText) propText.value = it.text;
  if (propSize) propSize.value = it.size;
  if (propColor) propColor.value = it.color;
  if (propShape) propShape.value = it.shape || 'none';
}

function findItemById(id) { return textItems.find(t => t.id === id); }

if (propText) propText.addEventListener('input', () => { const it = findItemById(selectedId); if (!it) return; it.text = propText.value; renderTextList(); drawMeme(); });
if (propSize) propSize.addEventListener('input', () => { const it = findItemById(selectedId); if (!it) return; it.size = Number(propSize.value); drawMeme(); });
if (propColor) propColor.addEventListener('input', () => { const it = findItemById(selectedId); if (!it) return; it.color = propColor.value; drawMeme(); });
if (propShape) propShape.addEventListener('change', () => { const it = findItemById(selectedId); if (!it) return; it.shape = propShape.value; drawMeme(); });

if (removeTextBtn) removeTextBtn.addEventListener('click', () => {
  if (!selectedId) return;
  textItems = textItems.filter(t => t.id !== selectedId);
  selectedId = textItems.length ? textItems[textItems.length-1].id : null;
  renderTextList();
  drawMeme();
});

if (bringFrontBtn) bringFrontBtn.addEventListener('click', () => {
  if (!selectedId) return;
  const idx = textItems.findIndex(t => t.id === selectedId);
  if (idx >= 0) {
    const [it] = textItems.splice(idx,1);
    textItems.push(it);
    renderTextList();
    drawMeme();
  }
});

// allow selecting font default
if (fontSelect) {
  fontSelect.addEventListener('change', (e) => { selectedFont = e.target.value; });
}

// mouse interactions for dragging
function getCanvasPointFromMouseEvent(ev) {
  const rect = canvas.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

function getCanvasPointFromTouch(t) {
  const rect = canvas.getBoundingClientRect();
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

if (canvas) {
  canvas.addEventListener('mousedown', (ev) => {
    const { x, y } = getCanvasPointFromMouseEvent(ev);
    // check image layers first (topmost)
    for (let i = imageLayers.length - 1; i >= 0; i--) {
      const it = imageLayers[i];
      const b = it && it._bbox;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        selectedId = it.id; selectedType = 'image'; dragMode = 'move'; dragOffset.x = x - it.x; dragOffset.y = y - it.y; dragging = true; populateImageProperties(it); renderImageList(); drawMeme();
        return;
      }
    }

    // then check text items
    for (let i = textItems.length - 1; i >= 0; i--) {
      const it = textItems[i];
      const b = it && it._bbox;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        selectedId = it.id; selectedType = 'text'; dragMode = 'move'; dragOffset.x = x - it.x; dragOffset.y = y - it.y; dragging = true; populateProperties(it); renderTextList(); drawMeme();
        return;
      }
    }

    // click empty area deselect
    selectedId = null; selectedType = null; renderTextList(); renderImageList(); drawMeme();
  });
}

// hover cursor and dragging
window.addEventListener('mousemove', (ev) => {
  const { x, y } = getCanvasPointFromMouseEvent(ev);
  if (dragging && selectedId) {
    if (selectedType === 'image') {
      const it = findImageLayerById(selectedId);
      if (!it) return;
      it.x = x - dragOffset.x; it.y = y - dragOffset.y; populateImageProperties(it); drawMeme(); return;
    }
    if (selectedType === 'text') {
      const it = findItemById(selectedId);
      if (!it) return;
      it.x = x - dragOffset.x; it.y = y - dragOffset.y; populateProperties(it); drawMeme(); return;
    }
  }

  // hover detection: change cursor if over any bbox (images first)
  let hovering = false;
  for (let i = imageLayers.length - 1; i >= 0; i--) {
    const b = imageLayers[i] && imageLayers[i]._bbox;
    if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { hovering = true; break; }
  }
  if (!hovering) {
    for (let i = textItems.length - 1; i >= 0; i--) {
      const it = textItems[i];
      const b = it && it._bbox;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { hovering = true; break; }
    }
  }
  canvas.style.cursor = hovering ? 'move' : 'default';
});

// touch support
if (canvas) {
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const touch = ev.touches[0];
    const { x, y } = getCanvasPointFromTouch(touch);
    for (let i = imageLayers.length - 1; i >= 0; i--) {
      const it = imageLayers[i];
      const b = it && it._bbox;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        selectedId = it.id; selectedType = 'image'; dragOffset.x = x - it.x; dragOffset.y = y - it.y; dragging = true; populateImageProperties(it); renderImageList(); drawMeme(); return;
      }
    }
    for (let i = textItems.length - 1; i >= 0; i--) {
      const it = textItems[i];
      const b = it && it._bbox;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        selectedId = it.id; selectedType = 'text'; dragMode = 'move'; dragOffset.x = x - it.x; dragOffset.y = y - it.y; dragging = true; populateProperties(it); renderTextList(); drawMeme(); return;
      }
    }
    selectedId = null; selectedType = null; renderTextList(); renderImageList(); drawMeme();
  });

  canvas.addEventListener('touchmove', (ev) => {
    ev.preventDefault();
    if (!dragging) return;
    const touch = ev.touches[0];
    const { x, y } = getCanvasPointFromTouch(touch);
    if (selectedType === 'image') {
      const it = findImageLayerById(selectedId);
      if (!it) return;
      it.x = x - dragOffset.x; it.y = y - dragOffset.y; populateImageProperties(it); drawMeme();
    } else if (selectedType === 'text') {
      const it = findItemById(selectedId);
      if (!it) return;
      it.x = x - dragOffset.x; it.y = y - dragOffset.y; populateProperties(it); drawMeme();
    }
  });
}

window.addEventListener('mouseup', () => { dragging = false; dragMode = null; activeHandle = null; });

// keyboard nudge for selected item: arrows move, Shift for larger steps, Delete to remove
window.addEventListener('keydown', (e) => {
  // don't interfere when typing in inputs
  const active = document.activeElement && document.activeElement.tagName;
  if (active === 'INPUT' || active === 'TEXTAREA') return;
  const step = e.shiftKey ? 10 : 1;
  let moved = false;
  if (selectedType === 'text') {
    const it = findItemById(selectedId);
    if (!it) return;
    if (e.key === 'ArrowLeft') { it.x -= step; moved = true; }
    else if (e.key === 'ArrowRight') { it.x += step; moved = true; }
    else if (e.key === 'ArrowUp') { it.y -= step; moved = true; }
    else if (e.key === 'ArrowDown') { it.y += step; moved = true; }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      textItems = textItems.filter(t => t.id !== selectedId);
      selectedId = textItems.length ? textItems[textItems.length-1].id : null;
      renderTextList();
      drawMeme();
      return;
    }
    if (moved) { e.preventDefault(); populateProperties(it); drawMeme(); }
  } else if (selectedType === 'image') {
    const it = findImageLayerById(selectedId);
    if (!it) return;
    if (e.key === 'ArrowLeft') { it.x -= step; moved = true; }
    else if (e.key === 'ArrowRight') { it.x += step; moved = true; }
    else if (e.key === 'ArrowUp') { it.y -= step; moved = true; }
    else if (e.key === 'ArrowDown') { it.y += step; moved = true; }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      imageLayers = imageLayers.filter(i => i.id !== selectedId);
      selectedId = null; selectedType = null;
      renderImageList(); renderTextList(); drawMeme();
      return;
    }
    if (moved) { e.preventDefault(); populateImageProperties(it); drawMeme(); }
  }
});

// initialize an empty canvas
if (canvas && ctx) {
  canvas.width = 640;
  canvas.height = 360;
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#333';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Choose an image to start', canvas.width/2, canvas.height/2);
} else {
  console.warn('Canvas or 2D context not available.');
}
