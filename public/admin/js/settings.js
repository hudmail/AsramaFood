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
  await initPasswordPanel();
})();

// ---------------------------------------------------------------------------
// --- Ubah Password & Kelola Akun ------------------------------------------
// ---------------------------------------------------------------------------

let _resetTargetId = null;

async function initPasswordPanel() {
  // Tampilkan username yang sedang login di panel Ubah Password
  try {
    const res = await fetch('/api/admin/me');
    if (!res.ok) return;
    const me = await res.json();
    const label = document.getElementById('currentUsernameLabel');
    if (label) {
      label.textContent = me.username + (me.role === 'owner' ? ' (Owner)' : ' (Kasir)');
    }

    // Panel Kelola Akun hanya untuk owner
    if (me.role === 'owner') {
      const panel = document.getElementById('manageAccountsPanel');
      if (panel) panel.style.display = 'block';
      await loadAdminUsers();
    }
  } catch {
    // Gagal load info akun — tidak fatal
  }

  // Strength indicator untuk password baru
  const newPwInput = document.getElementById('newPassword');
  if (newPwInput) {
    newPwInput.addEventListener('input', () => {
      updatePasswordStrength(newPwInput.value);
    });
  }

  // Validasi konfirmasi password secara live
  const confirmInput = document.getElementById('confirmPassword');
  if (confirmInput && newPwInput) {
    const checkMatch = () => {
      const msg = document.getElementById('confirmPasswordMsg');
      if (!msg || !confirmInput.value) { if (msg) msg.textContent = ''; return; }
      const match = confirmInput.value === newPwInput.value;
      msg.textContent = match ? '✓ Password cocok' : '✗ Password tidak cocok';
      msg.style.color = match ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
    };
    confirmInput.addEventListener('input', checkMatch);
    newPwInput.addEventListener('input', checkMatch);
  }
}

function updatePasswordStrength(password) {
  const bar = document.getElementById('pwStrengthBar');
  const fill = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  if (!bar || !fill || !label) return;

  if (!password) {
    bar.style.display = 'none';
    label.style.display = 'none';
    return;
  }

  bar.style.display = 'block';
  label.style.display = 'block';

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { pct: '20%', color: '#ef4444', text: 'Lemah' },
    { pct: '40%', color: '#f97316', text: 'Kurang kuat' },
    { pct: '60%', color: '#eab308', text: 'Cukup' },
    { pct: '80%', color: '#22c55e', text: 'Kuat' },
    { pct: '100%', color: '#16a34a', text: '💪 Sangat kuat' },
  ];
  const lvl = levels[Math.min(score - 1, 4)] || levels[0];
  fill.style.width = lvl.pct;
  fill.style.background = lvl.color;
  label.textContent = lvl.text;
  label.style.color = lvl.color;
}

// Tampilkan/sembunyikan teks password
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
    btn.title = 'Sembunyikan password';
  } else {
    input.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    btn.title = 'Tampilkan password';
  }
}

async function changePassword(event) {
  event.preventDefault();
  const currentPw = document.getElementById('currentPassword').value;
  const newPw = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;

  if (newPw !== confirmPw) {
    showSettingsToast('Konfirmasi password tidak cocok', 'error');
    return;
  }
  if (newPw.length < 8) {
    showSettingsToast('Password baru minimal 8 karakter', 'error');
    return;
  }

  const btn = document.getElementById('changePasswordBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('changePasswordForm').reset();
      // Reset strength indicator
      const bar = document.getElementById('pwStrengthBar');
      const label = document.getElementById('pwStrengthLabel');
      const confirm = document.getElementById('confirmPasswordMsg');
      if (bar) bar.style.display = 'none';
      if (label) label.style.display = 'none';
      if (confirm) confirm.textContent = '';
      showSettingsToast('Password berhasil diubah! Gunakan password baru untuk login berikutnya.', 'success');
    } else {
      showSettingsToast(data.error || 'Gagal mengubah password', 'error');
    }
  } catch {
    showSettingsToast('Gagal menghubungi server', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/admin-users');
    if (!res.ok) return;
    const users = await res.json();
    const list = document.getElementById('adminUserList');
    if (!list) return;

    list.innerHTML = users.map(u => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem;
        padding:0.85rem 1rem; background:var(--bg-body); border-radius:var(--radius-sm);
        border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--primary-light);
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fa-solid fa-user" style="color:var(--primary);font-size:0.75rem;"></i>
          </div>
          <div>
            <div style="font-weight:700;font-size:0.92rem;">${escapeHtml(u.username)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${u.role === 'owner' ? 'Owner' : 'Kasir'}</div>
          </div>
        </div>
        ${u.role !== 'owner' ? `
          <button class="btn secondary" onclick="showResetPasswordForm(${u.id}, '${escapeHtml(u.username)}')"
            style="font-size:0.78rem; padding:0.4rem 0.75rem; width:auto;">
            <i class="fa-solid fa-key"></i> Reset
          </button>
        ` : `<span style="font-size:0.75rem;color:var(--text-muted);padding:0.4rem 0.75rem;">Akun Anda</span>`}
      </div>
    `).join('');
  } catch {
    // Tidak fatal
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function showResetPasswordForm(userId, username) {
  _resetTargetId = userId;
  const nameEl = document.getElementById('resetTargetName');
  const panel = document.getElementById('resetPasswordPanel');
  const input = document.getElementById('resetNewPassword');
  if (nameEl) nameEl.textContent = username;
  if (panel) panel.style.display = 'block';
  if (input) { input.value = ''; input.focus(); }
}

function cancelResetPassword() {
  _resetTargetId = null;
  const panel = document.getElementById('resetPasswordPanel');
  if (panel) panel.style.display = 'none';
}

async function doResetPassword() {
  if (!_resetTargetId) return;
  const newPw = document.getElementById('resetNewPassword').value.trim();
  if (!newPw) { showSettingsToast('Isi password baru terlebih dahulu', 'error'); return; }
  if (newPw.length < 8) { showSettingsToast('Password minimal 8 karakter', 'error'); return; }

  const btn = document.getElementById('doResetPasswordBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mereset...';

  try {
    const res = await fetch(`/api/admin/admin-users/${_resetTargetId}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      cancelResetPassword();
      showSettingsToast(`Password akun berhasil direset`, 'success');
    } else {
      showSettingsToast(data.error || 'Gagal mereset password', 'error');
    }
  } catch {
    showSettingsToast('Gagal menghubungi server', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ---------------------------------------------------------------------------
// --- Toast notification untuk halaman settings ----------------------------
// ---------------------------------------------------------------------------
let _settingsToastTimer;
function showSettingsToast(msg, type = 'info') {
  let toast = document.getElementById('settings-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'right:1.5rem', 'z-index:9999',
      'padding:0.85rem 1.25rem', 'border-radius:var(--radius-md,10px)',
      'font-size:0.92rem', 'font-weight:600', 'display:flex',
      'align-items:center', 'gap:0.6rem', 'max-width:400px',
      'box-shadow:0 8px 30px rgba(0,0,0,0.18)',
      'transform:translateY(120%)', 'transition:transform 0.28s cubic-bezier(.4,0,.2,1)',
      'color:#fff',
    ].join(';');
    document.body.appendChild(toast);
  }
  const colors = { info: '#6366f1', success: '#16a34a', error: '#dc2626', warning: '#d97706' };
  const icons  = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
  toast.style.background = colors[type] || colors.info;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHtml(msg)}`;
  toast.style.transform = 'translateY(0)';
  clearTimeout(_settingsToastTimer);
  _settingsToastTimer = setTimeout(() => { toast.style.transform = 'translateY(120%)'; }, 4000);
}
