export function initQuestModal() {
    const modal = document.getElementById('quest-modal');
    const closeBtn = document.getElementById('close-quest-modal');
    const expandBtn = document.getElementById('expand-quest-details');

    if (!expandBtn || !modal) return;

    expandBtn.onclick = () => {
        const title = document.getElementById('detail-name').innerText;
        const region = document.getElementById('detail-region').innerText;
        const lore = document.getElementById('detail-lore').innerHTML;
        const location = document.getElementById('detail-location').innerHTML;
        const items = document.getElementById('detail-items').innerText;
        const gold = document.getElementById('detail-gold').innerText;
        const signs = document.getElementById('detail-signs').innerHTML;
        const status = document.getElementById('detail-status-badge').innerHTML;

        document.getElementById('modal-quest-title').innerText = title;
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
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Quest Location / Detail</h4>
                    <div class="text-gray-300 text-md">
                        ${location}
                    </div>
                </section>
            </div>
            <div class="lg:col-span-1 space-y-6">
                <section>
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Sign Sequence</h4>
                    <div class="flex flex-wrap gap-2 p-4 bg-black/30 rounded-xl border border-gray-700/50">
                        ${signs}
                    </div>
                </section>
                <section> 
                    <h4 class="text-md uppercase tracking-widest text-gray-500 font-bold mb-2">Rewards</h4>
                    <div class="bg-black/20 p-4 rounded-xl border border-gray-700/50">
                        <div class="text-white font-medium mb-1 text-md">${items}</div>
                        <div class="text-[#ecaf48] font-bold text-xl">${gold}</div>
                    </div>
                </section>
            </div>
        `;

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