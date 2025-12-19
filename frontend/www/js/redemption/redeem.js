import { supabase } from "../supabaseClient.js";

const selected = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

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
            img.className = "w-full h-auto pointer-events-none";
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
        img.className = "w-12 h-12 bg-gray-700 rounded p-1 border border-gray-500 shadow-md";

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
    errorMsg.className = `p-4 rounded-lg mb-4 flex justify-center items-center mx-auto w-[30rem] text-sm font-bold text-center ${
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
    const modalContent = document.getElementById("modal-quest-details");
    
    let items = [];
    try {
        items = typeof quest.items === 'string' ? JSON.parse(quest.items) : quest.items;
    } catch (e) {
        items = Array.isArray(quest.items) ? quest.items : [];
    }
    
    modalContent.innerHTML = `
        <div class="space-y-6">
            <div class="text-center">
                <h2 class="text-2xl font-bold text-[#FFD700] mb-1">${quest.quest_name}</h2>
                <p class="text-xs text-gray-400 uppercase tracking-widest">${quest.location}</p>
            </div>
            
            <div class="bg-black/30 p-4 rounded-lg border border-gray-700">
                <p class="text-sm italic text-gray-300 leading-relaxed text-center whitespace-pre-line">"${quest.lore}"</p>
            </div>

            <div>
                <h3 class="text-xs font-bold text-[#72e0cc] uppercase mb-3 tracking-wider">Quest Spoils</h3>
                <ul id="item-list" class="space-y-2">
                    ${items.map(item => `
                        <li class="flex items-center gap-3 text-white">
                            <i class="fa-solid fa-square-check text-[#72e0cc]"></i> 
                            ${item}
                        </li>
                    `).join('')}
                </ul>
                <div id="gold-amount" class="mt-2 font-bold text-white">
                    ${quest.gold > 0 ? `<i class="fa-solid fa-coins text-[#ecaf48] mr-2"></i>${quest.gold} Gold` : ""}
                </div>
            </div>

            <button id="confirm-claim-btn" class="w-full py-3 bg-[#72e0cc] hover:bg-[#5bc8b5] text-black font-bold rounded-xl transition-all shadow-lg uppercase tracking-widest">
                Claim Rewards
            </button>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    document.getElementById("confirm-claim-btn").onclick = () => handleClaim(quest);
}

async function handleClaim(quest) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
        showNotification("Authentication required. Please log in.");
        return;
    }

    if (quest.created_by === user.id) {
        showNotification("You cannot claim rewards for a quest you created.");
        return;
    }

    const { data: existingClaim } = await supabase
        .from("user_claims")
        .select("*")
        .eq("quest_id", quest.id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (existingClaim) {
        showNotification("You have already claimed this reward.");
        return;
    }

    const { error: insertError } = await supabase.from("user_claims").insert({
        quest_id: quest.id,
        user_id: user.id
    });

    if (insertError) {
        showNotification("Failed to process claim. Please try again.");
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
                <p class="text-gray-400 mb-8 px-4">Your claim has been recorded. You can now view this quest in your completed archives.</p>
                <div class="flex flex-col gap-3 max-w-xs mx-auto">
                    <a href="quests.html" class="w-full py-3 bg-[#72e0cc] hover:bg-[#5bc8b5] text-black font-bold rounded-xl transition-all text-center">
                        BACK TO QUESTS
                    </a>
                    <button onclick="location.reload()" class="text-xs text-gray-500 hover:text-white uppercase tracking-widest font-bold">
                        Redeem Another
                    </button>
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

    window.onclick = (event) => {
        const modal = document.getElementById("quest-modal");
        if (event.target === modal) {
            modal.classList.add("hidden");
        }
    };

    verifyBtn.addEventListener("click", async () => {
        const playerKey = selected.map(id => id.split('_').slice(1).join('_')).join(",").toLowerCase();
        
        if (!playerKey) {
            showNotification("Please select the sign sequence.");
            return;
        }

        const matchedQuest = quests.find(q => q.reward_key.toLowerCase() === playerKey);

        if (!matchedQuest) {
            showNotification("The sign sequence provided is incorrect.");
            return;
        }

        const { count: claimCount } = await supabase
            .from("user_claims")
            .select("*", { count: "exact", head: true })
            .eq("quest_id", matchedQuest.id);

        if (matchedQuest.max_claims && claimCount >= matchedQuest.max_claims) {
            showNotification("This quest has reached its maximum claim limit.");
            return;
        }

        document.getElementById("error-msg").classList.add("hidden");
        showQuestModal(matchedQuest);
    });
});