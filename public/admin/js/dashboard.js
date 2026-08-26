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
<<<<<<< HEAD
  diantar: 'selesai',
=======
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
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
<<<<<<< HEAD
            <button class="btn-icon-small" onclick="viewOrder(${o.id})" title="Lihat Detail"><i aria-hidden="true" class="fa-solid fa-eye"></i></button>
=======
            <button class="btn-icon-small" onclick="viewOrder(${o.id})" title="Lihat Detail"><i class="fa-solid fa-eye"></i></button>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
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
<<<<<<< HEAD
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
=======
    paymentActions = `<button class="btn" style="width:auto; font-size:0.85rem; background:var(--primary-light); color:var(--text-title)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i class="fa-solid fa-money-bill"></i> Tandai COD Dibayar</button>`;
  } else if (o.payment_status === 'menunggu_konfirmasi') {
    paymentActions = `
      ${o.payment_proof ? `<button class="btn secondary" style="width:auto; font-size:0.85rem;" onclick="viewProof(${o.id})"><i class="fa-solid fa-receipt"></i> Lihat Bukti</button>` : ''}
      <button class="btn" style="width:auto; font-size:0.85rem; background:var(--success)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i class="fa-solid fa-check"></i> Konfirmasi Bayar</button>
      <button class="btn danger" style="width:auto; font-size:0.85rem;" onclick="updatePaymentStatus(${o.id}, 'ditolak')"><i class="fa-solid fa-xmark"></i> Tolak Bukti</button>
    `;
  } else if (o.payment_status === 'menunggu_pembayaran') {
    paymentActions = `<button class="btn" style="width:auto; font-size:0.85rem; background:var(--success)" onclick="updatePaymentStatus(${o.id}, 'dibayar')"><i class="fa-solid fa-check"></i> Tandai Sudah Bayar</button>`;
  } else if (o.payment_status === 'dibayar' && o.payment_proof) {
    paymentActions = `<button class="btn secondary" style="width:auto; font-size:0.85rem;" onclick="viewProof(${o.id})"><i class="fa-solid fa-receipt"></i> Lihat Bukti</button>`;
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
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
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Gagal memperbarui status pembayaran');
  }
}

async function updateStatus(orderId, status) {
  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) {
    await loadOrders();
    await loadDashboard();
    closeOrderModal();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Gagal memperbarui status pesanan');
  }
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  renderFilterTabs();
  await loadDashboard();
  await loadOrders();
  pollTimer = setInterval(() => {
    loadDashboard();
    loadOrders();
  }, 15000);
})();
