import { supabase } from "../supabaseClient.js";

async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error(error);
    return user;
}

async function fetchQuests() {
    const { data, error } = await supabase
        .from("cipher_quests")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
    if (error) console.error(error);
    return data || [];
}

async function fetchUserClaims(userId) {
    const { data, error } = await supabase
        .from("user_claims")
        .select("*")
        .eq("user_id", userId);
    if (error) console.error(error);
    return data || [];
}

async function renderQuests() {
    const user = await getCurrentUser();
    const quests = await fetchQuests();
    let userClaims = [];
    if (user) userClaims = await fetchUserClaims(user.id);

    const questList = document.getElementById("quest-list");
    questList.innerHTML = "";

    quests.forEach(quest => {
        const userClaimed = userClaims.some(c => c.quest_id === quest.id);
        const remainingClaims = quest.max_claims - (userClaimed ? 1 : 0);

        let items = [];
        if (quest.items) {
            if (typeof quest.items === "string") {
                try {
                    items = JSON.parse(quest.items.trim());
                } catch {
                    items = [];
                }
            } else if (Array.isArray(quest.items)) {
                items = quest.items;
            }
        }

        const card = document.createElement("div");
        card.className = "bg-gray-800 p-4 rounded shadow hover:shadow-lg transition";

        card.innerHTML = `
            <h2 class="text-lg font-semibold mb-2">${quest.quest_name}</h2>
            <p class="mb-2 text-gray-300">${quest.lore || "No description available."}</p>
            <p class="mb-1"><strong>Gold:</strong> ${quest.gold || 0}</p>
            <p class="mb-1"><strong>Items:</strong> ${items.join(", ") || "None"}</p>
            <p class="mb-1"><strong>Location:</strong> ${quest.location || "Unknown"}</p>
            <button class="claim-btn mt-2 px-4 py-2 bg-[#FFD700] text-black rounded font-semibold" ${remainingClaims <= 0 ? "disabled" : ""}>
                ${userClaimed ? "Already Claimed" : remainingClaims <= 0 ? "Full" : "Claim Quest"}
            </button>
        `;

        const claimBtn = card.querySelector(".claim-btn");
        claimBtn?.addEventListener("click", async () => {
            if (!user) {
                alert("You must be logged in to claim a quest.");
                return;
            }

            const { count: claimCount, error: countError } = await supabase
                .from("user_claims")
                .select("*", { count: "exact" })
                .eq("quest_id", quest.id);

            if (countError) {
                alert("Error checking claims: " + countError.message);
                return;
            }

            if (claimCount >= quest.max_claims) {
                alert("This quest has already reached the maximum number of claims.");
                renderQuests();
                return;
            }

            const { error } = await supabase.from("user_claims").insert({
                user_id: user.id,
                quest_id: quest.id
            });

            if (error) {
                alert("Error claiming quest: " + error.message);
            } else {
                alert("Quest successfully claimed!");
                renderQuests();
            }
        });

        questList.appendChild(card);
    });
}

supabase.auth.onAuthStateChange(() => {
    renderQuests();
});

renderQuests();
