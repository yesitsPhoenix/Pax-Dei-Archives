import { initArchetypeSelection, closeModal } from "./archetypesUI.js";

document.addEventListener('DOMContentLoaded', () => {
    initArchetypeSelection('archetype-container');

    const cancelBtn = document.getElementById('cancel-btn');
    const closeXBtn = document.getElementById('close-modal');

    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
    }

    if (closeXBtn) {
        closeXBtn.onclick = closeModal;
    }
});