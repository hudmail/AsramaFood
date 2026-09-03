const STATUS_LABEL = {
  pending: 'Menunggu',
  diproses: 'Diproses',
  siap: 'Siap',
  diantar: 'Diantar',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
const PAYMENT_LABEL = {
  menunggu_pembayaran: 'Belum Bayar',
  menunggu_konfirmasi: 'Cek Bukti Bayar',
  dibayar: 'Sudah Bayar',
  ditolak: 'Bukti Ditolak',
};

const NEXT_STATUS = {
  pending: 'diproses',
  diproses: 'siap',
  siap: null, // depends on method, resolved at render time
  diantar: 'selesai',
};

let activeFilter = '';
let pollTimer;

function money(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Toast notification — pengganti alert() yang tidak mengganggu
// ---------------------------------------------------------------------------
let _adminToastTimer;
function showAdminToast(msg, type = 'info') {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'right:1.5rem', 'z-index:9999',
      'padding:0.85rem 1.25rem', 'border-radius:var(--radius-md,10px)',
      'font-size:0.92rem', 'font-weight:600', 'display:flex',
      'align-items:center', 'gap:0.6rem', 'max-width:380px',
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
  clearTimeout(_adminToastTimer);
  _adminToastTimer = setTimeout(() => { toast.style.transform = 'translateY(120%)'; }, 3500);
}

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

async function loadDashboard() {
  const res = await fetch('/api/admin/dashboard');
  if (!res.ok) return;
  const d = await res.json();
  document.getElementById('statOrders').textContent = d.total_orders;
  document.getElementById('statRevenue').textContent = money(d.total_revenue);
  document.getElementById('statProfit').textContent = money(d.total_profit);
  document.getElementById('statPending').textContent = d.pending_orders;
  document.getElementById('statUnconfirmedPayments').textContent = d.unconfirmed_payments;
  document.getElementById('statLowStock').textContent = d.low_stock.length;
}

function renderFilterTabs() {
  const tabs = [
    ['', 'Semua'],
    ['pending', 'Menunggu'],
    ['diproses', 'Diproses'],
    ['siap', 'Siap'],
    ['diantar', 'Diantar'],
    ['selesai', 'Selesai'],
    ['dibatalkan', 'Dibatalkan'],
  ];
  const host = document.getElementById('filterTabs');
  host.innerHTML = '';
  tabs.forEach(([value, label]) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (activeFilter === value ? ' active' : '');
    chip.textContent = label;
    chip.onclick = () => {
      activeFilter = value;
      renderFilterTabs();
      loadOrders();
    };
    host.appendChild(chip);
  });
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (activeFilter) params.set('status', activeFilter);
  const res = await fetch('/api/admin/orders?' + params.toString());
  if (!res.ok) return;
  const orders = await res.json();
  renderOrders(orders);
}

function renderOrders(orders) {
  const host = document.getElementById('orderList');
  if (orders.length === 0) {
    host.innerHTML = `<tr><td colspan="6" style="text-align:center;"><div class="empty-state compact"><div class="icon" style="font-size:2rem;margin-bottom:0.5rem;">📭</div><p>Belum ada pesanan</p></div></td></tr>`;
    return;
  }
  host.innerHTML = orders
    .map((o) => {
      const paymentPillClass =
        o.payment_status === 'dibayar' ? 'success' : o.payment_status === 'ditolak' ? 'danger' : o.payment_status === 'menunggu_konfirmasi' ? 'process' : 'pending';
      const statusPillClass = o.status === 'selesai' || o.status === 'siap' || o.status === 'diantar' ? 'success' : o.status === 'dibatalkan' ? 'danger' : o.status === 'diproses' ? 'process' : 'pending';

      return `
      <tr>
        <td style="font-weight: 700; color: var(--primary);">${o.order_code}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-title);">${escapeHtml(o.customer_name)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(o.room)}</div>
          ${o.whatsapp ? `<div style="font-size: 0.8rem; color: var(--text-muted);">WA: ${escapeHtml(o.whatsapp)}</div>` : ''}
        </td>
        <td style="font-weight: 700;">${money(o.total)}</td>
        <td>
          <div style="font-size: 0.8rem; border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">${o.payment_method === 'cod' ? 'COD' : 'QRIS'}</div>
          <div><span class="badge ${paymentPillClass}" style="font-size:0.65rem;">${PAYMENT_LABEL[o.payment_status] || o.payment_status}</span></div>
        </td>
        <td><span class="badge ${statusPillClass}">${STATUS_LABEL[o.status]}</span></td>
        <td>
            <button class="btn-icon-small" onclick="viewOrder(${o.id})" title="Lihat Detail"><i aria-hidden="true" class="fa-solid fa-eye"></i></button>
        </td>
      </tr>`;
    })
    .join('');
  window.__ordersCache = orders;
}

async function viewOrder(id) {
  const cached = (window.__ordersCache || []).find((o) => o.id === id);
  if (!cached) return;

  // Daftar pesanan (GET /orders) tidak menyertakan rincian item, jadi ambil
  // detail lengkap (termasuk items) dari endpoint per-pesanan.
  let o = cached;
  try {
    const res = await fetch(`/api/admin/orders/${id}`);
    if (res.ok) o = await res.json();
  } catch (e) {
    // kalau gagal, tetap tampilkan modal pakai data cache (tanpa rincian item)
  }

  document.getElementById('detail-order-id').textContent = o.order_code;

  let itemsHtml = (o.items || []).map(i => `${i.qty}x ${escapeHtml(i.name_snapshot)}`).join('<br>');
  if(!itemsHtml) itemsHtml = '-'; // fallback for old orders without items

  document.getElementById('order-detail-content').innerHTML = `
      <div style="display: grid; grid-template-columns: 100px 1fr; gap: 0.5rem; margin-bottom: 1rem;">
          <strong style="color: var(--text-muted);">Pemesan:</strong> <span>${escapeHtml(o.customer_name)}</span>
          <strong style="color: var(--text-muted);">Lokasi:</strong> <span>${escapeHtml(o.room)} (${o.method === 'antar' ? 'Diantar' : 'Ambil'})</span>
          ${o.note ? `<strong style="color: var(--text-muted);">Catatan:</strong> <span>${escapeHtml(o.note)}</span>` : ''}
          <strong style="color: var(--text-muted);">Metode:</strong> <span>${o.payment_method === 'cod' ? 'COD' : 'QRIS'} - ${PAYMENT_LABEL[o.payment_status]}</span>
          <strong style="color: var(--text-muted);">Status:</strong> <span style="font-weight: 700; color: var(--primary);">${STATUS_LABEL[o.status]}</span>
      </div>
      <div style="background: var(--bg-body); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">Pesanan:</div>
          <div style="color: var(--text-body); line-height: 1.6;">${itemsHtml}</div>
          <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; color: var(--text-title);">
              <span>Total Tagihan:</span>
              <span style="color: var(--primary);">${money(o.total)}</span>
          </div>
      </div>
  `;

  const finalStep = o.method === 'antar' ? 'diantar' : 'selesai';
  let nextStatus = NEXT_STATUS[o.status];
  if (o.status === 'siap') nextStatus = finalStep;
  const canAdvance = nextStatus && o.status !== 'dibatalkan';
  const canCancel = !['selesai', 'dibatalkan'].includes(o.status);

  let paymentActions = '';
  if (o.payment_method === 'cod' && o.payment_status === 'menunggu_pembayaran') {
    paymentActions = `<button class="btn" style="width:auto; font-size:0.85rem; background:var(--primary-light); color:var(--text-title)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i aria-hidden="true" class="fa-solid fa-money-bill"></i> Tandai COD Dibayar</button>`;
  } else if (o.payment_status === 'menunggu_konfirmasi') {
    paymentActions = `
      ${o.payment_proof ? `<button class="btn secondary" style="width:auto; font-size:0.85rem;" onclick="viewProof(${o.id})"><i aria-hidden="true" class="fa-solid fa-receipt"></i> Lihat Bukti</button>` : ''}
      <button class="btn" style="width:auto; font-size:0.85rem; background:var(--success)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i aria-hidden="true" class="fa-solid fa-check"></i> Konfirmasi Bayar</button>
      <button class="btn danger" style="width:auto; font-size:0.85rem;" onclick="updatePaymentStatus(${o.id}, 'ditolak')"><i aria-hidden="true" class="fa-solid fa-xmark"></i> Tolak Bukti</button>
    `;
  } else if (o.payment_status === 'menunggu_pembayaran') {
    paymentActions = `<button class="btn" style="width:auto; font-size:0.85rem; background:var(--success)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i aria-hidden="true" class="fa-solid fa-check"></i> Tandai Sudah Bayar</button>`;
  } else if (o.payment_status === 'dibayar' && o.payment_proof) {
    paymentActions = `<button class="btn secondary" style="width:auto; font-size:0.85rem;" onclick="viewProof(${o.id})"><i aria-hidden="true" class="fa-solid fa-receipt"></i> Lihat Bukti</button>`;
  }

  const actionBtns = document.getElementById('order-action-buttons');
  actionBtns.innerHTML = `
      ${canAdvance ? `<button class="btn" style="width:auto; font-size:0.85rem;" onclick="updateStatus(${o.id}, '${nextStatus}')">Tandai ${STATUS_LABEL[nextStatus]}</button>` : ''}
      ${paymentActions}
      ${canCancel ? `<button class="btn danger" style="width:auto; font-size:0.85rem;" onclick="updateStatus(${o.id}, 'dibatalkan')">Batalkan Pesanan</button>` : ''}
  `;

  document.getElementById('order-modal').classList.add('open');
}

window.closeOrderModal = () => document.getElementById('order-modal').classList.remove('open');

function viewProof(orderId) {
  const order = (window.__ordersCache || []).find((o) => o.id === orderId);
  if (!order || !order.payment_proof) return;
  document.getElementById('proofViewImg').src = order.payment_proof;
  document.getElementById('proofViewOverlay').classList.add('open');
}
function closeProofView() {
  document.getElementById('proofViewOverlay').classList.remove('open');
}

async function updatePaymentStatus(orderId, paymentStatus) {
  const res = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_status: paymentStatus }),
  });
  if (res.ok) {
    await loadOrders();
    await loadDashboard();
    closeOrderModal();
    showAdminToast('Status pembayaran diperbarui', 'success');
  } else {
    const data = await res.json().catch(() => ({}));
    showAdminToast(data.error || 'Gagal memperbarui status pembayaran', 'error');
  }
}

async function updateStatus(orderId, status) {
  // Konfirmasi ekstra sebelum batalkan pesanan — tombol ini destruktif dan mudah dipencet tidak sengaja
  if (status === 'dibatalkan') {
    const ok = confirm('Yakin ingin membatalkan pesanan ini?\n\nStok menu akan dikembalikan secara otomatis.');
    if (!ok) return;
  }
  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) {
    await loadOrders();
    await loadDashboard();
    closeOrderModal();
    showAdminToast(`Status diperbarui: ${STATUS_LABEL[status] || status}`, 'success');
  } else {
    const data = await res.json().catch(() => ({}));
    showAdminToast(data.error || 'Gagal memperbarui status pesanan', 'error');
  }
}

// --- Push Notification (SSE & Web Audio) ---
let notifyEnabled = true;
const notifyAudio = new Audio('/admin/notification.mp3');

// Browser modern memblokir suara yang diputar tanpa interaksi user.
// Kita mencoba meload/memainkan audio sejenak secara diam-diam saat klik pertama 
// agar browser mengizinkan audio diputar otomatis ke depannya.
document.addEventListener('click', () => {
  notifyAudio.play().then(() => {
    notifyAudio.pause();
    notifyAudio.currentTime = 0;
  }).catch(e => {}); // catch harmless error if already unlocked
}, { once: true });

function playBeep() {
  if (!notifyEnabled) return;
  try {
    notifyAudio.currentTime = 0;
    notifyAudio.play().catch(e => {
      console.error("Gagal memutar notifikasi MP3. Pastikan sudah klik layar terlebih dahulu.", e);
    });
  } catch(e) {}
}

function showNativeNotification(title, body) {
  if (!notifyEnabled) return;
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });
  }
}

function initNotifications() {
  // Bind toggle button
  const toggleBtn = document.getElementById('notify-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      notifyEnabled = !notifyEnabled;
      if (notifyEnabled) {
        toggleBtn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-bell"></i>';
        toggleBtn.title = 'Notifikasi Suara: Nyala';
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        playBeep(); // Test suara saat dinyalakan
      } else {
        toggleBtn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-bell-slash"></i>';
        toggleBtn.title = 'Notifikasi Suara: Mati';
      }
    });
  }

  // SSE Connection
  const evtSource = new EventSource('/api/admin/events');
  evtSource.addEventListener('new_order', (e) => {
    try {
      const data = JSON.parse(e.data);
      playBeep();
      showNativeNotification('Pesanan Baru Masuk!', `Pesanan ${data.order_code} dari ${data.customer_name} (Rp ${Number(data.total).toLocaleString('id-ID')})`);
      
      // Auto refresh data
      loadDashboard();
      loadOrders();
    } catch(err) {
      console.error('SSE Error:', err);
    }
  });
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  renderFilterTabs();
  await loadDashboard();
  await loadOrders();
  initNotifications();
  
  // Karena sudah pakai SSE (real-time), polling hanya untuk backup setiap 30 detik
  pollTimer = setInterval(() => {
    loadDashboard();
    loadOrders();
  }, 30000);
})();
