import { supabase } from "../supabaseClient.js";

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const selected = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

function getCipherShift(word) {
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 5;
}

async function loadSigns() {
    const response = await fetch('frontend/www/assets/signs.json');
    const data = await response.json();
    const { baseUrl, version } = data.config;

    data.categories.forEach(category => {
        category.items.forEach(itemName => {
            const fullId = `${category.id}_${itemName}`;
            const btn = document.createElement("button");
            btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#72e0cc] transition-all";

            const img = document.createElement("img");
            img.src = `${baseUrl}${fullId}.webp?${version}`;
            img.className = "w-22 h-20 pointer-events-none";
            img.onerror = () => btn.remove();

            btn.appendChild(img);
            btn.onclick = () => {
                if (selected.length < 5) {
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
        img.className = "w-20 h-20 bg-gray-700 rounded p-1 border border-gray-500 shadow-md";

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "×";
        removeBtn.className = "absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity";

        removeBtn.onclick = (e) => {
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
    const { data, error } = await supabase
        .from("cipher_quests")
        .select("*")
        .eq("active", true);
    if (error) console.error(error);
    return data || [];
}

function showNotification(message, type = "error") {
    const errorMsg = document.getElementById("error-msg");
    errorMsg.textContent = message;
    errorMsg.className = `p-4 rounded-lg mb-4 flex justify-center items-center mx-auto w-[30rem] text-lg font-bold text-center ${
        type === "error" ? "bg-red-900/50 text-red-200 border border-red-700" : "bg-[#72e0cc]/20 text-[#72e0cc] border border-[#72e0cc]/50"
    }`;
    errorMsg.classList.remove("hidden");
    
    setTimeout(() => {
        errorMsg.classList.add("fade-out");
        setTimeout(() => {
            errorMsg.classList.add("hidden");
            errorMsg.classList.remove("fade-out");
        }, 500);
    }, 5000);
}

function showQuestModal(quest) {
    const modal = document.getElementById("quest-modal");
    const modalWrapper = document.getElementById("quest-modal-content");
    
    const signHtml = selected.map(fullId => {
        const parts = fullId.split('_');
        const itemName = parts.slice(1).join('_');
        const imgElement = document.querySelector(`img[src*="${fullId}"]`);
        const imgSrc = imgElement ? imgElement.src : "";
        return `<img src="${imgSrc}" class="w-16 h-16 bg-gray-900 rounded-lg p-1.5 border-2 border-gray-600 shadow-md transition-transform hover:scale-110" title="${itemName.replace(/_/g, ' ')}">`;
    }).join("");

    const itemsStr = quest.items ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : 'None';

    modalWrapper.innerHTML = `
        <div class="relative h-32 bg-gradient-to-r from-[#72e0cc]/20 to-[#FFD700]/20 flex items-center px-8 border-b border-gray-700">
            <h2 id="modal-quest-name" class="text-3xl font-bold text-white">${quest.quest_name}</h2>
            <button onclick="document.getElementById('quest-modal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="p-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h4 class="text-[#FFD700] uppercase text-md font-bold tracking-widest mb-2">Lore & Description</h4>
                    <p class="text-gray-300 italic leading-relaxed mb-6 whitespace-pre-line">"${quest.lore || 'No lore available.'}"</p>
                    <h4 class="text-[#FFD700] uppercase text-md font-bold tracking-widest mb-2">Location Hints</h4>
                    <p class="text-gray-300 mb-6 whitespace-pre-line">${quest.location || 'Location details are hidden.'}</p>
                </div>
                <div class="space-y-6">
                    <div>
                        <h4 class="text-[#FFD700] uppercase text-md font-bold tracking-widest mb-3">Sign Sequence</h4>
                        <div class="flex flex-wrap gap-2 p-4 bg-black/30 rounded-2xl border border-gray-700">
                            ${signHtml}
                        </div>
                    </div>
                    <div class="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                        <h4 class="text-[#FFD700] uppercase text-md font-bold tracking-widest mb-2">Rewards</h4>
                        <div class="text-white font-medium mb-1">${itemsStr}</div>
                        <div class="text-[#ecaf48] font-bold text-xl">${quest.gold || 0} Gold</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="p-6 bg-black/20 border-t border-gray-700 flex justify-end gap-4">
            <button onclick="document.getElementById('quest-modal').classList.add('hidden')" class="px-6 py-3 rounded-full text-gray-400 font-bold hover:text-white transition-all">Close</button>
            <button id="confirm-claim-btn" class="bg-[#FFD700] text-black px-8 py-3 rounded-full font-bold hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-900/20">Claim Rewards</button>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("confirm-claim-btn").onclick = () => handleClaim(quest);
}

async function handleClaim(quest) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showNotification("Authentication required.");
        return;
    }
    if (quest.created_by === user.id) {
        showNotification("You cannot claim your own quest rewards.");
        return;
    }
    const { data: existingClaim } = await supabase.from("user_claims").select("*").eq("quest_id", quest.id).eq("user_id", user.id).maybeSingle();
    if (existingClaim) {
        showNotification("Already claimed.");
        return;
    }
    const { error } = await supabase.from("user_claims").insert({ quest_id: quest.id, user_id: user.id });
    if (error) {
        showNotification("Claim failed.");
    } else {
        document.getElementById("quest-modal").classList.add("hidden");
        document.getElementById("input-section").classList.add("hidden");
        const successState = document.getElementById("success-state");
        successState.innerHTML = `
            <div class="text-center py-10">
                <div class="w-20 h-20 bg-[#72e0cc]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i class="fa-solid fa-check text-4xl text-[#72e0cc]"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Quest Redeemed!</h2>
                <div class="flex flex-col gap-3 max-w-xs mx-auto mt-8">
                    <a href="quests.html" class="w-full py-3 bg-[#72e0cc] text-black font-bold rounded-xl text-center">BACK TO QUESTS</a>
                    <button onclick="location.reload()" class="text-xs text-gray-500 font-bold uppercase">Redeem Another</button>
                </div>
            </div>
        `;
        successState.classList.remove("hidden");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const { baseUrl, version } = await loadSigns();
    const verifyBtn = document.getElementById("verify-btn");
    const quests = await fetchQuests();

    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        updateSelected(baseUrl, version);
        document.getElementById("error-msg").classList.add("hidden");
    };

    verifyBtn.addEventListener("click", async () => {
        const playerKey = selected.map(id => id.split('_').slice(1).join('_')).join(",").toLowerCase();
        const selectedKeyword = document.getElementById("cipher-keyword-select").value;
        
        if (!playerKey) {
            showNotification("Please select sequence.");
            return;
        }

        const matchedQuest = quests.find(q => q.reward_key.toLowerCase() === playerKey && q.cipher_keyword === selectedKeyword);

        if (!matchedQuest) {
            showNotification("Incorrect sequence or keyword.");
            return;
        }

        const { count: claimCount } = await supabase.from("user_claims").select("*", { count: "exact", head: true }).eq("quest_id", matchedQuest.id);
        if (matchedQuest.max_claims && claimCount >= matchedQuest.max_claims) {
            showNotification("Claim limit reached.");
            return;
        }

        showQuestModal(matchedQuest);
    });
});