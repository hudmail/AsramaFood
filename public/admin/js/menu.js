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
}
function logout() {
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
    chip.textContent = c.name;
    chip.onclick = () => { filterCategory = c.id; renderCategoryChips(); renderTable(); };
    host.appendChild(chip);
  });
}

async function addCategory() {
  const input = document.getElementById('newCategoryInput');
  const name = input.value.trim();
  if (!name) return;
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    input.value = '';
    await loadCategories();
  } else {
    const data = await res.json();
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
      <thead><tr><th></th><th>Nama</th><th>Kategori</th><th>Modal</th><th>Jual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
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
            <td style="font-weight: 600;">${money(m.price)}</td>
            <td>${m.stock}</td>
            <td>${m.is_available ? '<span class="badge success"><i class="fa-solid fa-check"></i> Tersedia</span>' : '<span class="badge danger"><i class="fa-solid fa-xmark"></i> Habis</span>'}</td>
            <td>
              <div class="table-actions">
                  <button class="btn-icon-small" onclick='openEditor(${JSON.stringify(m).replace(/'/g, "&#39;")})' title="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn-icon-small" style="color: var(--danger);" onclick="deleteMenu(${m.id})" title="Hapus"><i class="fa-solid fa-trash"></i></button>
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
    
    document.getElementById('editImageBase64').value = '';
    document.getElementById('editImageFile').value = '';
    document.getElementById('editImagePreviewWrap').style.display = 'none';

    document.getElementById('editAvailable').checked = true;
  }
}

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
    alert('Nama & harga wajib diisi');
    return;
  }
  const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';
  const res = await fetch(url, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
})();
