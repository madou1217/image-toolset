/**
 * Format Convert Tool
 * 使用 Canvas API 实现图片格式转换
 */

const $ = (s) => document.querySelector(s);

const FORMATS = {
  png:  { mime: 'image/png',  ext: 'png',  label: 'PNG',  hasQuality: false },
  jpeg: { mime: 'image/jpeg', ext: 'jpg',  label: 'JPG',  hasQuality: true  },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', hasQuality: true  },
};

const state = {
  files: [],        // { id, file, fileName, img, originalUrl, convertedBlob, convertedUrl, convertedSize }
  targetFormat: 'png',
  quality: 0.9,
  nextId: 0,
};

/* ─── DOM ─── */
const uploadArea   = $('#upload-area');
const workspace    = $('#workspace');
const fileInput    = $('#file-input');
const fileList     = $('#file-list');
const qualityGroup = $('#quality-group');
const qualitySlider = $('#quality-slider');
const qualityValue  = $('#quality-value');
const summaryCount  = $('#summary-count');
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

function getOriginalFormat(fileName) {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  if (ext === 'webp') return 'webp';
  return 'png';
}

/* ─── Convert single image ─── */
function convertImage(imgEl, format, quality) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext('2d');

    // For JPEG: fill white background (no transparency)
    if (format.mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(imgEl, 0, 0);

    canvas.toBlob((blob) => {
      resolve({ blob, url: URL.createObjectURL(blob) });
    }, format.mime, format.hasQuality ? quality : undefined);
  });
}

/* ─── Add file ─── */
async function addFile(file) {
  if (!file.type.startsWith('image/')) return;
  const img = new Image();
  const originalUrl = URL.createObjectURL(file);
  await new Promise(r => { img.onload = r; img.src = originalUrl; });

  const format = FORMATS[state.targetFormat];
  const { blob, url } = await convertImage(img, format, state.quality);

  state.files.push({
    id: state.nextId++,
    file, fileName: file.name, img, originalUrl,
    originalFormat: getOriginalFormat(file.name),
    convertedBlob: blob, convertedUrl: url, convertedSize: blob.size,
  });

  renderAll();
  updateUI();
}

/* ─── Re-convert all ─── */
async function reconvertAll() {
  const format = FORMATS[state.targetFormat];
  for (const entry of state.files) {
    URL.revokeObjectURL(entry.convertedUrl);
    const { blob, url } = await convertImage(entry.img, format, state.quality);
    entry.convertedBlob = blob;
    entry.convertedUrl = url;
    entry.convertedSize = blob.size;
  }
  renderAll();
}

/* ─── Render ─── */
function renderAll() {
  const format = FORMATS[state.targetFormat];
  fileList.innerHTML = '';

  for (const entry of state.files) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <img class="thumb" src="${entry.originalUrl}" alt="">
      <div class="file-info">
        <div class="file-name" title="${entry.fileName}">${entry.fileName}</div>
        <div class="file-meta">
          <span>${entry.originalFormat.toUpperCase()}</span>
          <span class="arrow">→</span>
          <span class="new-format">${format.label}</span>
          <span>·</span>
          <span>${formatSize(entry.file.size)}</span>
          <span class="arrow">→</span>
          <span class="new-size">${formatSize(entry.convertedSize)}</span>
        </div>
      </div>
      <div class="file-actions">
        <button class="download" data-id="${entry.id}">下载</button>
        <button class="remove" data-id="${entry.id}">移除</button>
      </div>
    `;
    fileList.appendChild(item);
  }

  summaryCount.textContent = state.files.length;
}

function updateUI() {
  const format = FORMATS[state.targetFormat];
  if (state.files.length > 0) {
    uploadArea.classList.add('hidden');
    workspace.classList.add('active');
  } else {
    uploadArea.classList.remove('hidden');
    workspace.classList.remove('active');
  }
  // Show/hide quality slider
  qualityGroup.style.display = format.hasQuality ? 'flex' : 'none';
}

/* ─── Downloads ─── */
function downloadOne(entry) {
  const format = FORMATS[state.targetFormat];
  const baseName = entry.fileName.replace(/\.[^.]+$/, '');
  const a = document.createElement('a');
  a.href = entry.convertedUrl;
  a.download = `${baseName}.${format.ext}`;
  a.click();
}

function downloadAll() {
  if (state.files.length === 0) return;
  for (const entry of state.files) downloadOne(entry);
  showToast(`已导出 ${state.files.length} 张图片`);
}

/* ─── Events ─── */
// File input
fileInput.addEventListener('change', (e) => {
  for (const f of e.target.files) addFile(f);
  fileInput.value = '';
});

// Upload
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  for (const f of e.dataTransfer.files) addFile(f);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (workspace.classList.contains('active')) {
    for (const f of e.dataTransfer.files) addFile(f);
  }
});

// Format buttons
document.querySelectorAll('.format-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.targetFormat = btn.dataset.format;
    updateUI();
    reconvertAll();
  });
});

// Quality
let debounceTimer;
qualitySlider.addEventListener('input', () => {
  state.quality = parseFloat(qualitySlider.value);
  qualityValue.textContent = Math.round(state.quality * 100) + '%';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => reconvertAll(), 300);
});

// File list actions
fileList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  const entry = state.files.find(e => e.id === id);
  if (!entry) return;

  if (btn.classList.contains('download')) {
    downloadOne(entry);
  } else if (btn.classList.contains('remove')) {
    URL.revokeObjectURL(entry.originalUrl);
    URL.revokeObjectURL(entry.convertedUrl);
    state.files = state.files.filter(e => e.id !== id);
    renderAll();
    updateUI();
  }
});

// Toolbar
$('#btn-add-more').addEventListener('click', () => fileInput.click());
$('#btn-download-all').addEventListener('click', downloadAll);
