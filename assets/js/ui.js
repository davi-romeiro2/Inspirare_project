/* =========================================================
   Inspirare - UI
   JS compartilhado: fundo animado + icones Lucide.
   Carregado como <script src="../../assets/js/ui.js"></script>
   no final do body, apos o DOM existir.
   ========================================================= */

(function () {
    'use strict';

    function loadBgAnimation() {
        if (document.querySelector('.bg-animation')) return;
        var bg = document.createElement('div');
        bg.className = 'bg-animation';
        bg.innerHTML =
            '<div class="circle circle-1"></div>' +
            '<div class="circle circle-2"></div>' +
            '<div class="circle circle-3"></div>';
        document.body.insertBefore(bg, document.body.firstChild);
    }

    function loadLucide() {
        // Atributos [data-lucide] ja estao no HTML, entao o unico
        // trabalho e carregar a lib e pedir pra ela renderizar.
        if (window.lucide) {
            window.lucide.createIcons();
            return;
        }
        if (document.querySelector('script[data-lucide]')) return;
        var s = document.createElement('script');
        s.src = 'https://unpkg.com/lucide@latest';
        s.defer = true;
        s.dataset.lucide = '1';
        s.onload = function () { window.lucide && window.lucide.createIcons(); };
        document.head.appendChild(s);
    }

    function init() {
        loadBgAnimation();
        loadLucide();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
