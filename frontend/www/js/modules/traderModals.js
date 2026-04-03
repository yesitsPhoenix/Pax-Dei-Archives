import {
    showAddListingModalBtn,
    addListingModal,
    closeAddListingModalBtn,
    addListingFormModal
} from './dom.js';

function setupAddListingModal() {
    if (showAddListingModalBtn) {
        showAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.remove('hidden');
            }
            if (addListingFormModal) {
                addListingFormModal.reset();
            }
        });
    }

    if (closeAddListingModalBtn) {
        closeAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.add('hidden');
            }
        });
    }

    if (addListingModal) {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !addListingModal.classList.contains('hidden')) {
                addListingModal.classList.add('hidden');
            }
        });
    }
}

function setupValleyPresenceModal() {
    const modal = document.getElementById('valleyPresenceModal');
    const closeBtn = document.getElementById('valleyPresenceModalClose');
    const closeBtn2 = document.getElementById('valleyPresenceModalClose2');
    if (!modal) return;

    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    closeBtn2?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
}

function setupQuickGuideModal() {
    const modal = document.getElementById('quickGuideModal');
    const openBtn = document.getElementById('quick-guide-btn');
    const closeBtn = document.getElementById('quickGuideClose');
    const closeBtn2 = document.getElementById('quickGuideClose2');
    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn2?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.add('hidden');
    });
}

function setupAvatarIdGuideModal() {
    const modal = document.getElementById('avatarIdGuideModal');
    const openBtn = document.getElementById('avatar-id-guide-btn');
    const closeBtn = document.getElementById('avatarIdGuideClose');
    const closeBtn2 = document.getElementById('avatarIdGuideClose2');
    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn2?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.add('hidden');
    });
}

export function initializeTraderModals() {
    setupAddListingModal();
    setupValleyPresenceModal();
    setupQuickGuideModal();
    setupAvatarIdGuideModal();
}
