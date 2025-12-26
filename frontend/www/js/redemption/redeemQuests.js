import { supabase } from "../supabaseClient.js";
import { mouseTooltip } from "../ui/signTooltip.js";
import { initializeCharacterSystem } from "../redemption/characterManager.js";

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

function showError(msg) {
    const errorMsg = document.getElementById("error-msg");
    if (!errorMsg) return;
    errorMsg.innerText = msg;
    errorMsg.classList.remove("hidden");
}

function showSuccess(title, message) {
    const inputSection = document.getElementById("input-section");
    const successState = document.getElementById("success-state");
    if (inputSection) inputSection.classList.add("hidden");
    if (successState) {
        successState.innerHTML = `
            <div class="flex flex-col items-center gap-6">
                <div class="w-20 h-20 bg-[#FFD700]/20 rounded-full flex items-center justify-center border border-[#FFD700]/50">
                    <i class="fa-solid fa-unlock-keyhole text-4xl text-[#FFD700]"></i>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-white mb-2">${title}</h2>
                    <p class="text-gray-400">${message}</p>
                </div>
                <button onclick="location.reload()" class="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-full font-bold transition-all">
                    CONTINUE
                </button>
            </div>
        `;
        successState.classList.remove("hidden");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await initializeCharacterSystem(user.id);
        const charContainer = document.getElementById("character-container");
        if (charContainer) charContainer.classList.remove("hidden");
    }

    const { baseUrl, version } = await loadSigns();
    
    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        updateSelected(baseUrl, version);
        document.getElementById("error-msg")?.classList.add("hidden");
    };

    document.getElementById("verify-btn").onclick = async () => {
        const characterId = sessionStorage.getItem('active_character_id');
        if (!characterId) return showError("Select a character first.");
        if (selected.length === 0) return showError("Select a sequence.");

        const playerKey = selected.join(",");
        const rawKeyword = document.getElementById("cipher-keyword-select").value || "";
        const keyword = rawKeyword.toLowerCase().trim();

        const { data: secretConfigs } = await supabase.from("secret_unlock_configs").select("*");
        const secretMatch = secretConfigs?.find(c => {
            const dbSeq = (c.unlock_sequence || "").trim();
            const dbKey = (c.cipher_keyword || "").toLowerCase().trim();
            return dbSeq === playerKey && dbKey === (keyword === "none" ? "" : keyword);
        });

        if (secretMatch) {
            const { data: alreadyUnlocked } = await supabase
                .from("user_unlocked_categories")
                .select("id")
                .eq("character_id", characterId)
                .eq("category_name", secretMatch.category_name)
                .maybeSingle();

            if (alreadyUnlocked) {
                return showSuccess("Already Unlocked", "This character has already gained access to this category.");
            }

            const { error: unlockError } = await supabase.from("user_unlocked_categories").insert({
                user_id: user.id,
                character_id: characterId,
                category_name: secretMatch.category_name
            });

            if (!unlockError) {
                return showSuccess("Secret Archive Accessed", secretMatch.discovery_message || "You have unlocked a new category.");
            } else {
                return showError(unlockError.message);
            }
        }

        const { data: quests } = await supabase.from("cipher_quests").select("*").eq("active", true);
        const questMatch = quests?.find(q => {
            const dbKey = (q.reward_key || "").trim();
            const dbKeyWord = (q.cipher_keyword || "").toLowerCase().trim();
            return dbKey === playerKey && dbKeyWord === (keyword === "none" ? "" : keyword);
        });

        if (questMatch) {
            const { data: existingClaim } = await supabase.from("user_claims")
                .select("id")
                .eq("character_id", characterId)
                .eq("quest_id", questMatch.id)
                .maybeSingle();

            if (existingClaim) return showError("This character has already redeemed this quest.");

            const { error: claimError } = await supabase.from("user_claims").insert([{
                user_id: user.id,
                quest_id: questMatch.id,
                character_id: characterId
            }]);

            if (!claimError) {
                return showSuccess("Quest Deciphered", `You have successfully completed: ${questMatch.quest_name}`);
            } else {
                return showError(claimError.message);
            }
        }

        showError("The sequence or keyword provided is incorrect.");
    };
});