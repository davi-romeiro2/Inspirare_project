/* =========================================================
   Inspirare - UI
   JS compartilhado: injeta o fundo animado.
   O Lucide continua sendo carregado diretamente no <head>
   de cada pagina (sincrono, sem dependencia de timing).
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
        // Posicao fixa no fundo, atras de todo o conteudo
        document.body.insertBefore(bg, document.body.firstChild);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadBgAnimation);
    } else {
        loadBgAnimation();
    }
})();
