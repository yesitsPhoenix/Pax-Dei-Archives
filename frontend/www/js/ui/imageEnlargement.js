/**
 * Image Enlargement Module
 * Provides click-to-enlarge functionality for images in markdown content
 */

export function initImageEnlargement() {
    // Add markdown-content class to elements that render markdown
    const loreContainers = [
        document.getElementById('detail-lore'),
        document.getElementById('modal-quest-body')
    ];
    
    loreContainers.forEach(container => {
        if (container) {
            container.classList.add('markdown-content');
        }
    });
    
    // Add click event to all images in markdown content
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'IMG' && e.target.closest('.markdown-content')) {
            const overlay = document.getElementById('image-overlay');
            const overlayImg = document.getElementById('image-overlay-img');
            
            if (overlay && overlayImg) {
                overlayImg.src = e.target.src;
                overlayImg.alt = e.target.alt || 'Enlarged view';
                overlay.classList.add('active');
            }
        }
    });
}

export function setupImageOverlayHandlers() {
    const overlay = document.getElementById('image-overlay');
    const closeBtn = document.getElementById('image-overlay-close');
    
    if (overlay) {
        // Close overlay when clicking on the overlay background
        overlay.addEventListener('click', function(e) {
            // Only close if clicking the overlay itself, not the image
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
        
        // Also close when clicking on the image
        const overlayImg = document.getElementById('image-overlay-img');
        if (overlayImg) {
            overlayImg.addEventListener('click', function() {
                overlay.classList.remove('active');
            });
        }
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            overlay.classList.remove('active');
        });
    }
    
    // Close on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    });
}

export function observeContentChanges() {
    // Re-initialize when quest details are loaded (use MutationObserver)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                initImageEnlargement();
            }
        });
    });
    
    const detailsPane = document.getElementById('quest-details-scroll');
    const modalBody = document.getElementById('modal-quest-body');
    
    if (detailsPane) {
        observer.observe(detailsPane, { childList: true, subtree: true });
    }
    if (modalBody) {
        observer.observe(modalBody, { childList: true, subtree: true });
    }
}

// Initialize everything when DOM is ready
export function init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initImageEnlargement();
            setupImageOverlayHandlers();
            observeContentChanges();
        });
    } else {
        // DOM already loaded
        initImageEnlargement();
        setupImageOverlayHandlers();
        observeContentChanges();
    }
}

// Auto-initialize if this module is imported
init();