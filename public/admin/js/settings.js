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
  // Stok es batu
  const iceStockVal = s.ice_stock ?? 0;
  document.getElementById('iceStock').value = iceStockVal;
  const iceBadge = document.getElementById('iceStockBadge');
  if (iceBadge) {
    iceBadge.textContent = iceStockVal <= 0 ? '🧊 Habis' : `🧊 ${iceStockVal} porsi`;
    iceBadge.style.background = iceStockVal <= 0 ? '#fee2e2' : '#d1fae5';
    iceBadge.style.color = iceStockVal <= 0 ? '#b91c1c' : '#065f46';
    iceBadge.style.borderColor = iceStockVal <= 0 ? '#fca5a5' : '#6ee7b7';
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
    ice_stock: parseInt(document.getElementById('iceStock').value, 10) || 0,
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

// ---------------------------------------------------------------------------
// --- Update dari GitHub ----------------------------------------------------
// ---------------------------------------------------------------------------

async function initUpdatePanel() {
  // Cek apakah user adalah owner
  try {
    const meRes = await fetch('/api/admin/me');
    if (!meRes.ok) return;
    const me = await meRes.json();
    if (me.role !== 'owner') return; // Hanya owner yang bisa update

    const panel = document.getElementById('updatePanel');
    if (panel) panel.style.display = 'block';

    // Load versi saat ini
    try {
      const checkRes = await fetch('/api/admin/update/check');
      if (checkRes.ok) {
        const data = await checkRes.json();
        const verText = document.getElementById('currentVersionText');
        if (verText) {
          verText.textContent = data.current_version === 'unknown'
            ? 'Belum diketahui'
            : data.current_version.slice(0, 7);
        }
      }
    } catch {
      // Tidak fatal — versi cuma tampilan
    }
  } catch {
    // Gagal cek role — sembunyikan panel
  }
}

async function checkUpdate() {
  const btn = document.getElementById('checkUpdateBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengecek...';

  try {
    const res = await fetch('/api/admin/update/check');
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Gagal mengecek pembaruan');
      return;
    }

    const infoPanel = document.getElementById('updateInfoPanel');
    const availableBox = document.getElementById('updateAvailableBox');
    const noUpdateBox = document.getElementById('noUpdateBox');
    const applyBtn = document.getElementById('applyUpdateBtn');
    const verText = document.getElementById('currentVersionText');

    infoPanel.style.display = 'block';

    // Update versi saat ini
    if (verText) {
      verText.textContent = data.current_version === 'unknown'
        ? 'Belum diketahui'
        : data.current_version.slice(0, 7);
    }

    if (data.has_update) {
      availableBox.style.display = 'block';
      noUpdateBox.style.display = 'none';
      applyBtn.disabled = false;
      applyBtn.style.display = 'block';

      document.getElementById('latestShaText').textContent = data.latest_sha.slice(0, 7);
      document.getElementById('latestMessageText').textContent = data.latest_message.split('\n')[0]; // Hanya baris pertama commit message
      document.getElementById('latestDateText').textContent = data.latest_date
        ? new Date(data.latest_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
        : '-';
    } else {
      availableBox.style.display = 'none';
      noUpdateBox.style.display = 'block';
      applyBtn.disabled = true;
      applyBtn.style.display = 'none';
    }
  } catch (err) {
    alert('Gagal mengecek pembaruan: ' + (err.message || 'Network error'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Cek Pembaruan';
  }
}

async function applyUpdate() {
  if (!confirm('Yakin ingin menginstal pembaruan?\n\nServer akan restart otomatis setelah update selesai. Pesanan yang sedang berjalan tidak akan terpengaruh — database dan data upload tetap aman.')) {
    return;
  }

  const applyBtn = document.getElementById('applyUpdateBtn');
  const progressPanel = document.getElementById('updateProgressPanel');
  const progressText = document.getElementById('updateProgressText');

  applyBtn.disabled = true;
  applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menginstal...';
  progressPanel.style.display = 'block';
  progressText.textContent = 'Mengunduh pembaruan dari GitHub...';

  try {
    const res = await fetch('/api/admin/update/apply', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Gagal menginstal pembaruan');
      progressPanel.style.display = 'none';
      applyBtn.disabled = false;
      applyBtn.innerHTML = '<i class="fa-solid fa-download"></i> Instal Pembaruan';
      return;
    }

    // Update berhasil — server akan restart
    progressText.textContent = 'Update berhasil! Server sedang restart...';
    applyBtn.style.display = 'none';

    // Countdown & auto-reload setelah server restart
    let countdown = 8;
    const interval = setInterval(() => {
      countdown--;
      progressText.textContent = `Update berhasil! Halaman akan dimuat ulang dalam ${countdown} detik...`;
      if (countdown <= 0) {
        clearInterval(interval);
        progressText.textContent = 'Memuat ulang halaman...';
        // Coba reload — kalau server belum siap, coba lagi
        tryReload(0);
      }
    }, 1000);

  } catch (err) {
    // Network error bisa terjadi karena server restart — ini normal
    progressText.textContent = 'Server sedang restart... Halaman akan dimuat ulang...';
    applyBtn.style.display = 'none';
    setTimeout(() => tryReload(0), 5000);
  }
}

function tryReload(attempt) {
  if (attempt > 10) {
    document.getElementById('updateProgressText').textContent =
      'Server belum siap. Silakan muat ulang halaman secara manual.';
    return;
  }
  fetch('/api/admin/me')
    .then(res => {
      if (res.ok) {
        window.location.reload();
      } else {
        setTimeout(() => tryReload(attempt + 1), 2000);
      }
    })
    .catch(() => {
      setTimeout(() => tryReload(attempt + 1), 2000);
    });
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  await loadSettings();
  await initUpdatePanel();
})();
