/**
 * Image Compress Tool
 * 使用 Canvas API 实现纯前端图片压缩
 */

const state = {
  images: [],      // { id, file, originalUrl, compressedUrl, originalSize, compressedSize, img }
  quality: 0.7,
  nextId: 0,
};

/* ─── DOM refs ─── */
const $ = (s) => document.querySelector(s);
const uploadArea    = $('#upload-area');
const workspace     = $('#workspace');
const fileInput     = $('#file-input');
const qualitySlider = $('#quality-slider');
const qualityValue  = $('#quality-value');
const imageList     = $('#image-list');
const totalOriginal = $('#total-original');
const totalCompressed = $('#total-compressed');
const totalSavings  = $('#total-savings');
const toast         = $('#toast');

/* ─── Utils ─── */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ─── Compress single image ─── */
function compressImage(imgEl, fileName, quality) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);

    // Determine output format — use jpeg for compression (unless PNG with transparency)
    const ext = fileName.toLowerCase().split('.').pop();
    let mime = 'image/jpeg';
    if (ext === 'png') mime = 'image/png';
    if (ext === 'webp') mime = 'image/webp';

    // For PNG, quality param is ignored by browsers, so we convert to webp/jpeg for actual compression
    const compressMime = mime === 'image/png' ? 'image/webp' : mime;

    canvas.toBlob((blob) => {
      resolve({ blob, url: URL.createObjectURL(blob) });
    }, compressMime, quality);
  });
}

/* ─── Process a file ─── */
async function addFile(file) {
  if (!file.type.startsWith('image/')) return;

  const img = new Image();
  const originalUrl = URL.createObjectURL(file);

  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = originalUrl;
  });

  const { blob, url } = await compressImage(img, file.name, state.quality);

  const entry = {
    id: state.nextId++,
    file,
    fileName: file.name,
    img,
    originalUrl,
    originalSize: file.size,
    compressedUrl: url,
    compressedSize: blob.size,
    compressedBlob: blob,
  };

  state.images.push(entry);
  renderCard(entry);
  updateSummary();
  updateUI();
}

/* ─── Re-compress all at new quality ─── */
async function recompressAll() {
  for (const entry of state.images) {
    URL.revokeObjectURL(entry.compressedUrl);
    const { blob, url } = await compressImage(entry.img, entry.fileName, state.quality);
    entry.compressedUrl = url;
    entry.compressedSize = blob.size;
    entry.compressedBlob = blob;
  }
  renderAll();
  updateSummary();
}

/* ─── Render ─── */
function renderCard(entry) {
  const savings = ((1 - entry.compressedSize / entry.originalSize) * 100);
  const savingsClass = savings > 20 ? 'good' : 'low';

  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.id = entry.id;
  card.innerHTML = `
    <div class="preview">
      <img src="${entry.compressedUrl}" alt="${entry.fileName}">
      <span class="compare-badge original">${formatSize(entry.originalSize)}</span>
      <span class="compare-badge compressed">${formatSize(entry.compressedSize)}</span>
    </div>
    <div class="info">
      <div class="filename" title="${entry.fileName}">${entry.fileName}</div>
      <div class="sizes">
        <span>${formatSize(entry.originalSize)}</span>
        <span class="arrow">→</span>
        <span class="new-size">${formatSize(entry.compressedSize)}</span>
        <span class="savings ${savingsClass}">-${savings.toFixed(1)}%</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="download" data-id="${entry.id}">下载</button>
      <button class="remove" data-id="${entry.id}">移除</button>
    </div>
  `;
  imageList.appendChild(card);
}

function renderAll() {
  imageList.innerHTML = '';
  for (const entry of state.images) {
    renderCard(entry);
  }
}

function updateSummary() {
  let origTotal = 0, compTotal = 0;
  for (const e of state.images) {
    origTotal += e.originalSize;
    compTotal += e.compressedSize;
  }
  totalOriginal.textContent = formatSize(origTotal);
  totalCompressed.textContent = formatSize(compTotal);
  const pct = origTotal > 0 ? ((1 - compTotal / origTotal) * 100).toFixed(1) : '0';
  totalSavings.textContent = `-${pct}%`;
}

function updateUI() {
  if (state.images.length > 0) {
    uploadArea.classList.add('hidden');
    workspace.classList.add('active');
  } else {
    uploadArea.classList.remove('hidden');
    workspace.classList.remove('active');
  }
}

/* ─── Download helpers ─── */
function downloadOne(entry) {
  const ext = entry.compressedBlob.type.split('/')[1] === 'webp' ? 'webp' : entry.fileName.split('.').pop();
  const baseName = entry.fileName.replace(/\.[^.]+$/, '');
  const a = document.createElement('a');
  a.href = entry.compressedUrl;
  a.download = `${baseName}_compressed.${ext}`;
  a.click();
}

function downloadAll() {
  if (state.images.length === 0) return;
  for (const entry of state.images) {
    downloadOne(entry);
  }
  showToast(`已导出 ${state.images.length} 张图片`);
}

/* ─── Events ─── */
// File input
fileInput.addEventListener('change', (e) => {
  for (const f of e.target.files) addFile(f);
  fileInput.value = '';
});

// Upload area click
uploadArea.addEventListener('click', () => fileInput.click());

// Drag & drop
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  for (const f of e.dataTransfer.files) addFile(f);
});

// Also allow drop on whole page when workspace is active
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (workspace.classList.contains('active')) {
    for (const f of e.dataTransfer.files) addFile(f);
  }
});

// Quality slider
let debounceTimer;
qualitySlider.addEventListener('input', () => {
  state.quality = parseFloat(qualitySlider.value);
  qualityValue.textContent = Math.round(state.quality * 100) + '%';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => recompressAll(), 300);
});

// Image list actions (delegation)
imageList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  const entry = state.images.find(e => e.id === id);
  if (!entry) return;

  if (btn.classList.contains('download')) {
    downloadOne(entry);
  } else if (btn.classList.contains('remove')) {
    URL.revokeObjectURL(entry.originalUrl);
    URL.revokeObjectURL(entry.compressedUrl);
    state.images = state.images.filter(e => e.id !== id);
    renderAll();
    updateSummary();
    updateUI();
  }
});

// Toolbar buttons
$('#btn-add-more').addEventListener('click', () => fileInput.click());
$('#btn-download-all').addEventListener('click', downloadAll);
