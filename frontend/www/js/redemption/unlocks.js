import { supabase } from "../supabaseClient.js";

export async function getUnlockedCategories(characterId, allQuests, userClaims) {
    const unlocked = new Set(["Uncategorized", "The First Steps: Beginner's Guide"]);
    const categoryProgress = {};
    const claimedCategories = new Set();

    const { data: categories } = await supabase
        .from("quest_categories")
        .select("name, is_secret");
    
    const secretCategoryNames = new Set(
        categories?.filter(c => c.is_secret).map(c => c.name) || []
    );

    if (characterId) {
        const { data: dbUnlocks } = await supabase
            .from("user_unlocked_categories")
            .select("category_name")
            .eq("character_id", characterId);
        
        if (dbUnlocks) {
            dbUnlocks.forEach(u => {
                unlocked.add(u.category_name);
            });
        }
    }

    const questMap = new Map(allQuests.map(q => [q.id, q]));

    if (characterId && userClaims) {
        userClaims.forEach(claim => {
            const quest = questMap.get(claim.quest_id);
            if (quest && quest.category) {
                categoryProgress[quest.category] = (categoryProgress[quest.category] || 0) + 1;
                claimedCategories.add(quest.category);
            }
        });
    }

    allQuests.forEach(q => {
        const cat = q.category || "Uncategorized";
        
        if (secretCategoryNames.has(cat)) {
            if (unlocked.has(cat)) {
                return;
            } else {
                return;
            }
        }

        const reqCat = q.unlock_prerequisite_category;
        const reqCount = q.unlock_required_count || 0;

        if (!reqCat || reqCat === "") {
            unlocked.add(cat);
        } else if (categoryProgress[reqCat] >= reqCount) {
            unlocked.add(cat);
        }
    });

    claimedCategories.forEach(cat => unlocked.add(cat));

    return Array.from(unlocked);
}

export async function processSecretUnlock(selectedSigns, userId, characterId) {
    const { data: secretConfigs } = await supabase
        .from("secret_unlock_configs")
        .select("*");

    const sequenceKey = selectedSigns.join("-").toLowerCase();
    const unlock = secretConfigs?.find(c => c.unlock_sequence === sequenceKey);

    if (unlock && userId && characterId) {
        const { error } = await supabase
            .from("user_unlocked_categories")
            .upsert({ 
                user_id: userId,
                character_id: characterId, 
                category_name: unlock.category_name 
            }, { onConflict: 'character_id, category_name' });
            
        if (error) throw error;
        return {
            target: unlock.category_name,
            message: unlock.discovery_message
        };
    }
    return null;
}

export function applyLockStyles(element, statusContainer = null) {
    element.classList.add("opacity-40", "cursor-pointer", "bg-black/40", "grayscale-[0.5]");
    element.classList.remove("hover:bg-white/5");
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