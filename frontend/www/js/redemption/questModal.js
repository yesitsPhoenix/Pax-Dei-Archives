export function initQuestModal() {
    const modal = document.getElementById('quest-modal');
    const closeBtn = document.getElementById('close-quest-modal');
    const expandBtn = document.getElementById('expand-quest-details');

    if (!expandBtn || !modal) return;

    expandBtn.onclick = () => {
        const titleEl = document.getElementById('detail-name');
        // Extract text content whether it's plain text or has HTML (crown icon)
        const title = titleEl.textContent || titleEl.innerText;
        const region = document.getElementById('detail-region').innerText;
        const lore = document.getElementById('detail-lore').innerHTML;
        const location = document.getElementById('detail-location').innerHTML;
        const items = document.getElementById('detail-items').innerText;
        const gold = document.getElementById('detail-gold').innerText;
        const signs = document.getElementById('detail-signs').innerHTML;
        const status = document.getElementById('detail-status-badge').innerHTML;
        const prerequisites = document.getElementById('detail-prerequisites').innerHTML;
        const hardLocks = document.getElementById('detail-hard-locks').innerHTML;
        
        // Check if quest has rewards
        const rewardsSection = document.querySelector('section:has(#detail-rewards-section)');
        const hasRewards = rewardsSection && rewardsSection.style.display !== 'none';
        
        // Check if quest has sign sequence
        const signSection = document.querySelector('section:has(#detail-signs)');
        const hasSignSequence = signSection && signSection.style.display !== 'none';
        
        // Get the complete quest redeem button HTML
        const redeemBtn = document.getElementById('detail-redeem-btn');
        const redeemBtnHTML = redeemBtn ? redeemBtn.outerHTML : '';

        // Copy the title with crown icon if it exists
        const modalTitle = document.getElementById('modal-quest-title');
        if (titleEl.querySelector('.capstone-crown-icon')) {
            modalTitle.innerHTML = titleEl.innerHTML;
        } else {
            modalTitle.innerText = title;
        }
        document.getElementById('modal-quest-region').innerText = region;
        document.getElementById('modal-quest-status').innerHTML = status;
        
        document.getElementById('modal-quest-body').innerHTML = `
            <div class="lg:col-span-2 space-y-6">
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">The Tale</h4>
                    <div class="text-gray-300 leading-relaxed text-md">
                        ${lore}
                    </div>
                </section>
            </div>
            <div class="lg:col-span-1 space-y-6">
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Quest Fulfillment</h4>
                    <div class="bg-black/20 p-4 rounded-xl border border-gray-700/50 text-gray-300 text-md">
                        ${location}
                    </div>
                </section>
                ${hasSignSequence ? `
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Sign Sequence</h4>
                    <div class="flex flex-wrap gap-2 p-4 bg-black/30 rounded-xl border border-gray-700/50">
                        ${signs}
                    </div>
                </section>
                ` : ''}
                ${hasRewards ? `
                <section> 
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Rewards</h4>
                    <div class="bg-black/20 p-4 rounded-xl border border-gray-700/50">
                        <div class="text-white font-medium mb-1 text-md">${items}</div>
                        <div class="text-[#ecaf48] font-bold text-xl">${gold}</div>
                    </div>
                </section>
                ` : ''}
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Required to Unlock</h4>
                    <div id="modal-hard-locks" class="bg-black/20 p-4 rounded-xl border border-gray-700/50 flex flex-col gap-1">
                        ${hardLocks}
                    </div>
                </section>
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Required to Complete</h4>
                    <div id="modal-prerequisites" class="bg-black/20 p-4 rounded-xl border border-gray-700/50 flex flex-col gap-1">
                        ${prerequisites}
                    </div>
                </section>
                <section>
                    <div class="flex justify-end pt-4">
                        ${redeemBtnHTML}
                    </div>
                </section>
            </div>
        `;

        // Re-attach event listeners for prerequisite links
        document.getElementById('modal-quest-body').querySelectorAll('.prereq-link').forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.getAttribute('data-quest-id');
                
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                document.body.style.overflow = 'auto';

                if (window.allQuests && typeof window.showQuestDetails === 'function') {
                    const targetQuest = window.allQuests.find(q => q.id === targetId);
                    if (targetQuest) {
                        const isClaimed = window.userClaims ? window.userClaims.some(c => c.quest_id === targetQuest.id) : false;
                        window.showQuestDetails(targetQuest, isClaimed);
                        const detailsPanel = document.getElementById('details-content');
                        if (detailsPanel) detailsPanel.scrollTop = 0;
                    }
                }
            };
        });
        
        // Re-attach event listeners for hard lock links
        document.getElementById('modal-quest-body').querySelectorAll('.hard-lock-link').forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.getAttribute('data-quest-id');
                
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                document.body.style.overflow = 'auto';

                if (window.allQuests && typeof window.showQuestDetails === 'function') {
                    const targetQuest = window.allQuests.find(q => q.id === targetId);
                    if (targetQuest) {
                        const isClaimed = window.userClaims ? window.userClaims.some(c => c.quest_id === targetQuest.id) : false;
                        window.showQuestDetails(targetQuest, isClaimed);
                        const detailsPanel = document.getElementById('details-content');
                        if (detailsPanel) detailsPanel.scrollTop = 0;
                    }
                }
            };
        });
        
        // Re-attach the Complete Quest button's onclick handler
        const modalRedeemBtn = document.getElementById('modal-quest-body').querySelector('#detail-redeem-btn');
        if (modalRedeemBtn && redeemBtn) {
            modalRedeemBtn.onclick = redeemBtn.onclick;
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    };

    closeBtn.onclick = closeModal;
    window.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}
