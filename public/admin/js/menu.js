let categories = [];
let menuItems = [];
let filterCategory = '';

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
<<<<<<< HEAD
}function logout() {
=======
}
function logout() {
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
  fetch('/api/admin/logout', { method: 'POST' }).then(() => (window.location.href = '/admin/login.html'));
}

async function loadCategories() {
  const res = await fetch('/api/admin/categories');
  categories = await res.json();
  renderCategoryChips();
  const select = document.getElementById('editCategory');
  select.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

function renderCategoryChips() {
  const host = document.getElementById('categoryChips');
  host.innerHTML = '';
  const allChip = document.createElement('div');
  allChip.className = 'filter-tab' + (filterCategory === '' ? ' active' : '');
  allChip.textContent = 'Semua';
  allChip.onclick = () => { filterCategory = ''; renderCategoryChips(); renderTable(); };
  host.appendChild(allChip);
  categories.forEach((c) => {
    const chip = document.createElement('div');
    chip.className = 'filter-tab' + (filterCategory === c.id ? ' active' : '');
<<<<<<< HEAD
    chip.style.display = 'flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '0.4rem';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = c.name;
    textSpan.onclick = () => { filterCategory = c.id; renderCategoryChips(); renderTable(); };
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-xmark"></i>';
    delBtn.style.background = 'none';
    delBtn.style.border = 'none';
    delBtn.style.color = 'inherit';
    delBtn.style.cursor = 'pointer';
    delBtn.style.padding = '0';
    delBtn.style.opacity = '0.6';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Hapus kategori "${c.name}"?`)) {
        await deleteCategory(c.id);
      }
    };
    delBtn.onmouseover = () => delBtn.style.opacity = '1';
    delBtn.onmouseout = () => delBtn.style.opacity = '0.6';

    chip.appendChild(textSpan);
    chip.appendChild(delBtn);
=======
    chip.textContent = c.name;
    chip.onclick = () => { filterCategory = c.id; renderCategoryChips(); renderTable(); };
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    host.appendChild(chip);
  });
}

<<<<<<< HEAD
async function deleteCategory(id) {
  const res = await fetch('/api/admin/categories/' + id, { method: 'DELETE' });
  if (res.ok) {
    if (filterCategory === id) filterCategory = '';
    await loadCategories();
    renderTable();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Gagal menghapus kategori (hanya Owner yang bisa)');
  }
}

async function addCategory() {
  const input = document.getElementById('newCategoryInput');
  const name = input.value.trim();
  if (!name) {
    alert('Isi dulu nama kategorinya ya, kolomnya masih kosong.');
    input.focus();
    return;
  }
=======
async function addCategory() {
  const input = document.getElementById('newCategoryInput');
  const name = input.value.trim();
  if (!name) return;
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    input.value = '';
    await loadCategories();
  } else {
<<<<<<< HEAD
    const data = await res.json().catch(() => ({}));
=======
    const data = await res.json();
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    alert(data.error || 'Gagal menambah kategori');
  }
}

async function loadMenu() {
  const res = await fetch('/api/admin/menu');
  menuItems = await res.json();
  renderTable();
}

function renderTable() {
  const host = document.getElementById('menuTableHost');
  const filtered = filterCategory ? menuItems.filter((m) => m.category_id === filterCategory) : menuItems;
  if (filtered.length === 0) {
    host.innerHTML = `<div class="empty-state compact"><div class="icon" style="font-size:2rem;margin-bottom:0.5rem;">🍽️</div><p>Belum ada menu</p></div>`;
    return;
  }
  host.innerHTML = `
    <table class="data-table">
<<<<<<< HEAD
      <thead><tr><th></th><th>Nama</th><th>Kategori</th><th>Modal</th><th>Jual</th><th>Terjual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
=======
      <thead><tr><th></th><th>Nama</th><th>Kategori</th><th>Modal</th><th>Jual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
      <tbody>
        ${filtered
          .map(
            (m) => `
          <tr>
            <td style="font-size:20px; text-align:center;">
              ${m.image ? `<img src="${m.image}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : (m.image_emoji || '🍽️')}
            </td>
            <td style="font-weight: 600; color: var(--text-title);">${escapeHtml(m.name)}</td>
            <td><span class="badge" style="background: var(--bg-body); color: var(--text-muted); border: 1px solid var(--border-color);">${escapeHtml(m.category_name || '-')}</span></td>
            <td>${money(m.cost_price || 0)}</td>
<<<<<<< HEAD
            <td style="font-weight: 600;">
              ${m.is_discount && m.discount_price
                ? `<span style="text-decoration:line-through;color:var(--text-muted);font-weight:400;font-size:0.85em;">${money(m.price)}</span><br><span style="color:var(--danger);">${money(m.discount_price)}</span> <span class="badge danger" style="font-size:0.7em;">Diskon</span>`
                : money(m.price)}
            </td>
            <td>${m.sold_count || 0}</td>
            <td>${m.stock}</td>
            <td>${m.is_available ? '<span class="badge success"><i aria-hidden="true" class="fa-solid fa-check"></i> Tersedia</span>' : '<span class="badge danger"><i aria-hidden="true" class="fa-solid fa-xmark"></i> Habis</span>'}</td>
            <td>
              <div class="table-actions">
                  <button class="btn-icon-small" onclick='openEditor(${JSON.stringify(m).replace(/'/g, "&#39;")})' title="Edit"><i aria-hidden="true" class="fa-solid fa-pen"></i></button>
                  <button class="btn-icon-small" style="color: var(--danger);" onclick="deleteMenu(${m.id})" title="Hapus"><i aria-hidden="true" class="fa-solid fa-trash"></i></button>
=======
            <td style="font-weight: 600;">${money(m.price)}</td>
            <td>${m.stock}</td>
            <td>${m.is_available ? '<span class="badge success"><i class="fa-solid fa-check"></i> Tersedia</span>' : '<span class="badge danger"><i class="fa-solid fa-xmark"></i> Habis</span>'}</td>
            <td>
              <div class="table-actions">
                  <button class="btn-icon-small" onclick='openEditor(${JSON.stringify(m).replace(/'/g, "&#39;")})' title="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn-icon-small" style="color: var(--danger);" onclick="deleteMenu(${m.id})" title="Hapus"><i class="fa-solid fa-trash"></i></button>
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
              </div>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function openEditor(item) {
  document.getElementById('editorOverlay').classList.add('open');
  if (item) {
    document.getElementById('editorTitle').textContent = 'Edit Menu';
    document.getElementById('editId').value = item.id;
    document.getElementById('editName').value = item.name;
    document.getElementById('editDesc').value = item.description || '';
    document.getElementById('editCategory').value = item.category_id || '';
    document.getElementById('editCostPrice').value = item.cost_price || 0;
    document.getElementById('editPrice').value = item.price;
    document.getElementById('editStock').value = item.stock;
<<<<<<< HEAD
    document.getElementById('editIsDiscount').checked = !!item.is_discount;
    document.getElementById('editDiscountPrice').value = item.discount_price || '';
    toggleDiscountField();

=======
    
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    if (item.image) {
      document.getElementById('editImageBase64').value = item.image;
      document.getElementById('editImagePreview').src = item.image;
      document.getElementById('editImagePreviewWrap').style.display = 'block';
    } else {
      document.getElementById('editImageBase64').value = '';
      document.getElementById('editImagePreviewWrap').style.display = 'none';
    }
    document.getElementById('editImageFile').value = '';

    document.getElementById('editAvailable').checked = !!item.is_available;
  } else {
    document.getElementById('editorTitle').textContent = 'Tambah Menu';
    document.getElementById('editId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editDesc').value = '';
    document.getElementById('editCostPrice').value = '';
    document.getElementById('editPrice').value = '';
    document.getElementById('editStock').value = '';
<<<<<<< HEAD
    document.getElementById('editIsDiscount').checked = false;
    document.getElementById('editDiscountPrice').value = '';
    toggleDiscountField();

=======
    
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    document.getElementById('editImageBase64').value = '';
    document.getElementById('editImageFile').value = '';
    document.getElementById('editImagePreviewWrap').style.display = 'none';

    document.getElementById('editAvailable').checked = true;
  }
}

<<<<<<< HEAD
function toggleDiscountField() {
  const on = document.getElementById('editIsDiscount').checked;
  document.getElementById('editDiscountWrap').style.display = on ? 'block' : 'none';
}

=======
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
function previewMenuImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 2.5MB');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('editImageBase64').value = reader.result;
    document.getElementById('editImagePreview').src = reader.result;
    document.getElementById('editImagePreviewWrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function closeEditor() {
  document.getElementById('editorOverlay').classList.remove('open');
}

async function saveMenu() {
  const id = document.getElementById('editId').value;
<<<<<<< HEAD
  const isDiscount = document.getElementById('editIsDiscount').checked;
  const discountPrice = parseInt(document.getElementById('editDiscountPrice').value, 10) || null;
  const price = parseInt(document.getElementById('editPrice').value, 10);

  if (isDiscount && (!discountPrice || discountPrice <= 0)) {
    alert('Harga diskon wajib diisi kalau menu ditandai sedang diskon');
    return;
  }
  if (isDiscount && discountPrice >= price) {
    alert('Harga diskon harus lebih murah dari harga jual');
    return;
  }

  const formData = new FormData();
  formData.append('name', document.getElementById('editName').value.trim());
  formData.append('description', document.getElementById('editDesc').value.trim());
  if (document.getElementById('editCategory').value) {
    formData.append('category_id', document.getElementById('editCategory').value);
  }
  formData.append('cost_price', parseInt(document.getElementById('editCostPrice').value, 10) || 0);
  formData.append('price', price);
  formData.append('stock', parseInt(document.getElementById('editStock').value, 10) || 0);
  formData.append('is_available', document.getElementById('editAvailable').checked ? 1 : 0);
  formData.append('is_discount', isDiscount ? 1 : 0);
  if (isDiscount) formData.append('discount_price', discountPrice);

  const fileInput = document.getElementById('editImageFile');
  if (fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  } else {
    const base64 = document.getElementById('editImageBase64').value;
    if (base64) formData.append('image', base64);
  }

  if (!formData.get('name') || !formData.get('price')) {
=======
  const payload = {
    name: document.getElementById('editName').value.trim(),
    description: document.getElementById('editDesc').value.trim(),
    category_id: document.getElementById('editCategory').value || null,
    cost_price: parseInt(document.getElementById('editCostPrice').value, 10) || 0,
    price: parseInt(document.getElementById('editPrice').value, 10),
    stock: parseInt(document.getElementById('editStock').value, 10) || 0,
    image: document.getElementById('editImageBase64').value || null,
    is_available: document.getElementById('editAvailable').checked,
  };
  if (!payload.name || !payload.price) {
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
    alert('Nama & harga wajib diisi');
    return;
  }
  const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';
  const res = await fetch(url, {
    method: id ? 'PUT' : 'POST',
<<<<<<< HEAD
    body: formData,
=======
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
  });
  if (res.ok) {
    closeEditor();
    await loadMenu();
  } else {
    const data = await res.json();
    alert(data.error || 'Gagal menyimpan menu');
  }
}

async function deleteMenu(id) {
  if (!confirm('Hapus menu ini?')) return;
  const res = await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await loadMenu();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Gagal menghapus menu');
  }
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  await loadCategories();
  await loadMenu();
<<<<<<< HEAD

  // Biar bisa tekan Enter di kolom "Nama kategori baru" tanpa harus klik tombol +Kategori
  const newCatInput = document.getElementById('newCategoryInput');
  if (newCatInput) {
    newCatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCategory();
      }
    });
  }
=======
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
})();
