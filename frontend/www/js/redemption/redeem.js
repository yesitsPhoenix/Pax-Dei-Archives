import { supabase } from "../supabaseClient.js";
import { mouseTooltip } from "../ui/signTooltip.js";

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

async function fetchQuests() {
    const { data, error } = await supabase.from("cipher_quests").select("*").eq("active", true);
    if (error) return [];
    return data;
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
    const quests = await fetchQuests();
    const errorDisplay = document.getElementById("modal-error-msg");

    const showError = (msg) => {
        if (!errorDisplay) return;
        errorDisplay.innerText = msg;
        errorDisplay.classList.remove("hidden");
        setTimeout(() => errorDisplay.classList.add("hidden"), 5000);
    };

    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        updateSelected(baseUrl, version);
        if (errorDisplay) errorDisplay.classList.add("hidden");
    };

    const successBtn = document.querySelector("#success-state button");
    if (successBtn) {
        successBtn.onclick = (e) => {
            e.preventDefault();
            const successModal = document.getElementById("success-state");
            successModal.classList.add("hidden");
            successModal.classList.remove("flex");
        };
    }

    verifyBtn.addEventListener("click", async () => {
        const characterId = sessionStorage.getItem('active_character_id');
        if (!characterId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const playerKey = selected.join(",").toLowerCase();
        const selectedKeyword = document.getElementById("cipher-keyword-select").value.toLowerCase().trim();
        const targetQuestName = document.getElementById("modal-target-quest-name").innerText.toLowerCase().trim();

        const matchedQuest = quests.find(q => {
            const dbName = (q.quest_name ?? "").toLowerCase().trim();
            const dbKey = (Array.isArray(q.signs) ? q.signs.join(',') : "").toLowerCase().trim();
            const dbKeyword = q.cipher_keyword?.toLowerCase().trim() ?? "";
            return dbName === targetQuestName && (dbKey === "" || dbKey === playerKey) && (dbKeyword === "" || dbKeyword === selectedKeyword);
        });

        if (!matchedQuest) {
            showError("The sequence or keyword provided is incorrect.");
            return;
        }

        const { error } = await supabase
            .from("user_claims")
            .insert([{ 
                user_id: user.id, 
                quest_id: matchedQuest.id,
                character_id: characterId 
            }]);

        if (!error) {
            const modal = document.getElementById("sign-redemption-modal");
            const successModal = document.getElementById("success-state");
            
            if (modal) {
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }
            
            if (successModal) {
                successModal.classList.remove("hidden");
                successModal.classList.add("flex", "items-center", "justify-center");
            }

            selected.length = 0;
            updateSelected(baseUrl, version);
            
            window.dispatchEvent(new CustomEvent("questClaimed", { 
                detail: { quest: matchedQuest, character_id: characterId } 
            }));
        } else {
            showError(error.message);
        }
    });
});