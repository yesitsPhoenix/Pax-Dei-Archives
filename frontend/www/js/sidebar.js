import { showManageMarketStallsModal } from './modules/actions.js';

const sidebar = document.getElementById('sidebar');

// Function to update alert badge position based on sidebar state
export function updateAlertBadgePosition() {
    // Badge positioning is now handled entirely by CSS (sidebar.css).
    // This function is kept as a no-op to avoid breaking existing callers.
}

document.addEventListener('DOMContentLoaded', () => {
    const scrollToSection = (sectionId) => {
        const target = document.getElementById(sectionId);
        if (!target) return;

        const header = document.querySelector('.header-area');
        const headerOffset = header ? header.getBoundingClientRect().height : 0;
        const extraOffset = 64;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - extraOffset;

        window.history.replaceState(null, '', `#${sectionId}`);
        window.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth'
        });
    };

    if (sidebar) {
        sidebar.classList.add('collapsed');

        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.remove('collapsed');
            updateAlertBadgePosition();
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.add('collapsed');
            updateAlertBadgePosition();
        });
        
        // Initial update
        updateAlertBadgePosition();
    }

    const manageMarketStallsModal = document.getElementById('manageMarketStallsModal');
    const manageListingsBtn = document.getElementById('manageListingsBtn');
    const manageStallsBtn = document.getElementById('manageStallsBtn');
    const closeManageMarketStallsModalBtn = document.getElementById('closeManageMarketStallsModalBtn');
    const sidebarDashboardLink = document.getElementById('sidebarDashboardLink');
    const sidebarActiveListingsLink = document.getElementById('sidebarActiveListingsLink');
    const sidebarTransactionHistoryLink = document.getElementById('sidebarTransactionHistoryLink');

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

    sidebarDashboardLink?.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('dashboard-anchor');
    });

    sidebarActiveListingsLink?.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('active-listings-anchor');
    });

    sidebarTransactionHistoryLink?.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('transaction-history-anchor');
    });


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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !addListingModal.classList.contains('hidden')) {
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !recordPurchaseModal.classList.contains('hidden')) {
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !addPveTransactionModal.classList.contains('hidden')) {
                addPveTransactionModal.classList.add('hidden');
            }
        });
    }
});
