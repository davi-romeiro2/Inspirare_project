lucide.createIcons();

function toggleMenu() {
    const sidebar = document.getElementById('main-sidebar');
    const content = document.getElementById('main-content');
    if (!sidebar || !content) return;
    sidebar.classList.toggle('open');
    if (window.innerWidth > 768) {
        content.classList.toggle('with-menu');
        if (!sidebar.classList.contains('open')) {
            content.classList.remove('with-menu');
        } else {
            content.classList.add('with-menu');
        }
    }
    const icon = document.querySelector('.menu-toggle i');
    if(icon) {
        if(sidebar.classList.contains('open')) {
            icon.setAttribute('data-lucide', 'x');
        } else {
            icon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons();
    }
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('profile-img');
            if(img) img.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function showModal(title, text, callback = null) {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    modal.style.display = 'flex';

    document.getElementById('modal-btn').onclick = () => {
        modal.style.display = 'none';
        if(callback) callback();
    };
}
