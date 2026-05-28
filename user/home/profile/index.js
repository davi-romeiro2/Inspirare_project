lucide.createIcons();

let originalEmail = '';
let isEditing = false;

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

// Password modal functions
function showPasswordModal(onConfirm) {
    const modal = document.getElementById('password-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const input = document.getElementById('password-input');
    input.value = '';
    document.getElementById('password-confirm').onclick = () => {
        const pwd = input.value.trim();
        if (pwd === '') {
            showModal('Erro', 'Senha não pode estar vazia.');
            return;
        }
        hidePasswordModal();
        if (onConfirm) onConfirm();
    };
    document.getElementById('password-cancel').onclick = () => {
        hidePasswordModal();
    };
}

function hidePasswordModal() {
    const modal = document.getElementById('password-modal');
    if (modal) modal.style.display = 'none';
}

// Edit profile functionality
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.profile-form');
    const editBtn = document.querySelector('.edit-profile-btn');
    const inputs = form.querySelectorAll('input[required]');
    const saveBtn = form.querySelector('.btn-save-profile');

    // Store original email
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput) {
        originalEmail = emailInput.value;
    }

    editBtn.addEventListener('click', () => {
        isEditing = !isEditing;
        if (isEditing) {
            // Enable inputs and save button
            inputs.forEach(input => input.disabled = false);
            saveBtn.disabled = false;
            editBtn.classList.add('active');
        } else {
            // Disable inputs and save button, revert values
            inputs.forEach(input => input.disabled = true);
            saveBtn.disabled = true;
            editBtn.classList.remove('active');
            // Reset form values to original
            form.reset();
            // Restore original email specifically
            if (emailInput) emailInput.value = originalEmail;
            lucide.createIcons(); // refresh icons after reset
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isEditing) return;

        const newEmail = emailInput ? emailInput.value.trim() : '';
        const emailChanged = newEmail !== originalEmail;

        if (emailChanged) {
            // Ask for password confirmation via modal
            showPasswordModal(() => {
                // Password confirmed (non-empty)
                showModal('Perfil Atualizado', 'Seu perfil foi atualizado com sucesso! (e-mail alterado)');
                // After saving, disable editing mode
                finishEditing();
                // Update original email to new value
                if (emailInput) originalEmail = newEmail;
            });
        } else {
            showModal('Perfil Atualizado', 'Seu perfil foi atualizado com sucesso!');
            finishEditing();
        }
    });

    function finishEditing() {
        inputs.forEach(input => input.disabled = true);
        saveBtn.disabled = true;
        isEditing = false;
        editBtn.innerHTML = '<i data-lucide="edit"></i> Editar';
        lucide.createIcons();
    }

    // Delete profile functionality
    const deleteBtn = document.getElementById('btn-delete-profile');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            showDeleteModal();
        });
    }
});

// Delete modal functions
function showDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('delete-confirm');
    const cancelBtn = document.getElementById('delete-cancel');

    // Reset handlers to avoid duplicates
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newConfirm.addEventListener('click', () => {
        hideDeleteModal();
        // Simulate deletion — redirect after short delay
        showModal('Perfil Deletado', 'Seu perfil foi removido com sucesso. Você será redirecionado...', () => {
            window.location.href = '/login/index.html';
        });
    });

    newCancel.addEventListener('click', () => {
        hideDeleteModal();
    });
}

function hideDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'none';
}