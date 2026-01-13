import { questState } from "./questStateManager.js";
import { mouseTooltip } from "../ui/signTooltip.js";
import { loadArchetypeBanner } from "../archetypes/archetypesUI.js";

const selected = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

async function loadSigns() {
    const response = await fetch("frontend/www/assets/signs.json");
    const data = await response.json();
    const { baseUrl, version } = data.config;

    data.categories.forEach(category => {
        category.items.forEach(itemName => {
            const fullId = `${category.id}_${itemName}`;
            const btn = document.createElement("button");
            btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#72e0cc] transition-all relative";
            const img = document.createElement("img");
            img.src = `${baseUrl}${fullId}.webp?${version}`;
            img.className = "w-22 h-22 pointer-events-none";
            img.onerror = () => btn.remove();
            btn.appendChild(img);
            btn.onmouseenter = () => {
                mouseTooltip.innerText = itemName.replace(/-/g, " ");
                mouseTooltip.style.display = "block";
            };
            btn.onmousemove = e => {
                mouseTooltip.style.left = `${e.clientX + 15}px`;
                mouseTooltip.style.top = `${e.clientY + 15}px`;
            };
            btn.onmouseleave = () => {
                mouseTooltip.style.display = "none";
            };
            btn.onclick = () => {
                if (selected.length < 10) {
                    selected.push(fullId);
                    updateSelected(baseUrl, version);
                }
            };
            grid.appendChild(btn);
        });
    });
    return { baseUrl, version };
}

function updateSelected(baseUrl, version) {
    selectedDisplay.innerHTML = "";
    selected.forEach((fullId, index) => {
        const container = document.createElement("div");
        container.className = "relative inline-block group";
        const img = document.createElement("img");
        img.src = `${baseUrl}${fullId}.webp?${version}`;
        img.className = "w-16 h-16 bg-gray-800 rounded-lg p-1 border border-gray-600 shadow-md";
        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "×";
        removeBtn.className = "absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity";
        removeBtn.onclick = e => {
            e.stopPropagation();
            selected.splice(index, 1);
            updateSelected(baseUrl, version);
        };
        container.appendChild(img);
        container.appendChild(removeBtn);
        selectedDisplay.appendChild(container);
    });
}


const closeRedemption = document.getElementById('close-sign-redemption');
if (closeRedemption) {
    closeRedemption.onclick = () => {
        const modal = document.getElementById('sign-redemption-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
}

const closeDirect = document.getElementById('close-direct-confirm');
const cancelDirect = document.getElementById('direct-confirm-cancel');
const directModal = document.getElementById('direct-confirm-modal');

if (closeDirect) {
    closeDirect.onclick = () => {
        directModal.classList.add('hidden');
        directModal.classList.remove('flex');
    };
}

if (cancelDirect) {
    cancelDirect.onclick = () => {
        directModal.classList.add('hidden');
        directModal.classList.remove('flex');
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    const { baseUrl, version } = await loadSigns();
    const verifyBtn = document.getElementById("verify-btn");
    const errorDisplay = document.getElementById("modal-error-msg");

    const showError = (msg) => {
        if (!errorDisplay) return;
        errorDisplay.innerText = msg;
        errorDisplay.classList.remove("hidden");
        setTimeout(() => errorDisplay.classList.add("hidden"), 5000);
    };
    
    const showToast = (message, type = 'success') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col items-end';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        
        const isSuccess = type === 'success';
        const bgClass = isSuccess ? 'bg-[#0f1a11]' : 'bg-[#1a0f0f]';
        const borderClass = isSuccess ? 'border-green-900/40' : 'border-red-900/40';
        const textClass = isSuccess ? 'text-green-300' : 'text-red-300';
        const icon = isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation';

        toast.className = `mb-3 px-6 py-4 rounded-lg shadow-2xl border font-bold uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all duration-500 opacity-0 translate-y-2 ${bgClass} ${borderClass} ${textClass}`;
        
        toast.innerHTML = `
            <i class="fa-solid ${icon} text-base"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-4');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    };

    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        updateSelected(baseUrl, version);
        if (errorDisplay) errorDisplay.classList.add("hidden");
    };

    verifyBtn.addEventListener("click", async () => {
        const characterId = questState.getActiveCharacterId();
        if (!characterId) return;

        const user = questState.getUser();
        if (!user) return;
        
        const quests = questState.getAllQuests();
        if (!quests || quests.length === 0) {
            showError("Quest data not loaded. Please refresh the page.");
            return;
        }

        const playerKey = selected.join(",").toLowerCase();
        const selectedKeyword = document.getElementById("cipher-keyword-select").value.toLowerCase().trim();
        const targetQuestName = document.getElementById("modal-target-quest-name").innerText.toLowerCase().trim();

        const matchedQuest = quests.find(q => {
            const dbName = (q.quest_name ?? "").toLowerCase().trim();
            const dbKey = (Array.isArray(q.signs) ? q.signs.join(',') : "").toLowerCase().trim();
            const dbKeyword = q.cipher_keyword?.toLowerCase().trim() ?? "";
            
            const nameMatch = dbName === targetQuestName;
            const keyMatch = dbKey === "" || dbKey === playerKey;
            const keywordMatch = dbKeyword === "" || dbKeyword === selectedKeyword;
            
            return nameMatch && keyMatch && keywordMatch;
        });

        if (!matchedQuest) {
            showError("The sequence or keyword provided is incorrect.");
            return;
        }

        try {
            await questState.addClaim(matchedQuest.id, user.id, characterId);
            
            await loadArchetypeBanner(characterId);

            const modal = document.getElementById("sign-redemption-modal");
            
            if (modal) {
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }
            
            // Skip showing success modal - let quest claimed event handle UI updates
            // Show a toast notification instead
            showToast(`Quest "${matchedQuest.quest_name}" completed!`, 'success');

            selected.length = 0;
            updateSelected(baseUrl, version);
            
            window.dispatchEvent(new CustomEvent("questClaimed", { 
                detail: { quest: matchedQuest, character_id: characterId } 
            }));
        } catch (error) {
            showError(error.message);
        }
    });
});