import { supabase } from "../supabaseClient.js";

export async function getUnlockedCategories(characterId, allQuests, userClaims) {
    const unlocked = new Set(["Uncategorized"]);

    const categoryProgress = {};
    if (characterId && userClaims) {
        userClaims.forEach(claim => {
            const quest = allQuests.find(q => q.id === claim.quest_id);
            if (quest && quest.category) {
                categoryProgress[quest.category] = (categoryProgress[quest.category] || 0) + 1;
            }
        });
    }

    allQuests.forEach(q => {
        const cat = q.category || "Uncategorized";
        const reqCat = q.unlock_prerequisite_category;
        const reqCount = q.unlock_required_count || 0;

        if (!reqCat || reqCat === "") {
            unlocked.add(cat);
        } else if (categoryProgress[reqCat] >= reqCount) {
            unlocked.add(cat);
        }
    });

    if (characterId) {
        const { data: dbUnlocks } = await supabase
            .from("user_unlocked_categories")
            .select("category_name")
            .eq("character_id", characterId);
        
        if (dbUnlocks) {
            dbUnlocks.forEach(u => unlocked.add(u.category_name));
        }
    }

    return Array.from(unlocked);
}

export async function processSecretUnlock(fullIds, userId) {
    const SECRET_CODES = {
        "CROWN-WEAPONS-SHIELD": {
            target: "Legendary Armaments",
            message: "You have discovered the records of the Ancient Kings."
        }
    };

    const signNames = fullIds.map(id => id.split('_').slice(1).join('_').toUpperCase());
    const sequenceKey = signNames.join("-");
    
    const unlock = SECRET_CODES[sequenceKey];
    if (unlock && userId) {
        await supabase
            .from("user_unlocked_categories")
            .upsert({ characterId: characterId, category_name: unlock.target });
        return unlock;
    }
    return null;
}

export function applyLockStyles(element, statusContainer = null) {
    element.classList.add("opacity-40", "cursor-not-allowed", "bg-black/40", "grayscale-[0.5]");
    element.classList.remove("hover:bg-white/5", "cursor-pointer");
    element.onclick = (e) => {
        e.stopPropagation();
    };

    const lockHtml = `
        <div class="flex items-center gap-2 bg-black/30 px-2 py-0.5 rounded-full border border-gray-700/50">
            <span class="text-[9px] text-gray-400 font-bold tracking-tighter uppercase">Locked</span>
            <i class="fa-solid fa-lock text-[9px] text-[#FFD700]/70"></i>
        </div>
    `;

    if (statusContainer) {
        statusContainer.innerHTML = lockHtml;
    } else {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = lockHtml;
        element.appendChild(wrapper.firstElementChild);
    }
}