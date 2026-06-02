// Inspirare form feedback. Renders a discreet inline error inside the <form>.
// Exposes window.InspirareFeedback.showError(formEl, message) / clearError(formEl).

(function () {
  'use strict';

  function ensureBox(formEl) {
    var existing = formEl.querySelector('.form-error');
    if (existing) return existing;
    var box = document.createElement('div');
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    box.setAttribute('aria-live', 'polite');
    formEl.appendChild(box);
    return box;
  }

  function showError(formEl, message) {
    if (!formEl) return;
    var box = ensureBox(formEl);
    box.textContent = message;
    box.style.display = 'block';
  }

  function clearError(formEl) {
    if (!formEl) return;
    var box = formEl.querySelector('.form-error');
    if (box) {
      box.textContent = '';
      box.style.display = 'none';
    }
  }

  window.InspirareFeedback = { showError: showError, clearError: clearError };
})();
