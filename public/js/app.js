let allMenu = [];
let categories = [];
let cart = {};
let settings = { store_name: 'AsramaFood', is_open: true, delivery_fee: 0, open_hours: '', allow_qris: true, allow_cod: true, egg_price: 3000, drink_temp_cold_price: 1000 };
let state = {
  activeCategory: '', searchQuery: '', maxPriceFilter: 'all',
  location: JSON.parse(localStorage.getItem('af_location') || 'null') || { building: 'Gedung A' }
};

const $ = (id) => document.getElementById(id);
const money = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
function escapeHtml(str='') { const d=document.createElement('div'); d.textContent=String(str); return d.innerHTML; }
// Kalau menu sedang diskon (is_discount aktif & discount_price terisi), harga yang dipakai
// untuk keranjang & checkout adalah harga diskon, bukan harga normal.
function effectivePrice(item) { return item.is_discount && item.discount_price ? item.discount_price : item.price; }
function showToast(msg) { $('toast-text').textContent=msg; $('toast-message').classList.add('show'); setTimeout(()=>$('toast-message').classList.remove('show'),2400); }
function cartEntries(){ return Object.values(cart); }
function subtotal(){ return cartEntries().reduce((s,e)=>s+(effectivePrice(e.item)+addonPriceForEntry(e))*e.qty,0); }
function selectedPickup(){ return document.querySelector('input[name="pickup"]:checked')?.value || 'antar'; }
function selectedPayment(){ return document.querySelector('input[name="payment"]:checked')?.value || 'qris'; }
function shipping(){ return selectedPickup()==='antar' ? Number(settings.delivery_fee||0) : 0; }

// Hitung harga addon untuk satu entry keranjang (sesuai opsi yang dipilih)
function addonPriceForEntry(entry) {
  if (!entry.options) return 0;
  let extra = 0;
  if (entry.options.add_egg) extra += (settings.egg_price || 3000);
  if (entry.options.temp === 'dingin') extra += (settings.drink_temp_cold_price || 1000);
  return extra;
}

// Buat cart key yang unik per item + opsi (agar item sama tapi opsi berbeda bisa berdampingan)
function cartKey(itemId, options) {
  const egg = options?.add_egg ? '1' : '0';
  const temp = options?.temp || '';
  return `${itemId}_${egg}_${temp}`;
}

async function api(url, options){ const r=await fetch(url,options); const data=await r.json(); if(!r.ok) throw new Error(data.error||'Terjadi kesalahan'); return data; }

async function loadSettings(){
  settings=await api('/api/settings/public');
  $('brand-name').textContent=settings.store_name || 'Asrama Food';
  document.title=`${settings.store_name || 'AsramaFood'} - Pesan Makanan`;
  $('store-status-text').textContent=settings.is_open ? 'Toko sedang buka' : 'Toko sedang tutup';
  $('open-hours-text').textContent=settings.open_hours ? `Buka ${settings.open_hours}` : 'Jam buka belum diatur';
  if (settings.available_buildings) {
    const buildings = settings.available_buildings.split(',').map(b => b.trim()).filter(b => b);
    const dormSelect = $('dorm-building');
    if (dormSelect) {
      dormSelect.innerHTML = buildings.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
      if (!buildings.includes(state.location.building) && buildings.length > 0) {
        state.location.building = buildings[0];
        localStorage.setItem('af_location', JSON.stringify(state.location));
        refreshLocation();
      }
    }
  }
  if(!settings.is_open) showToast('Toko sedang tutup. Kamu masih bisa melihat menu.');
}
async function loadCategories(){
  categories=await api('/api/categories');
  const host=$('category-pills');
  host.innerHTML='<button class="cat-pill active" data-id=""><i aria-hidden="true" class="fa-solid fa-border-all"></i> Semua</button>'+
    categories.map(c=>`<button class="cat-pill" data-id="${c.id}"><i aria-hidden="true" class="fa-solid fa-utensils"></i> ${escapeHtml(c.name)}</button>`).join('');
  host.querySelectorAll('.cat-pill').forEach(btn=>btn.onclick=()=>{ state.activeCategory=btn.dataset.id; host.querySelectorAll('.cat-pill').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); loadMenu(); });
}
async function loadMenu(){
  const qs=new URLSearchParams(); if(state.activeCategory) qs.set('category',state.activeCategory); if(state.searchQuery) qs.set('search',state.searchQuery);
  allMenu=await api('/api/menu?'+qs.toString()); renderMenu();
}
function foodCardHtml(item){
  const out=item.stock<=0;
  const visual = item.image
      ? `<img src="${item.image}" alt="Foto ${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover; display:block;">`
      : `<span>${escapeHtml(item.image_emoji||'🍽️')}</span>`;
  const hasDiscount = item.is_discount && item.discount_price && item.discount_price < item.price;
  const priceHtml = hasDiscount
    ? `<span class="price-num" style="display:flex;flex-direction:column;line-height:1.2;"><span style="text-decoration:line-through;color:var(--text-muted);font-size:0.75em;font-weight:400;">${money(item.price)}</span><span style="color:var(--danger);">${money(item.discount_price)}</span></span>`
    : `<span class="price-num">${money(item.price)}</span>`;
  const discountBadge = hasDiscount ? `<span class="rating-chip" style="background:var(--danger);color:#fff;"><i aria-hidden="true" class="fa-solid fa-fire"></i> Diskon</span>` : '';
  return `<article class="food-card"><div class="food-image-wrapper emoji-food">${visual}<span class="prep-time"><i aria-hidden="true" class="fa-solid fa-box"></i> Stok ${item.stock}</span>${discountBadge ? `<span class="prep-time" style="left:0.6rem;right:auto;background:var(--danger);color:#fff;"><i aria-hidden="true" class="fa-solid fa-fire"></i> Diskon</span>` : ''}</div><div class="food-info"><div class="food-header-row"><h3 class="food-title">${escapeHtml(item.name)}</h3><span class="rating-chip"><i aria-hidden="true" class="fa-solid fa-tag"></i>${escapeHtml(item.category_name||'Menu')}</span></div><p class="food-description">${escapeHtml(item.description||'Menu AsramaFood')}</p><div class="food-footer"><div class="food-price">${priceHtml}<span class="stock-text ${out?'danger-text':''}">${out?'Stok habis':'Tersedia'}</span></div><button class="add-cart-btn" ${out?'disabled':''} onclick="addToCart(${item.id})"><i aria-hidden="true" class="fa-solid fa-plus"></i> Tambah</button></div></div></article>`;
}
function renderMenu(){
  let items=allMenu;
  if(state.maxPriceFilter!=='all') items=items.filter(x=>effectivePrice(x)<=Number(state.maxPriceFilter));
  if(!items.length){ $('food-grid').innerHTML='<div class="empty-state"><i aria-hidden="true" class="fa-solid fa-bowl-food"></i><h3>Menu tidak ditemukan</h3><p>Coba ganti pencarian atau filter harga.</p></div>'; return; }
  $('food-grid').innerHTML=items.map(foodCardHtml).join('');
}
async function loadBestSellers(){
  const section = $('bestseller-section');
  if (!section) return;
  try {
    const items = await api('/api/menu/terlaris?limit=6');
    if (!items.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    $('bestseller-grid').innerHTML = items.map(foodCardHtml).join('');
  } catch (e) {
    section.style.display = 'none';
  }
}

// --- Modal Pilih Opsi ---
let _optionPendingItem = null;

window.addToCart = (id) => {
  if (!settings.is_open) return showToast('Toko sedang tutup');
  const item = allMenu.find(x => x.id === id);
  if (!item) return;
  const catName = (item.category_name || '').toLowerCase();
  const hasEgg = !!item.allow_egg;          // per-item config dari admin
  const isMinuman = catName === 'minuman';

  if (hasEgg || isMinuman) {
    // Tampilkan modal opsi
    _optionPendingItem = item;
    renderOptionModal(item, hasEgg, isMinuman);
    $('option-modal').classList.add('open');
  } else {
    // Tidak ada opsi → langsung masuk keranjang
    _doAddToCart(item, {});
  }
};

function renderOptionModal(item, hasEgg, isMinuman) {
  const eggPrice = settings.egg_price || 3000;
  const coldPrice = settings.drink_temp_cold_price || 1000;

  let html = `<div class="option-item-preview">`;
  if (item.image) {
    html += `<img src="${item.image}" alt="${escapeHtml(item.name)}" class="option-item-img">`;
  } else {
    html += `<div class="option-item-emoji">${escapeHtml(item.image_emoji || '🍽️')}</div>`;
  }
  html += `<div><div class="option-item-name">${escapeHtml(item.name)}</div><div class="option-item-price">${money(effectivePrice(item))}</div></div></div>`;

  if (hasEgg) {
    const eggStockLeft = settings.egg_stock ?? 0;
    const eggOut = eggStockLeft <= 0;
    const eggStockBadge = eggOut
      ? `<span class="option-price-tag" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5;">🥚 Stok habis</span>`
      : `<span class="option-price-tag" style="background:#d1fae5;color:#065f46;">🥚 Sisa ${eggStockLeft}</span>`;
    html += `
    <div class="option-section">
      <div class="option-label"><i class="fa-solid fa-egg"></i> Tambah Telur <span class="option-price-tag">+${money(eggPrice)}</span>${eggStockBadge}</div>
      <div class="option-toggle-group">
        <label class="option-toggle-btn active" id="opt-egg-no">
          <input type="radio" name="opt_egg" value="no" checked hidden> Tidak
        </label>
        <label class="option-toggle-btn${eggOut ? ' disabled' : ''}" id="opt-egg-yes" ${eggOut ? 'aria-disabled="true" title="Stok telur habis"' : ''}>
          <input type="radio" name="opt_egg" value="yes" hidden ${eggOut ? 'disabled' : ''}> <i class="fa-solid fa-egg"></i> + Telur
        </label>
      </div>
    </div>`;
  }

  if (isMinuman) {
    html += `
    <div class="option-section">
      <div class="option-label"><i class="fa-solid fa-temperature-half"></i> Suhu Minuman</div>
      <div class="option-toggle-group">
        <label class="option-toggle-btn active" id="opt-temp-panas">
          <input type="radio" name="opt_temp" value="panas" checked hidden> <i class="fa-solid fa-fire"></i> Panas
        </label>
        <label class="option-toggle-btn" id="opt-temp-dingin">
          <input type="radio" name="opt_temp" value="dingin" hidden> <i class="fa-solid fa-snowflake"></i> Es/Dingin <span class="option-price-tag">+${money(coldPrice)}</span>
        </label>
      </div>
    </div>`;
  }

  $('option-modal-body').innerHTML = html;

  // Bind toggle visual — skip tombol disabled (stok habis)
  document.querySelectorAll('#option-modal .option-toggle-btn:not(.disabled)').forEach(btn => {
    btn.onclick = () => {
      const input = btn.querySelector('input');
      if (input.disabled) return; // guard tambahan
      const groupName = input.name;
      document.querySelectorAll(`#option-modal input[name="${groupName}"]`).forEach(r => {
        r.closest('.option-toggle-btn').classList.remove('active');
      });
      input.checked = true;
      btn.classList.add('active');
      // Update preview harga
      updateOptionPreviewPrice(item, hasEgg, isMinuman);
    };
  });

  updateOptionPreviewPrice(item, hasEgg, isMinuman);
}

function updateOptionPreviewPrice(item, hasEgg, isMinuman) {
  const eggPrice = settings.egg_price || 3000;
  const coldPrice = settings.drink_temp_cold_price || 1000;
  let total = effectivePrice(item);
  // Hanya hitung harga +Telur kalau stok masih ada dan radio tidak disabled
  if (hasEgg && (settings.egg_stock ?? 0) > 0) {
    const checkedEgg = document.querySelector('#option-modal input[name="opt_egg"]:checked');
    if (checkedEgg && !checkedEgg.disabled && checkedEgg.value === 'yes') total += eggPrice;
  }
  if (isMinuman) {
    const temp = document.querySelector('#option-modal input[name="opt_temp"]:checked')?.value;
    if (temp === 'dingin') total += coldPrice;
  }
  const priceEl = $('option-modal-total-price');
  if (priceEl) priceEl.textContent = money(total);
}

function confirmOptionModal() {
  const item = _optionPendingItem;
  if (!item) return;
  const catName = (item.category_name || '').toLowerCase();
  const hasEgg = !!item.allow_egg;
  const isMinuman = catName === 'minuman';

  const options = {};
  // +Telur: hanya kalau allow_egg=true DAN stok > 0 DAN radio tidak disabled
  if (hasEgg && (settings.egg_stock ?? 0) > 0) {
    const checkedEgg = document.querySelector('#option-modal input[name="opt_egg"]:checked');
    if (checkedEgg && !checkedEgg.disabled && checkedEgg.value === 'yes') options.add_egg = true;
  }
  if (isMinuman) {
    const val = document.querySelector('#option-modal input[name="opt_temp"]:checked')?.value;
    if (val) options.temp = val;
  }

  $('option-modal').classList.remove('open');
  _optionPendingItem = null;
  _doAddToCart(item, options);
}

function _doAddToCart(item, options) {
  const key = cartKey(item.id, options);
  const current = cart[key]?.qty || 0;
  if (current >= item.stock) return showToast('Jumlah melebihi stok');
  cart[key] = { item, qty: current + 1, options };
  updateCart();
  showToast(`${item.name} ditambahkan`);
}

window.updateQuantity = (key, delta) => {
  if (!cart[key]) return;
  const next = cart[key].qty + delta;
  if (next <= 0) delete cart[key];
  else if (next <= cart[key].item.stock) cart[key].qty = next;
  else return showToast('Jumlah melebihi stok');
  updateCart();
};

function optionLabel(entry) {
  if (!entry.options) return '';
  const parts = [];
  if (entry.options.add_egg) parts.push('+Telur');
  if (entry.options.temp === 'panas') parts.push('Panas');
  if (entry.options.temp === 'dingin') parts.push('Es/Dingin');
  return parts.length ? `<span class="cart-item-option">${parts.join(' · ')}</span>` : '';
}

function updateCart(){
  const entries=cartEntries(); $('cart-badge-count').textContent=entries.reduce((s,e)=>s+e.qty,0);
  $('cart-items-container').innerHTML=entries.length?entries.map((entry)=>{
    const {item, qty, options} = entry;
    const key = cartKey(item.id, options);
    const unitPrice = effectivePrice(item) + addonPriceForEntry(entry);
    const visual = item.image ? `<img src="${item.image}" alt="Foto ${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover; display:block; border-radius:inherit;">` : escapeHtml(item.image_emoji||'🍽️');
    return `<div class="cart-item"><div class="cart-emoji" style="padding:0; overflow:hidden;">${visual}</div><div class="cart-item-details"><div class="cart-item-title">${escapeHtml(item.name)}</div>${optionLabel(entry)}<div class="cart-item-price">${money(unitPrice*qty)}</div></div><div class="cart-qty-controls"><button class="qty-btn" onclick="updateQuantity('${key}',-1)">−</button><span class="qty-count">${qty}</span><button class="qty-btn" onclick="updateQuantity('${key}',1)">+</button></div></div>`;
  }).join(''):'<div class="empty-state compact"><i aria-hidden="true" class="fa-solid fa-basket-shopping"></i><p>Keranjang masih kosong.</p></div>';
  const sub=subtotal(); $('cart-subtotal').textContent=money(sub); $('cart-shipping').textContent=money(settings.delivery_fee); $('cart-total').textContent=money(sub+Number(settings.delivery_fee||0));
  refreshCheckoutSummary();
}
function refreshLocation(){ $('current-location-text').textContent=state.location.building; $('checkout-target-location').textContent=state.location.building; if($('dorm-building')) $('dorm-building').value=state.location.building; }
function refreshCheckoutSummary(){
  if(!$('checkout-subtotal')) return; const sub=subtotal(); const ship=shipping(); $('checkout-subtotal').textContent=money(sub); $('checkout-shipping').textContent=money(ship); $('checkout-total').textContent=money(sub+ship);
  
  const isAntar = selectedPickup() === 'antar';
  if(isAntar) $('checkout-location-wrap').classList.remove('hidden-anim');
  else $('checkout-location-wrap').classList.add('hidden-anim');
  if ($('checkout-room')) $('checkout-room').required = isAntar;
  
  const qrisLabel = document.querySelector('input[name="payment"][value="qris"]').closest('.radio-box');
  const codLabel = document.querySelector('input[name="payment"][value="cod"]').closest('.radio-box');
  
  qrisLabel.classList.add('anim-target');
  codLabel.classList.add('anim-target');

  const canCod = settings.allow_cod && selectedPickup() === 'antar';
  const canQris = settings.allow_qris;
  
  if (canCod) codLabel.classList.remove('hidden-anim');
  else codLabel.classList.add('hidden-anim');

  if (canQris) qrisLabel.classList.remove('hidden-anim');
  else qrisLabel.classList.add('hidden-anim');
  
  if (!canCod && selectedPayment() === 'cod' && canQris) {
      document.querySelector('input[name="payment"][value="qris"]').checked=true;
  }
  if (!canQris && selectedPayment() === 'qris' && canCod) {
      document.querySelector('input[name="payment"][value="cod"]').checked=true;
  }
  document.querySelectorAll('.payment-group .radio-box').forEach(x=>x.classList.toggle('active',x.querySelector('input').checked));
  
  $('payment-help').textContent=selectedPayment()==='cod'?'Bayar tunai saat pesanan diantar ke kamar.':'Setelah order dibuat, scan QRIS dan upload bukti pembayaran di halaman tracking.';
}
function bindRadioGroup(selector){ document.querySelectorAll(selector+' .radio-box').forEach(box=>box.onclick=()=>{ const input=box.querySelector('input'); input.checked=true; document.querySelectorAll(selector+' .radio-box').forEach(x=>x.classList.toggle('active',x===box)); refreshCheckoutSummary(); }); }
function setup(){
  $('cart-toggle-btn').onclick=()=>$('cart-drawer-overlay').classList.add('open'); $('close-cart-btn').onclick=()=>$('cart-drawer-overlay').classList.remove('open'); $('cart-drawer-overlay').onclick=e=>{if(e.target===$('cart-drawer-overlay')) $('cart-drawer-overlay').classList.remove('open');};
  $('location-btn').onclick=()=>{$('location-modal').classList.add('open');}; $('close-location-modal').onclick=()=>$('location-modal').classList.remove('open');
  $('location-form').onsubmit=e=>{e.preventDefault(); state.location={building:$('dorm-building').value.trim()}; localStorage.setItem('af_location',JSON.stringify(state.location)); refreshLocation(); $('location-modal').classList.remove('open'); showToast('Gedung disimpan');};
  $('proceed-checkout-btn').onclick=()=>{ if(!cartEntries().length) return showToast('Keranjang masih kosong'); if(!settings.is_open) return showToast('Toko sedang tutup'); $('cart-drawer-overlay').classList.remove('open'); refreshCheckoutSummary(); $('checkout-modal').classList.add('open'); };
  $('close-checkout-modal').onclick=()=>$('checkout-modal').classList.remove('open');
  $('search-input').oninput=e=>{state.searchQuery=e.target.value.trim(); $('clear-search-btn').classList.toggle('visible',!!state.searchQuery); clearTimeout(window.__searchTimer); window.__searchTimer=setTimeout(loadMenu,250);};
  $('clear-search-btn').onclick=()=>{$('search-input').value=''; state.searchQuery=''; $('clear-search-btn').classList.remove('visible'); loadMenu();};
  document.querySelectorAll('.budget-chip').forEach(btn=>btn.onclick=()=>{state.maxPriceFilter=btn.dataset.maxPrice; document.querySelectorAll('.budget-chip').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); renderMenu();});
  $('nav-search-trigger').onclick=e=>{e.preventDefault(); $('search-input').focus(); $('search-input').scrollIntoView({behavior:'smooth',block:'center'});}; $('nav-cart-trigger').onclick=e=>{e.preventDefault(); $('cart-drawer-overlay').classList.add('open');};
  bindRadioGroup('.pickup-group'); bindRadioGroup('.payment-group');
  // Modal opsi
  $('option-modal-confirm').onclick = confirmOptionModal;
  $('option-modal-close').onclick = () => { $('option-modal').classList.remove('open'); _optionPendingItem = null; };
  $('option-modal').onclick = e => { if (e.target === $('option-modal')) { $('option-modal').classList.remove('open'); _optionPendingItem = null; } };
  $('checkout-form').onsubmit=async e=>{
    e.preventDefault(); if(!cartEntries().length) return;
    const btn=e.currentTarget.querySelector('button[type="submit"]'); btn.disabled=true; btn.innerHTML='<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    try{
      const pickup=selectedPickup(), payment=selectedPayment();
      const room=pickup==='antar'?`${state.location.building} - ${$('checkout-room').value.trim()}`:'Ambil sendiri';
      const notes=[$('order-notes').value.trim(), pickup==='antar'?$('checkout-note').value.trim():''].filter(Boolean).join(' | ');
      const data=await api('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:$('student-name').value.trim(),room,whatsapp:$('student-whatsapp').value.trim(),note:notes,method:pickup,payment_method:payment,items:cartEntries().map(({item,qty,options})=>({menu_item_id:item.id,qty,...(options||{})}))})});
      cart={}; updateCart(); window.location.href='/track.html?code='+encodeURIComponent(data.order_code);
    }catch(err){ showToast(err.message); btn.disabled=false; btn.innerHTML='<i aria-hidden="true" class="fa-solid fa-check"></i> Buat Pesanan'; }
  };
}

document.addEventListener('DOMContentLoaded',async()=>{ setup(); refreshLocation(); updateCart(); try{ await loadSettings(); await loadCategories(); await loadMenu(); await loadBestSellers(); }catch(e){ showToast(e.message); } });
