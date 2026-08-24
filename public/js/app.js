let allMenu = [];
let categories = [];
let cart = {};
let settings = { store_name: 'AsramaFood', is_open: true, delivery_fee: 0, open_hours: '', allow_qris: true, allow_cod: true };
let state = {
  activeCategory: '', searchQuery: '', maxPriceFilter: 'all',
  location: JSON.parse(localStorage.getItem('af_location') || 'null') || { building: 'Gedung A' }
};

const $ = (id) => document.getElementById(id);
const money = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
function escapeHtml(str='') { const d=document.createElement('div'); d.textContent=String(str); return d.innerHTML; }
function showToast(msg) { $('toast-text').textContent=msg; $('toast-message').classList.add('show'); setTimeout(()=>$('toast-message').classList.remove('show'),2400); }
function cartEntries(){ return Object.values(cart); }
function subtotal(){ return cartEntries().reduce((s,e)=>s+e.item.price*e.qty,0); }
function selectedPickup(){ return document.querySelector('input[name="pickup"]:checked')?.value || 'antar'; }
function selectedPayment(){ return document.querySelector('input[name="payment"]:checked')?.value || 'qris'; }
function shipping(){ return selectedPickup()==='antar' ? Number(settings.delivery_fee||0) : 0; }

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
  host.innerHTML='<button class="cat-pill active" data-id=""><i class="fa-solid fa-border-all"></i> Semua</button>'+
    categories.map(c=>`<button class="cat-pill" data-id="${c.id}"><i class="fa-solid fa-utensils"></i> ${escapeHtml(c.name)}</button>`).join('');
  host.querySelectorAll('.cat-pill').forEach(btn=>btn.onclick=()=>{ state.activeCategory=btn.dataset.id; host.querySelectorAll('.cat-pill').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); loadMenu(); });
}
async function loadMenu(){
  const qs=new URLSearchParams(); if(state.activeCategory) qs.set('category',state.activeCategory); if(state.searchQuery) qs.set('search',state.searchQuery);
  allMenu=await api('/api/menu?'+qs.toString()); renderMenu();
}
function renderMenu(){
  let items=allMenu;
  if(state.maxPriceFilter!=='all') items=items.filter(x=>x.price<=Number(state.maxPriceFilter));
  if(!items.length){ $('food-grid').innerHTML='<div class="empty-state"><i class="fa-solid fa-bowl-food"></i><h3>Menu tidak ditemukan</h3><p>Coba ganti pencarian atau filter harga.</p></div>'; return; }
  $('food-grid').innerHTML=items.map(item=>{
    const out=item.stock<=0;
    const visual = item.image 
        ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover; display:block;">` 
        : `<span>${escapeHtml(item.image_emoji||'🍽️')}</span>`;
    return `<article class="food-card"><div class="food-image-wrapper emoji-food">${visual}<span class="prep-time"><i class="fa-solid fa-box"></i> Stok ${item.stock}</span></div><div class="food-info"><div class="food-header-row"><h3 class="food-title">${escapeHtml(item.name)}</h3><span class="rating-chip"><i class="fa-solid fa-tag"></i>${escapeHtml(item.category_name||'Menu')}</span></div><p class="food-description">${escapeHtml(item.description||'Menu AsramaFood')}</p><div class="food-footer"><div class="food-price"><span class="price-num">${money(item.price)}</span><span class="stock-text ${out?'danger-text':''}">${out?'Stok habis':'Tersedia'}</span></div><button class="add-cart-btn" ${out?'disabled':''} onclick="addToCart(${item.id})"><i class="fa-solid fa-plus"></i> Tambah</button></div></div></article>`;
  }).join('');
}
window.addToCart=(id)=>{
  if(!settings.is_open) return showToast('Toko sedang tutup');
  const item=allMenu.find(x=>x.id===id); if(!item) return;
  const current=cart[id]?.qty||0; if(current>=item.stock) return showToast('Jumlah melebihi stok');
  cart[id]={item,qty:current+1}; updateCart(); showToast(`${item.name} ditambahkan`);
};
window.updateQuantity=(id,delta)=>{ if(!cart[id]) return; const next=cart[id].qty+delta; if(next<=0) delete cart[id]; else if(next<=cart[id].item.stock) cart[id].qty=next; else return showToast('Jumlah melebihi stok'); updateCart(); };
function updateCart(){
  const entries=cartEntries(); $('cart-badge-count').textContent=entries.reduce((s,e)=>s+e.qty,0);
  $('cart-items-container').innerHTML=entries.length?entries.map(({item,qty})=>{
    const visual = item.image ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover; display:block; border-radius:inherit;">` : escapeHtml(item.image_emoji||'🍽️');
    return `<div class="cart-item"><div class="cart-emoji" style="padding:0; overflow:hidden;">${visual}</div><div class="cart-item-details"><div class="cart-item-title">${escapeHtml(item.name)}</div><div class="cart-item-price">${money(item.price*qty)}</div></div><div class="cart-qty-controls"><button class="qty-btn" onclick="updateQuantity(${item.id},-1)">−</button><span class="qty-count">${qty}</span><button class="qty-btn" onclick="updateQuantity(${item.id},1)">+</button></div></div>`;
  }).join(''):'<div class="empty-state compact"><i class="fa-solid fa-basket-shopping"></i><p>Keranjang masih kosong.</p></div>';
  const sub=subtotal(); $('cart-subtotal').textContent=money(sub); $('cart-shipping').textContent=money(settings.delivery_fee); $('cart-total').textContent=money(sub+Number(settings.delivery_fee||0));
  refreshCheckoutSummary();
}
function refreshLocation(){ $('current-location-text').textContent=state.location.building; $('checkout-target-location').textContent=state.location.building; if($('dorm-building')) $('dorm-building').value=state.location.building; }
function refreshCheckoutSummary(){
  if(!$('checkout-subtotal')) return; const sub=subtotal(); const ship=shipping(); $('checkout-subtotal').textContent=money(sub); $('checkout-shipping').textContent=money(ship); $('checkout-total').textContent=money(sub+ship);
  $('checkout-location-wrap').style.display=selectedPickup()==='antar'?'block':'none';
  
  const qrisLabel = document.querySelector('input[name="payment"][value="qris"]').closest('.radio-box');
  const codLabel = document.querySelector('input[name="payment"][value="cod"]').closest('.radio-box');
  
  const canCod = settings.allow_cod && selectedPickup() === 'antar';
  const canQris = settings.allow_qris;
  
  codLabel.style.display = canCod ? 'flex' : 'none';
  qrisLabel.style.display = canQris ? 'flex' : 'none';
  
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
  $('checkout-form').onsubmit=async e=>{
    e.preventDefault(); if(!cartEntries().length) return;
    const btn=e.currentTarget.querySelector('button[type="submit"]'); btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    try{
      const pickup=selectedPickup(), payment=selectedPayment();
      const room=pickup==='antar'?`${state.location.building} - ${$('checkout-room').value.trim()}`:'Ambil sendiri';
      const notes=[$('order-notes').value.trim(), pickup==='antar'?$('checkout-note').value.trim():''].filter(Boolean).join(' | ');
      const data=await api('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:$('student-name').value.trim(),room,whatsapp:$('student-whatsapp').value.trim(),note:notes,method:pickup,payment_method:payment,items:cartEntries().map(({item,qty})=>({menu_item_id:item.id,qty}))})});
      cart={}; updateCart(); window.location.href='/track.html?code='+encodeURIComponent(data.order_code);
    }catch(err){ showToast(err.message); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-check"></i> Buat Pesanan'; }
  };
}

document.addEventListener('DOMContentLoaded',async()=>{ setup(); refreshLocation(); updateCart(); try{ await loadSettings(); await loadCategories(); await loadMenu(); }catch(e){ showToast(e.message); } });
