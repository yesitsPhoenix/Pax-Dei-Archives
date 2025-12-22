import { supabase } from "../supabaseClient.js";

const selected = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

const mouseTooltip = document.createElement("div");
Object.assign(mouseTooltip.style, {
    position: "fixed",
    display: "none",
    pointerEvents: "none",
    zIndex: "9999",
    padding: "4px 8px",
    backgroundColor: "#030712",
    color: "white",
    fontSize: "10px",
    borderRadius: "4px",
    border: "1px solid #4b5563",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
});
document.body.appendChild(mouseTooltip);

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
            img.className = "w-22 h-22 pointer-events-none";
            img.onerror = () => btn.remove();

            btn.appendChild(img);
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
    const { data, error } = await supabase.from("cipher_quests").select("*").eq("active", true);
    if (error) return [];
    return data;
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

    verifyBtn.addEventListener("click", async () => {
        const playerKey = selected.map(id => id.split('_').slice(1).join('_')).join(",").toLowerCase();
        const selectedKeyword = document.getElementById("cipher-keyword-select").value.toLowerCase().trim();
        const targetQuestName = document.getElementById('modal-target-quest-name').innerText.toLowerCase().trim();
        
        if (selected.length === 0) {
            showError("Please select a sequence.");
            return;
        }

        const matchedQuest = quests.find(q => {
            const dbName = (q.quest_name ?? "").toLowerCase().trim();
            const dbKey = q.reward_key === null
                ? null
                : q.reward_key.toLowerCase().trim();
            const dbKeyword = q.cipher_keyword === null
                ? null
                : q.cipher_keyword.toLowerCase().trim();

            if (dbName !== targetQuestName) return false;
            if (dbKey !== null && dbKey !== playerKey) return false;
            if (dbKeyword !== null && dbKeyword !== selectedKeyword) return false;

            return true;
        });


        if (!matchedQuest) {
            showError("Incorrect sequence or keyword.");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showError("You must be logged in to claim rewards.");
            return;
        }

        const { count: claimCount } = await supabase
            .from("user_claims")
            .select("*", { count: "exact", head: true })
            .eq("quest_id", matchedQuest.id)
            .eq("user_id", user.id);

        if (claimCount > 0) {
            showError("You have already claimed this reward.");
            return;
        }

        const { error } = await supabase.from("user_claims").insert([
            { user_id: user.id, quest_id: matchedQuest.id }
        ]);

        if (error) {
            showError("Database error. Please try again later.");
        } else {
            document.getElementById("input-section").classList.add("hidden");
            document.getElementById("success-state").classList.remove("hidden");
        }
    });
});