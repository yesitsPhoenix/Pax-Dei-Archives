import { questState } from "../redemption/questStateManager.js";

const ARCHETYPE_STYLES = `
    .archetype-circle-container { position: relative; width: 800px; height: 800px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .archetype-node { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); cursor: pointer; z-index: 20; }
    .archetype-node.active-pos { left: calc(50% + (var(--x) * 320px)); top: calc(50% + (var(--y) * 320px)); }
    .archetype-node.center-focus { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(1.6); z-index: 100; }
    .node-inner { width: 110px; height: 110px; border-radius: 50%; background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border: 2px solid rgba(255, 215, 0, 0.2); display: flex; align-items: center; justify-content: center; transition: all 0.4s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .node-inner i { color: #FFD700; font-size: 2.8rem; }
    .hidden-node { opacity: 0; pointer-events: none; transform: translate(-50%, -50%) scale(0.2); }
    .monogram-glow { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.1)); animation: pulse 8s infinite ease-in-out; }
    @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.05); } }
`;

export async function loadArchetypeBanner(characterId) {
    const banner = document.getElementById('archetype-banner');
    const bannerEmpty = document.getElementById('archetype-banner-empty');
    if (!banner || !bannerEmpty) return;

    try {
        const character = questState.getActiveCharacter();

        if (!character || !character.archetype) {
            banner.classList.add('hidden');
            bannerEmpty.classList.remove('hidden');
            return;
        }

        const response = await fetch(`backend/data/json/archetypes.json?v=${new Date().getTime()}`);
        const archetypes = await response.json();
        const archData = archetypes.find(a => a.name === character.archetype);

        const claims = questState.getUserClaims();
        const categories = questState.getCategories();

        let categoryActiveMap = {};
        claims.forEach(claim => {
            const quest = questState.getQuestById(claim.quest_id);
            if (quest?.category) {
                categoryActiveMap[quest.category] = true;
            }
        });

        const standardCategories = categories.filter(c => !c.is_secret).map(c => c.name);
        const activeCategoryCount = standardCategories.filter(catName => categoryActiveMap[catName]).length;

        document.getElementById('banner-character-name').innerText = character.character_name;
        document.getElementById('display-archetype-name').innerText = character.archetype;
        document.getElementById('display-archetype-icon').className = archData?.icon || 'fas fa-shield-alt';
        
        document.getElementById('chapters-count-text').innerText = activeCategoryCount;
        document.getElementById('chapters-total-text').innerText = standardCategories.length;
        
        const chaptersBar = document.getElementById('chapters-progress-bar');
        if (chaptersBar) {
            const chapPerc = standardCategories.length > 0 ? (activeCategoryCount / standardCategories.length) * 100 : 0;
            chaptersBar.style.width = `${chapPerc}%`;
        }

        banner.classList.remove('hidden');
        bannerEmpty.classList.add('hidden');

    } catch (err) {
        console.error("Banner Logic Exception:", err);
    }
}

export async function initArchetypeSelection(containerId) {
    if (!document.getElementById('arch-shared-styles')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'arch-shared-styles';
        styleSheet.innerText = ARCHETYPE_STYLES;
        document.head.appendChild(styleSheet);
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(`backend/data/json/archetypes.json?v=${new Date().getTime()}`);
        const archetypes = await response.json();

        container.innerHTML = '';
        archetypes.forEach((arch, i) => {
            const angle = (i * 2 * Math.PI) / archetypes.length;
            const node = document.createElement('div');
            node.className = 'archetype-node active-pos';
            node.style.setProperty('--x', Math.cos(angle));
            node.style.setProperty('--y', Math.sin(angle));
            node.innerHTML = `
                <div class="node-inner"><i class="${arch.icon}"></i></div>
                <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-md font-bold tracking-widest uppercase text-gray-400 node-label transition-opacity duration-300">${arch.name}</div>
            `;
            node.onclick = () => openDetail(node, arch);
            container.appendChild(node);
        });
    } catch (err) {
        console.error("[ArchetypeUI] Arch load error:", err);
    }
}

function openDetail(selectedNode, data) {
    const modal = document.getElementById('archetype-modal');
    const modalBox = document.getElementById('modal-box');
    const instructionText = document.getElementById('selection-instruction');
    const allNodes = document.querySelectorAll('.archetype-node');
    
    if (instructionText) instructionText.classList.add('opacity-0', '-translate-y-8');
    
    allNodes.forEach(node => { if (node !== selectedNode) node.classList.add('hidden-node'); });
    selectedNode.classList.remove('active-pos');
    selectedNode.classList.add('center-focus');
    const label = selectedNode.querySelector('.node-label');
    if (label) label.style.opacity = '0';

    setTimeout(() => {
        const titleEl = document.getElementById('modal-title');
        const descEl = document.getElementById('modal-desc');
        const iconEl = document.getElementById('modal-icon-display');

        if (titleEl) titleEl.innerText = data.name;
        if (descEl) descEl.innerText = data.desc;
        if (iconEl) iconEl.innerHTML = `<i class="${data.icon} text-5xl text-[#FFD700]"></i>`;
        
        const skillsContainer = document.getElementById('modal-skills');
        if (skillsContainer) {
            const gatheringList = ["Skinning", "Mining", "Foraging", "Woodchopping"];
            const gatheringSkills = (data.skills || []).filter(s => gatheringList.includes(s));
            const craftingSkills = (data.skills || []).filter(s => !gatheringList.includes(s));
            let html = '';
            
            if (gatheringSkills.length > 0) {
                html += `
                    <div class="mb-6">
                        <h4 class="text-[12px] uppercase tracking-[0.2em] text-emerald-500 font-black mb-2">Gathering Skills</h4>
                        <div class="flex flex-wrap gap-2">
                            ${gatheringSkills.map(s => `<span class="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-md text-emerald-400 font-bold uppercase">${s}</span>`).join('')}
                        </div>
                    </div>`;
            }

            if (craftingSkills.length > 0) {
                html += `
                    <div>
                        <h4 class="text-[12px] uppercase tracking-[0.2em] text-amber-500 font-black mb-2">Crafting Disciplines</h4>
                        <div class="flex flex-wrap gap-2">
                            ${craftingSkills.map(s => `<span class="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-md text-amber-400 font-bold uppercase">${s}</span>`).join('')}
                        </div>
                    </div>`;
            }
            skillsContainer.innerHTML = html;
        }

        const featsContainer = document.getElementById('modal-feats');
        if (featsContainer) {
            featsContainer.innerHTML = (data.feats && data.feats.length > 0) 
                ? data.feats.map(f => `<div class="mb-2">• ${f}</div>`).join('')
                : "Select this path to begin unlocking unique progression quests.";
        }

        const commitBtn = document.getElementById('commit-path-btn');
        if (commitBtn) {
            commitBtn.onclick = async () => {
                const charId = questState.getActiveCharacterId();
                const user = questState.getUser();
                if (!user || !charId) return;

                const newArchetype = data.name;
                const newCategory = `Archetype: ${newArchetype}`;

                try {
                    await questState.setCharacterArchetype(newArchetype, charId);

                    const { supabase } = await import("../supabaseClient.js");
                    
                    await supabase
                        .from('user_unlocked_categories')
                        .delete()
                        .eq('character_id', charId)
                        .ilike('category_name', 'Archetype: %');

                    await supabase
                        .from('user_unlocked_categories')
                        .insert([{
                            user_id: user.id,
                            character_id: charId,
                            category_name: newCategory
                        }]);

                    window.location.href = 'quests.html';
                } catch (error) {
                    console.error('Error setting archetype:', error);
                }
            };
        }

        const closeXBtn = document.getElementById('close-modal');
        const cancelBtn = document.getElementById('cancel-btn');
        if (closeXBtn) closeXBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;

        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => { 
                modal.classList.add('opacity-100'); 
                if (modalBox) {
                    modalBox.classList.remove('scale-95');
                    modalBox.classList.add('scale-100'); 
                }
            }, 10);
        }
    }, 800);
}

export function closeModal() {
    const modal = document.getElementById('archetype-modal');
    const modalBox = document.getElementById('modal-box');
    const instructionText = document.getElementById('selection-instruction');
    const overlay = document.getElementById('archetype-selection-overlay');
    
    if (modal) {
        modal.classList.remove('opacity-100');
        if (modalBox) {
            modalBox.classList.remove('scale-100');
            modalBox.classList.add('scale-95');
        }
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    if (overlay) {
        overlay.classList.add('hidden');
    }

    if (instructionText) {
        instructionText.classList.remove('opacity-0', '-translate-y-8');
        instructionText.classList.add('opacity-100', 'translate-y-0');
    }
    
    const allNodes = document.querySelectorAll('.archetype-node');
    allNodes.forEach(node => {
        node.classList.remove('hidden-node', 'center-focus');
        node.classList.add('active-pos');
        const label = node.querySelector('.node-label');
        if (label) label.style.opacity = '1';
    });
}