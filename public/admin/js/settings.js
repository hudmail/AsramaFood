async function requireLogin() {
  const res = await fetch('/api/admin/me');
  if (!res.ok) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}
function logout() {
  fetch('/api/admin/logout', { method: 'POST' }).then(() => (window.location.href = '/admin/login.html'));
}

async function loadSettings() {
  const res = await fetch('/api/admin/settings');
  const s = await res.json();
  document.getElementById('storeName').value = s.store_name || '';
  document.getElementById('isOpen').checked = !!s.is_open;
  document.getElementById('openHours').value = s.open_hours || '';
  document.getElementById('deliveryFee').value = s.delivery_fee || 0;
  document.getElementById('availableBuildings').value = s.available_buildings || 'Gedung 2';
  document.getElementById('allowQris').checked = !!s.allow_qris;
  document.getElementById('allowCod').checked = !!s.allow_cod;
  if (s.qris_image) {
    document.getElementById('qrisPreview').src = s.qris_image;
    document.getElementById('qrisPreviewWrap').style.display = 'block';
  }
}

let pendingQrisDataUri = null;

function previewQris(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 4MB');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingQrisDataUri = reader.result;
    document.getElementById('qrisPreview').src = pendingQrisDataUri;
    document.getElementById('qrisPreviewWrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function saveQris() {
  if (!pendingQrisDataUri) {
    alert('Pilih gambar QRIS dulu');
    return;
  }
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qris_image: pendingQrisDataUri }),
  });
  if (res.ok) {
    alert('QRIS tersimpan');
  } else {
    const data = await res.json();
    alert(data.error || 'Gagal menyimpan QRIS');
  }
}

async function saveSettings() {
  const payload = {
    store_name: document.getElementById('storeName').value.trim(),
    is_open: document.getElementById('isOpen').checked,
    open_hours: document.getElementById('openHours').value.trim(),
    delivery_fee: parseInt(document.getElementById('deliveryFee').value, 10) || 0,
    available_buildings: document.getElementById('availableBuildings').value.trim() || 'Gedung 2',
    allow_qris: document.getElementById('allowQris').checked,
    allow_cod: document.getElementById('allowCod').checked,
  };
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    alert('Pengaturan tersimpan');
  } else {
    alert('Gagal menyimpan pengaturan');
  }
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  await loadSettings();
})();
