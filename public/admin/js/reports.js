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

document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireLogin();
    if (!ok) return;

    // Set default date to today
    const dateInput = document.getElementById('reportDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
});

function downloadExcel() {
    const date = document.getElementById('reportDate').value;
    if (!date) return alert('Silakan pilih tanggal terlebih dahulu.');
    
    // Trigger download via location.href
    window.location.href = `/api/admin/reports/excel?date=${date}`;
}

function downloadPdf() {
    const date = document.getElementById('reportDate').value;
    if (!date) return alert('Silakan pilih tanggal terlebih dahulu.');
    
    // Trigger download via location.href
    window.location.href = `/api/admin/reports/pdf?date=${date}`;
}
