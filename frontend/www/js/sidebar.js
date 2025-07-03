import { showManageMarketStallsModal } from './modules/actions.js';

const sidebar = document.getElementById('sidebar');

document.addEventListener('DOMContentLoaded', () => {
    if (sidebar) {
        sidebar.classList.add('collapsed');

        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.remove('collapsed');
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.add('collapsed');
        });
    }

    const manageMarketStallsModal = document.getElementById('manageMarketStallsModal');
    const manageListingsBtn = document.getElementById('manageListingsBtn');
    const manageStallsBtn = document.getElementById('manageStallsBtn');
    const closeManageMarketStallsModalBtn = document.getElementById('closeManageMarketStallsModalBtn');

    if (manageListingsBtn && manageMarketStallsModal) {
        manageListingsBtn.addEventListener('click', () => {
            manageMarketStallsModal.classList.remove('hidden');
        });
    }

    if (manageStallsBtn) {
        manageStallsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showManageMarketStallsModal();
        });
    }

    if (closeManageMarketStallsModalBtn && manageMarketStallsModal) {
        closeManageMarketStallsModalBtn.addEventListener('click', () => {
            manageMarketStallsModal.classList.add('hidden');
        });
    }


    const addListingSidebarBtn = document.getElementById('addListingSidebarBtn');
    const addListingModal = document.getElementById('addListingModal');
    const closeAddListingModalBtn = document.getElementById('closeAddListingModalBtn');

    if (addListingSidebarBtn) {
        addListingSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (addListingModal) {
                addListingModal.classList.remove('hidden');
            }
        });
    }

    if (closeAddListingModalBtn && addListingModal) {
        closeAddListingModalBtn.addEventListener('click', () => {
            addListingModal.classList.add('hidden');
        });
    }

    if (addListingModal) {
        addListingModal.addEventListener('click', (e) => {
            if (e.target === addListingModal) {
                addListingModal.classList.add('hidden');
            }
        });
    }

    const recordPurchaseSidebarBtn = document.getElementById('recordPurchaseSidebarBtn');
    const recordPurchaseModal = document.getElementById('recordPurchaseModal');
    const closeRecordPurchaseModalBtn = document.getElementById('closeRecordPurchaseModalBtn');

    if (recordPurchaseSidebarBtn) {
        recordPurchaseSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (recordPurchaseModal) {
                recordPurchaseModal.classList.remove('hidden');
            }
        });
    }

    if (closeRecordPurchaseModalBtn && recordPurchaseModal) {
        closeRecordPurchaseModalBtn.addEventListener('click', () => {
            recordPurchaseModal.classList.add('hidden');
        });
    }

    if (recordPurchaseModal) {
        recordPurchaseModal.addEventListener('click', (e) => {
            if (e.target === recordPurchaseModal) {
                recordPurchaseModal.classList.add('hidden');
            }
        });
    }

    const addPveTransactionSidebarBtn = document.getElementById('addPveTransactionSidebarBtn');
    const addPveTransactionModal = document.getElementById('addPveTransactionModal');
    const closeAddPveTransactionModalBtn = document.getElementById('closeAddPveTransactionModalBtn');
    const pveBtn = document.getElementById('pveBtn');

    if (addPveTransactionSidebarBtn) {
        addPveTransactionSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (addPveTransactionModal) {
                addPveTransactionModal.classList.remove('hidden');
            } else if (pveBtn) {
                pveBtn.click();
            }
        });
    }

    if (closeAddPveTransactionModalBtn && addPveTransactionModal) {
        closeAddPveTransactionModalBtn.addEventListener('click', () => {
            addPveTransactionModal.classList.add('hidden');
        });
    }

    if (addPveTransactionModal) {
        addPveTransactionModal.addEventListener('click', (e) => {
            if (e.target === addPveTransactionModal) {
                addPveTransactionModal.classList.add('hidden');
            }
        });
    }
});