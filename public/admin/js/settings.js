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
  document.getElementById('eggPrice').value = s.egg_price ?? 3000;
  document.getElementById('drinkColdPrice').value = s.drink_temp_cold_price ?? 1000;
  // Stok telur
  const eggStockVal = s.egg_stock ?? 0;
  document.getElementById('eggStock').value = eggStockVal;
  const badge = document.getElementById('eggStockBadge');
  if (badge) {
    badge.textContent = eggStockVal <= 0 ? '🥚 Habis' : `🥚 ${eggStockVal} butir`;
    badge.style.background = eggStockVal <= 0 ? '#fee2e2' : '#d1fae5';
    badge.style.color = eggStockVal <= 0 ? '#b91c1c' : '#065f46';
    badge.style.borderColor = eggStockVal <= 0 ? '#fca5a5' : '#6ee7b7';
  }
  // Jadwal otomatis
  document.getElementById('autoSchedule').checked = !!s.auto_schedule;
  document.getElementById('scheduleOpen').value = s.schedule_open || '07:00';
  document.getElementById('scheduleClose').value = s.schedule_close || '21:00';
  toggleScheduleUI();

  if (s.qris_image) {
    document.getElementById('qrisPreview').src = s.qris_image;
    document.getElementById('qrisPreviewWrap').style.display = 'block';
  }
}

function toggleScheduleUI() {
  const auto = document.getElementById('autoSchedule').checked;
  document.getElementById('schedulePanel').style.display = auto ? 'block' : 'none';
  document.getElementById('manualOpenPanel').style.display = auto ? 'none' : 'flex';
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
  const fileInput = document.getElementById('qrisFile');
  const formData = new FormData();

  if (fileInput && fileInput.files[0]) {
    formData.append('qris_image', fileInput.files[0]);
  } else if (pendingQrisDataUri) {
    formData.append('qris_image', pendingQrisDataUri);
  } else {
    alert('Pilih gambar QRIS dulu');
    return;
  }

  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    body: formData,
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
    egg_price: parseInt(document.getElementById('eggPrice').value, 10) || 0,
    drink_temp_cold_price: parseInt(document.getElementById('drinkColdPrice').value, 10) || 0,
    egg_stock: parseInt(document.getElementById('eggStock').value, 10) || 0,
    auto_schedule: document.getElementById('autoSchedule').checked,
    schedule_open: document.getElementById('scheduleOpen').value || '07:00',
    schedule_close: document.getElementById('scheduleClose').value || '21:00',
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
