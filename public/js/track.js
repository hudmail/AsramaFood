const STATUS_LABEL = {
  pending: 'Menunggu Konfirmasi',
  diproses: 'Sedang Disiapkan',
  siap: 'Siap',
  diantar: 'Dalam Perjalanan',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

let currentOrder = null;
let qrisImage = '';
let pendingProofDataUri = null;

async function loadSettings() {
  try {
    const res = await fetch('/api/settings/public');
    const s = await res.json();
    qrisImage = s.qris_image || '';
    
    const storeName = s.store_name || 'AsramaFood';
    const brandEl = document.getElementById('brand-name');
    if (brandEl) brandEl.textContent = storeName;
    document.title = `Lacak Pesanan - ${storeName}`;
  } catch (e) {
    qrisImage = '';
  }
}

function money(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code') || '';
}

function showToast(message) {
  // Try to use toast message if available on track page
  const toast = document.getElementById('toast-message');
  if (toast) {
    const toastText = document.getElementById('toast-text');
    if(toastText) toastText.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  } else {
    alert(message);
  }
}

document.getElementById('codeInput').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') track();
});

async function track() {
  const code = (document.getElementById('codeInput').value || getCodeFromUrl()).trim().toUpperCase();
  if (!code) {
    showToast("Silakan masukkan kode pesanan!");
    document.getElementById('codeInput').focus();
    return;
  }
  document.getElementById('codeInput').value = code;

  const resultCard = document.getElementById('resultCard');
  const loader = document.getElementById('loadingSpinner');

  resultCard.style.display = 'none';
  loader.style.display = 'block';

  try {
    if (!qrisImage) await loadSettings();
    const res = await fetch('/api/orders/' + encodeURIComponent(code));
    const order = await res.json();
    loader.style.display = 'none';
    if (!res.ok) throw new Error(order.error || 'Pesanan tidak ditemukan');
    currentOrder = order;
    renderOrder(order);
  } catch (err) {
    loader.style.display = 'none';
    resultCard.innerHTML = `
        <div class="empty-state compact">
<<<<<<< HEAD
            <i aria-hidden="true" class="fa-solid fa-circle-exclamation"></i>
=======
            <i class="fa-solid fa-circle-exclamation"></i>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
            <p>${escapeHtml(err.message)}</p>
        </div>
    `;
    resultCard.style.display = 'block';
  }
}

function renderOrder(order) {
  const resultCard = document.getElementById('resultCard');
  
  if (order.status === 'dibatalkan') {
    resultCard.innerHTML = `
        <div class="empty-state compact" style="border-color: var(--danger);">
<<<<<<< HEAD
            <i aria-hidden="true" class="fa-solid fa-ban" style="color: var(--danger);"></i>
=======
            <i class="fa-solid fa-ban" style="color: var(--danger);"></i>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
            <h3 style="color: var(--danger);">Pesanan Dibatalkan</h3>
            <p>Pesanan dengan kode ${order.order_code} telah dibatalkan.</p>
        </div>
    `;
    resultCard.style.display = 'block';
    return;
  }

  const isCOD = order.payment_method === 'cod';
  const methodText = order.method === 'antar' ? 'Diantar ke kamar' : 'Ambil sendiri';
  const isDelivery = order.method === 'antar';
  
  // Format Date
  const dateObj = new Date(order.created_at + 'Z');
  const timeString = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const dateString = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  // Generate Payment HTML
  let paymentHtml = '';
  if (order.payment_status === 'menunggu_pembayaran' || order.payment_status === 'ditolak') {
      if (isCOD) {
          paymentHtml = `
              <div class="payment-box">
<<<<<<< HEAD
                  <h3><i aria-hidden="true" class="fa-solid fa-hand-holding-dollar" style="color: var(--secondary);"></i> Bayar di Tempat (COD)</h3>
=======
                  <h3><i class="fa-solid fa-hand-holding-dollar" style="color: var(--secondary);"></i> Bayar di Tempat (COD)</h3>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
                  <div class="payment-amount" style="color: var(--primary);">${money(order.total)}</div>
                  <p style="font-size: 0.85rem; color: var(--text-muted);">${isDelivery ? 'Siapkan uang pas saat pesanan diantar ke kamarmu.' : 'Siapkan uang pas saat mengambil pesanan.'}</p>
              </div>
          `;
      } else {
          paymentHtml = `
              <div class="payment-box">
<<<<<<< HEAD
                  <h3 style="color: var(--accent);"><i aria-hidden="true" class="fa-solid fa-circle-exclamation"></i> Menunggu Pembayaran QRIS</h3>
=======
                  <h3 style="color: var(--accent);"><i class="fa-solid fa-circle-exclamation"></i> Menunggu Pembayaran QRIS</h3>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
                  <div class="payment-amount">${money(order.total)}</div>
                  ${order.payment_status === 'ditolak' ? `<p style="font-size: 0.85rem; color: var(--danger); margin-bottom: 0.5rem;">Bukti transfer sebelumnya ditolak. Silakan upload bukti yang benar.</p>` : ''}
                  ${qrisImage ? `<img src="${qrisImage}" style="max-width:200px; display:block; margin:0 auto 1rem; border:1px solid var(--border-color); border-radius:12px; padding:8px; background:#fff">` : ''}
                  <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Silakan scan QRIS di atas lalu upload bukti transfer jika sudah membayar.</p>
<<<<<<< HEAD
                  <button class="btn secondary" onclick="openProofUpload()"><i aria-hidden="true" class="fa-solid fa-upload"></i> Upload Bukti Transfer</button>
=======
                  <button class="btn secondary" onclick="openProofUpload()"><i class="fa-solid fa-upload"></i> Upload Bukti Transfer</button>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
              </div>
          `;
      }
  } else if (order.payment_status === 'menunggu_konfirmasi') {
      paymentHtml = `
          <div class="payment-box" style="border-color: var(--primary-light);">
<<<<<<< HEAD
              <h3 style="color: var(--primary);"><i aria-hidden="true" class="fa-solid fa-clock"></i> Bukti Sedang Dicek</h3>
=======
              <h3 style="color: var(--primary);"><i class="fa-solid fa-clock"></i> Bukti Sedang Dicek</h3>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Admin sedang memverifikasi pembayaran kamu. Mohon tunggu sebentar.</p>
              ${order.payment_proof ? `<img src="${order.payment_proof}" style="max-width:160px; border-radius:10px; border:1px solid var(--border-color);">` : ''}
          </div>
      `;
  } else if (order.payment_status === 'dibayar') {
      paymentHtml = `
          <div class="payment-box" style="border-color: var(--success); background: rgba(16, 185, 129, 0.05);">
<<<<<<< HEAD
              <h3 style="color: var(--success);"><i aria-hidden="true" class="fa-solid fa-check-double"></i> Pembayaran Lunas</h3>
=======
              <h3 style="color: var(--success);"><i class="fa-solid fa-check-double"></i> Pembayaran Lunas</h3>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
              <p style="font-size: 0.85rem; color: var(--text-muted);">Terima kasih telah memesan di AsramaFood!</p>
          </div>
      `;
  }

  // Generate Timeline HTML
<<<<<<< HEAD
  const steps = isDelivery 
      ? ['pending', 'diproses', 'siap', 'diantar', 'selesai']
      : ['pending', 'diproses', 'siap', 'selesai'];
      
=======
  const finalStep = isDelivery ? 'diantar' : 'selesai';
  const steps = ['pending', 'diproses', 'siap', finalStep];
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
  const stepTitles = {
      pending: 'Pesanan Diterima',
      diproses: 'Sedang Disiapkan',
      siap: 'Siap',
      diantar: 'Menuju Kamar',
      selesai: 'Selesai'
  };
  const stepDescs = {
      pending: 'Pesanan telah diterima dan menunggu konfirmasi.',
      diproses: 'Makanan sedang disiapkan hangat-hangat.',
      siap: isDelivery ? 'Pesanan siap untuk diantar.' : 'Pesanan sudah bisa diambil.',
      diantar: 'Kurir sedang dalam perjalanan ke kamarmu.',
      selesai: 'Pesanan telah selesai.'
  };

  let statusIndex = steps.indexOf(order.status);
<<<<<<< HEAD
=======
  if (statusIndex === -1 && order.status === 'selesai' && !isDelivery) {
    statusIndex = 3; // map 'selesai' to the final step if it was 'ambil'
  }
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce

  const getStepClass = (stepIndex) => {
      if (statusIndex > stepIndex) return 'timeline-step completed';
      if (statusIndex === stepIndex) return 'timeline-step active';
      return 'timeline-step';
  };

  let timelineHtml = '<div class="timeline">';
  steps.forEach((step, idx) => {
      timelineHtml += `
          <div class="${getStepClass(idx)}">
              <div class="step-title">${stepTitles[step]}</div>
              <div class="step-desc">${stepDescs[step]}</div>
          </div>
      `;
  });
  timelineHtml += '</div>';

  // Format Items
  const itemsHtml = order.items.map((it) => `
      <div style="display:flex; justify-content:space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
          <div><strong style="color: var(--text-title);">${escapeHtml(it.name_snapshot)}</strong> <span style="color: var(--text-muted);">x${it.qty}</span></div>
          <div>${money(it.subtotal)}</div>
      </div>
  `).join('');

  resultCard.innerHTML = `
      <div class="order-header">
          <div>
              <div class="order-id">${order.order_code}</div>
              <div class="order-time">${dateString}, ${timeString}</div>
          </div>
          <span class="order-status-badge">${STATUS_LABEL[order.status] || order.status}</span>
      </div>
      
      <div class="order-details" style="font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.6;">
          <div style="display:flex; justify-content:space-between;">
              <span style="color: var(--text-muted);">Pemesan:</span>
              <strong style="color: var(--text-title);">${escapeHtml(order.customer_name)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
              <span style="color: var(--text-muted);">Tujuan:</span>
              <strong style="color: var(--text-title);">${escapeHtml(order.room)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top: 0.5rem;">
              <span style="color: var(--text-muted);">Pengambilan:</span>
              <strong style="color: var(--text-title);">${methodText}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
              <span style="color: var(--text-muted);">Pembayaran:</span>
              <strong style="color: var(--text-title);">${isCOD ? 'Cash on Delivery (COD)' : 'QRIS / Transfer'}</strong>
          </div>
          ${order.note ? `
          <div style="display:flex; flex-direction:column; margin-top: 0.5rem;">
              <span style="color: var(--text-muted);">Catatan:</span>
              <strong style="color: var(--text-title);">${escapeHtml(order.note)}</strong>
          </div>
          ` : ''}
      </div>

      <div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--text-title);">Rincian Pesanan</div>
      <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
          ${itemsHtml}
          <div style="border-top: 1px dashed var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem;">
              <div style="display:flex; justify-content:space-between; font-size: 0.85rem;">
                  <span style="color: var(--text-muted);">Subtotal</span>
                  <span>${money(order.subtotal)}</span>
              </div>
              ${order.delivery_fee ? `
              <div style="display:flex; justify-content:space-between; font-size: 0.85rem;">
                  <span style="color: var(--text-muted);">Ongkir</span>
                  <span>${money(order.delivery_fee)}</span>
              </div>
              ` : ''}
              <div style="display:flex; justify-content:space-between; font-weight: 700; font-size: 1rem; margin-top: 0.25rem;">
                  <span style="color: var(--text-title);">Total</span>
                  <span style="color: var(--primary);">${money(order.total)}</span>
              </div>
          </div>
      </div>

      <div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--text-title);">Status Perjalanan</div>
      ${timelineHtml}

      ${paymentHtml}
  `;

  resultCard.style.display = 'block';
}

function openProofUpload() {
  document.getElementById('proofOverlay').classList.add('open');
}

function closeProofUpload() {
  document.getElementById('proofOverlay').classList.remove('open');
  pendingProofDataUri = null;
  document.getElementById('proofPreviewWrap').style.display = 'none';
  document.getElementById('proofFile').value = '';
}

function previewProof(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 4MB');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingProofDataUri = reader.result;
    document.getElementById('proofPreview').src = pendingProofDataUri;
    document.getElementById('proofPreviewWrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitProof() {
  if (!pendingProofDataUri || !currentOrder) {
    showToast('Pilih foto bukti transfer dulu');
    return;
  }
  const btn = document.getElementById('uploadProofBtn');
  const originalText = btn.innerHTML;
<<<<<<< HEAD
  btn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
  btn.disabled = true;

  try {
    const fileInput = document.getElementById('proofFile');
    const formData = new FormData();
    if (fileInput && fileInput.files[0]) {
      formData.append('proof_image', fileInput.files[0]);
    } else if (pendingProofDataUri) {
      formData.append('proof_image', pendingProofDataUri);
    }

    const res = await fetch(`/api/orders/${encodeURIComponent(currentOrder.order_code)}/bukti-bayar`, {
      method: 'POST',
      body: formData,
=======
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(currentOrder.order_code)}/bukti-bayar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_image: pendingProofDataUri }),
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti transfer');
    
    closeProofUpload();
    showToast('Bukti berhasil dikirim!');
    track(); // Refresh the data
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

const initialCode = getCodeFromUrl();
if (initialCode) {
  document.getElementById('codeInput').value = initialCode;
  track();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!initialCode) {
    loadSettings();
  }
});
