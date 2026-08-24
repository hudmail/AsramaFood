(function () {
  const KEY = 'af_theme';
  const saved = localStorage.getItem(KEY);
  if (saved === 'dark') document.body.classList.add('dark-theme');

  window.initThemeToggle = function (btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const icon = btn.querySelector('i');
    const sync = () => {
      const isDark = document.body.classList.contains('dark-theme');
      if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };
    sync();
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      localStorage.setItem(KEY, document.body.classList.contains('dark-theme') ? 'dark' : 'light');
      sync();
    });
  };
})();
