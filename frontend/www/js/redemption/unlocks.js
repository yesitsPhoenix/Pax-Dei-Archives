import { questState } from "./questStateManager.js";


export async function getUnlockedCategories(characterId, allQuests, userClaims) {
    return questState.getUnlockedCategories();
}


export async function processSecretUnlock(selectedSigns, userId, characterId) {
    const secretConfigs = questState.getSecretUnlockConfigs();
    const sequenceKey = selectedSigns.join("-").toLowerCase();
    const unlock = secretConfigs?.find(c => c.unlock_sequence === sequenceKey);

    if (unlock && userId && characterId) {
        await questState.unlockSecretCategory(unlock.category_name, userId, characterId);
        
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
