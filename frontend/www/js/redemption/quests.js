import { questState } from "./questStateManager.js";
import { getUnlockedCategories, applyLockStyles } from "./unlocks.js";
import { enableSignTooltip } from '../ui/signTooltip.js';
import { initQuestModal } from './questModal.js';
import { initializeCharacterSystem, fetchCharacters } from './characterManager.js';


let allQuests = [];
let regionsData = [];
let userClaims = [];
let activeQuestKey = null;
let collapsedCategories = new Set();
let questCounters = {};

function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-[300] flex flex-col items-end pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    const isError = type === 'error';
    const bgClass = isError ? 'bg-[#1a0f0f]' : 'bg-[#0f1a11]';
    const borderClass = isError ? 'border-red-900/40' : 'border-green-900/40';
    const textClass = isError ? 'text-red-300' : 'text-green-300';
    const icon = isError ? 'fa-triangle-exclamation' : 'fa-circle-check';

    toast.className = `pointer-events-auto mb-3 px-6 py-4 rounded-lg shadow-2xl border font-bold uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all duration-500 opacity-0 translate-y-2 ${bgClass} ${borderClass} ${textClass}`;
    
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
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col items-end';
    document.body.appendChild(container);
    return container;
}

// Quest Counter System - Disabled for now
function parseQuestCounters(quest) {
    return null; // Counters temporarily disabled
}

function loadQuestCounters() {
    const stored = localStorage.getItem('questCounters');
    if (stored) {
        try {
            questCounters = JSON.parse(stored);
        } catch (e) {
            questCounters = {};
        }
    }
}

function saveQuestCounters() {
    localStorage.setItem('questCounters', JSON.stringify(questCounters));
}

function updateQuestCounter(questId, counterId, value) {
    if (!questCounters[questId] || !questCounters[questId][counterId]) return;
    questCounters[questId][counterId].current = Math.min(Math.max(0, value), questCounters[questId][counterId].target);
    saveQuestCounters();
    
    // Update all instances of the counter (both in detail pane and modal)
    const counterWidgets = document.querySelectorAll(`.quest-counter-widget[data-quest-id="${questId}"]`);
    counterWidgets.forEach(widget => {
        const newHTML = renderCountersUI(questId);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHTML;
        widget.replaceWith(tempDiv.firstElementChild);
    });
}

function renderCountersUI(questId) {
    const counters = questCounters[questId];
    if (!counters || counters.length === 0) return '';
    
    const allComplete = counters.every(c => c.current >= c.target);
    
    const countersHTML = counters.map(counter => {
        const isComplete = counter.current >= counter.target;
        const percentage = (counter.current / counter.target) * 100;
        
        const actionVerb = {
            'kill': 'Slain',
            'collect': 'Collected',
            'gather': 'Gathered',
            'craft': 'Crafted',
            'refine': 'Refined'
        }[counter.type] || 'Progress';
        
        return `
            <div class="bg-black/20 border ${isComplete ? 'border-green-500/30' : 'border-gray-700/50'} rounded-lg p-2.5 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] uppercase tracking-widest font-bold ${isComplete ? 'text-green-400' : 'text-gray-400'}">
                        ${actionVerb}: ${counter.name}
                    </span>
                    <span class="text-sm font-bold ${isComplete ? 'text-green-400' : 'text-[#FFD700]'}">
                        ${counter.current} / ${counter.target}
                    </span>
                </div>
                <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div class="${isComplete ? 'bg-green-500' : 'bg-[#FFD700]'} h-full transition-all duration-300" style="width: ${percentage}%"></div>
                </div>
                <div class="flex gap-1.5 mt-2">
                    <button onclick="window.updateQuestCounter('${questId}', ${counter.id}, ${counter.current - 1})" 
                            class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 rounded transition-colors ${counter.current <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
                            ${counter.current <= 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <button onclick="window.updateQuestCounter('${questId}', ${counter.id}, ${counter.current + 1})" 
                            class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 rounded transition-colors ${isComplete ? 'opacity-50 cursor-not-allowed' : ''}" 
                            ${isComplete ? 'disabled' : ''}>
                        <i class="fa-solid fa-plus text-[10px]"></i>
                    </button>
                    <button onclick="window.updateQuestCounter('${questId}', ${counter.id}, ${counter.target})" 
                            class="flex-1 bg-[#FFD700] hover:bg-yellow-400 text-black text-xs font-bold py-1 rounded transition-colors">
                        <i class="fa-solid fa-check text-[10px]"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="quest-counter-widget bg-black/40 border ${allComplete ? 'border-green-500/30' : 'border-gray-700'} rounded-xl p-3 mb-4" data-quest-id="${questId}">
            <h5 class="text-[11px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2">
                <i class="fa-solid fa-list-check"></i>
                Quest Progress Tracker
            </h5>
            ${countersHTML}
        </div>
    `;
}

// Expose functions globally
window.updateQuestCounter = updateQuestCounter;
window.renderCountersUI = renderCountersUI;

async function updateSidebarPermissions() {
    const createBtn = document.getElementById("create-quest-nav");
    const editBtn = document.getElementById("edit-quest-nav");
    const featuresBtn = document.getElementById("edit-features-nav");
    const flowBtn = document.getElementById("quest-flow-nav");

    if (!createBtn || !editBtn) return;

    createBtn.classList.add("hidden");
    editBtn.classList.add("hidden");
    if (featuresBtn) featuresBtn.classList.add("hidden");
    if (flowBtn) flowBtn.classList.add("hidden");

    try {
        const user = questState.getUser();
        if (!user) {
            sessionStorage.removeItem("user_quest_role");
            return;
        }

        const cachedRole = sessionStorage.getItem("user_quest_role");
        
        if (cachedRole === "quest_adder") {
            createBtn.classList.remove("hidden");
            editBtn.classList.remove("hidden");
            if (featuresBtn) featuresBtn.classList.remove("hidden");
            if (flowBtn) flowBtn.classList.remove("hidden");
            return;
        }
        
        const { supabase } = await import("../supabaseClient.js");
        const { data, error } = await supabase
            .from("admin_users")
            .select("quest_role")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error || !data) {
            sessionStorage.removeItem("user_quest_role");
            return;
        }

        if (data.quest_role === "quest_adder") {
            sessionStorage.setItem("user_quest_role", "quest_adder");
            createBtn.classList.remove("hidden");
            editBtn.classList.remove("hidden");
            if (featuresBtn) featuresBtn.classList.remove("hidden");
            if (flowBtn) flowBtn.classList.remove("hidden");
        } else {
            sessionStorage.removeItem("user_quest_role");
        }
    } catch (err) {
        sessionStorage.removeItem("user_quest_role");
    }
}


function populateFilters(regions) {
    const statusInput = document.getElementById('filter-status');
    const filterButtons = document.querySelectorAll('.sidebar-filter-btn');

    if (statusInput && filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            if (btn.getAttribute('data-filter-status') === statusInput.value) {
                btn.classList.add('active', 'bg-[#FFD700]', 'text-black');
                const icon = btn.querySelector('i');
                if (icon) icon.classList.add('text-black');
            }

            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                
                filterButtons.forEach(b => {
                    b.classList.remove('active', 'bg-[#FFD700]', 'text-black');
                    const icon = b.querySelector('i');
                    if (icon) icon.classList.remove('text-black');
                });

                btn.classList.add('active', 'bg-[#FFD700]', 'text-black');
                const activeIcon = btn.querySelector('i');
                if (activeIcon) activeIcon.classList.add('text-black');

                const statusValue = btn.getAttribute('data-filter-status');
                statusInput.value = statusValue;

                renderQuestsList();
            });
        });
    }
}

function generateSignHtml(quest, baseUrl, version) {
    if (quest.signs && Array.isArray(quest.signs) && quest.signs.length > 0) {
        return quest.signs.map(fullId => {
            const parts = fullId.split('_');
            const category = parts[0];
            const itemName = parts.slice(1).join('_');
            const imgSrc = `${baseUrl}${category}_${itemName}.webp?${version}`;
            return `<img src="${imgSrc}" class="w-16 h-16 bg-gray-900 rounded-lg p-1 border border-gray-600 transition-transform duration-200 hover:scale-110 hover:border-[#72e0cc] cursor-pointer" data-sign="${fullId}" onerror="this.style.display='none'">`;
        }).join("");
    }
    return `<span class="text-white font-medium mb-1 text-gray-500 italic">No sign sequence found for this quest.</span>`;
}

function clearQuestDetails() {
   //console.log('[QUESTS] Clearing quest details and showing empty state');
    
    activeQuestKey = null;
    window.activeQuestKey = null;
    
    const emptyState = document.getElementById('empty-state');
    const content = document.getElementById('details-content');
    
    if (content) content.classList.add('hidden');
    if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <div class="text-center text-gray-400">
                <i class="fa-solid fa-scroll text-4xl mb-4 opacity-20"></i>
                <p>Select a chronicle from the list to view details</p>
            </div>`;
    }
    
    const url = new URL(window.location);
    url.searchParams.delete('quest');
    window.history.replaceState({}, '', url);
}

async function claimQuestDirectly(quest) {
    const charId = questState.getActiveCharacterId();
    if (!charId) {
        showToast("Please select a character first.", "error");
        return;
    }

    try {
        await questState.addClaim(quest.id);
        
        const directModal = document.getElementById('direct-confirm-modal');
        const successModal = document.getElementById('success-state');
        
        if (directModal) {
            directModal.classList.add('hidden');
            directModal.classList.remove('flex');
        }

        if (successModal) {
            successModal.classList.remove('hidden');
            successModal.classList.add('flex');
        }

        // CRITICAL: Update userClaims BEFORE finding next quest
        userClaims = questState.getUserClaims();
        window.userClaims = userClaims;
       //console.log('[QUESTS] Updated userClaims after completing quest:', userClaims.length);
        
        const nextQuest = findNextAvailableQuest();
        
        await renderQuestsList();

        if (nextQuest) {
           //console.log('[QUESTS] Next quest found, showing details:', nextQuest.quest_name);
            showQuestDetails(nextQuest, false);
        } else {
           //console.log('[QUESTS] No next quest available, clearing details');
            clearQuestDetails();
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, "error");
    }
}

function isQuestLocked(quest, claims, quests) {
    const claimedIds = claims.map(c => c.quest_id);
    
    const categoryProgress = {};
    claims.forEach(claim => {
        const q = quests.find(item => item.id === claim.quest_id);
        if (q && q.category) {
            categoryProgress[q.category] = (categoryProgress[q.category] || 0) + 1;
        }
    });

    // Category-based hard lock
    const reqCat = quest.unlock_prerequisite_category;
    const reqCount = quest.unlock_required_count || 0;
    if (reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount) {
        return true;
    }

    // Quest-level hard locks (controls visibility)
    const hardLocks = quest.hard_lock_quest_ids || [];
    if (hardLocks.length > 0 && !hardLocks.every(id => claimedIds.includes(id))) {
        return true;
    }

    // Soft locks (controls completion)
    const prerequisites = quest.prerequisite_quest_ids || [];
    if (prerequisites.length > 0 && !prerequisites.every(id => claimedIds.includes(id))) {
        return true;
    }

    return false;
}

// New helper function to determine if a prerequisite quest should be clickable
// Returns true if the quest is viewable (not hidden by category locks or secrets)
function isPrerequisiteViewable(quest, currentQuest, claims, quests) {
    if (!quest) return false;
    
    // Get unlocked categories and secret categories
    const unlockedCategoriesList = questState.getUnlockedCategories();
    const unlockedCategories = new Set(unlockedCategoriesList);
    
    const categoriesData = questState.getCategories();
    const secretCategoryNames = new Set(
        categoriesData.filter(c => c.is_secret).map(c => c.name)
    );
    
    const questCategory = quest.category || "Uncategorized";
    const currentCategory = currentQuest?.category || "Uncategorized";
    
    // If the prerequisite is in a secret category that's not unlocked, it's not viewable
    if (secretCategoryNames.has(questCategory) && !unlockedCategories.has(questCategory)) {
        return false;
    }
    
    // If the prerequisite is in the same category as the current quest, it's viewable
    if (questCategory === currentCategory) {
        return true;
    }
    
    // Check if the prerequisite's category is unlocked
    // If it's unlocked, the user can view it even if it has its own prerequisites
    if (unlockedCategories.has(questCategory)) {
        return true;
    }
    
    // If we get here, the quest is not viewable
    return false;
}

function findNextAvailableQuest() {
//console.log('[QUESTS] findNextAvailableQuest called with activeQuestKey:', activeQuestKey);

if (!activeQuestKey) {
//console.log('[QUESTS] No active quest key, cannot find next');
return null;
}

const currentQuest = allQuests.find(q => q.quest_key === activeQuestKey);
if (!currentQuest) {
//console.log('[QUESTS] Current quest not found in allQuests');
return null;
}

//console.log('[QUESTS] Current quest:', currentQuest.quest_name, '| Category:', currentQuest.category);

// Get user's archetype
const character = questState.getActiveCharacter();
const userArchetype = character?.archetype;
//console.log('[QUESTS] User archetype:', userArchetype || 'none');

// Get unlocked categories
const unlockedCategoriesList = questState.getUnlockedCategories();
const unlockedCategories = new Set(unlockedCategoriesList);

// Get secret categories
const categoriesData = questState.getCategories();
const secretCategoryNames = new Set(
categoriesData.filter(c => c.is_secret).map(c => c.name)
);

// Helper function to check if a quest is available to the user
const isQuestAvailableToUser = (quest) => {
// Check archetype restrictions
const category = quest.category || "Uncategorized";
if (category.startsWith('Archetype: ')) {
const archetypeName = category.replace('Archetype: ', '').trim();
    if (userArchetype !== archetypeName) {
            //console.log('[QUESTS] Quest', quest.quest_name, 'filtered: wrong archetype (needs', archetypeName, ', user has', userArchetype || 'none', ')');
            return false;
        }
    }
    
    // Check if quest has allowed_archetypes restriction
    if (quest.allowed_archetypes && Array.isArray(quest.allowed_archetypes) && quest.allowed_archetypes.length > 0) {
        if (!userArchetype || !quest.allowed_archetypes.includes(userArchetype)) {
            //console.log('[QUESTS] Quest', quest.quest_name, 'filtered: archetype not in allowed list (needs one of', quest.allowed_archetypes, ', user has', userArchetype || 'none', ')');
            return false;
        }
    }
    
    // Check if category is secret and unlocked
const isSecret = secretCategoryNames.has(category);
const isUnlocked = unlockedCategories.has(category);
if (isSecret && !isUnlocked) {
    //console.log('[QUESTS] Quest', quest.quest_name, 'filtered: secret category not unlocked');
return false;
}

    return true;
};

// Helper function to check if a quest is viewable (not hard-locked)
// A quest is viewable if it's unlocked OR soft-locked (visible but not completable)
const isQuestViewable = (quest) => {
    const claimedIds = userClaims.map(c => c.quest_id);
    const categoryProgress = {};
    userClaims.forEach(claim => {
        const q = allQuests.find(item => item.id === claim.quest_id);
        if (q && q.category) {
            categoryProgress[q.category] = (categoryProgress[q.category] || 0) + 1;
        }
    });

    // Check category-based hard lock
    const reqCat = quest.unlock_prerequisite_category;
    const reqCount = quest.unlock_required_count || 0;
    if (reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount) {
        return false; // Hard-locked by category requirement
    }

    // Check quest-level hard locks (controls visibility)
    const hardLocks = quest.hard_lock_quest_ids || [];
    if (hardLocks.length > 0 && !hardLocks.every(id => claimedIds.includes(id))) {
        return false; // Hard-locked by specific quests
    }

    // If we get here, the quest is viewable (may be soft-locked but still visible)
    return true;
};

// Get all quests in the same category as the current quest
    const sameCategory = allQuests.filter(q => q.category === currentQuest.category);
    //console.log('[QUESTS] Quests in same category:', sameCategory.length);
    
    // Find the index of the current quest within its category
    const currentIndexInCategory = sameCategory.findIndex(q => q.quest_key === activeQuestKey);
    //console.log('[QUESTS] Current index in category:', currentIndexInCategory);
    
    // Try to find the next viewable quest in the same category (unlocked OR soft-locked)
    if (currentIndexInCategory !== -1) {
        for (let i = currentIndexInCategory + 1; i < sameCategory.length; i++) {
            const candidateQuest = sameCategory[i];
            const isClaimed = userClaims.some(c => c.quest_id === candidateQuest.id);
            const isViewable = isQuestViewable(candidateQuest);
            
            //console.log('[QUESTS] Checking candidate:', candidateQuest.quest_name, '| Claimed:', isClaimed, '| Viewable:', isViewable);
            
            if (!isClaimed && isViewable && isQuestAvailableToUser(candidateQuest)) {
                //console.log('[QUESTS] Found next viewable quest in same category:', candidateQuest.quest_name);
                return candidateQuest;
            }
        }
    }
    
    //console.log('[QUESTS] No next viewable quest in same category, looking for first viewable quest at top of list');
    
    // If no next quest in same category, find the first viewable quest at the top of the entire list
    // This needs to match EXACTLY what the user sees in the rendered list, respecting filters
    
    // Get the current filter status
    const filterStatus = document.getElementById('filter-status')?.value || 'incomplete';
    
    // Step 1: Filter quests exactly like renderQuestsList does
    const filteredQuests = allQuests.filter(quest => {
        const category = quest.category || "Uncategorized";
        const isSecret = secretCategoryNames.has(category);
        const isUnlocked = unlockedCategories.has(category);
        
        // Filter by archetype (already handled in isQuestAvailableToUser, but double-check)
        if (!isQuestAvailableToUser(quest)) return false;
        
        // Secret quests are hidden unless unlocked
        if (isSecret && !isUnlocked) return false;
        
        const isClaimed = userClaims.some(c => c.quest_id === quest.id);
        
        // Apply the same filter logic as renderQuestsList
        if (filterStatus === "all") return true;
        if (filterStatus === "completed") return isClaimed;
        if (filterStatus === "incomplete") {
            if (isClaimed) return false;
            
            const questCategory = quest.category || "Uncategorized";
            const isQuestCategoryUnlocked = unlockedCategories.has(questCategory);
            if (!isQuestCategoryUnlocked) return false;
            
            // Check if quest is viewable (not hard-locked)
            if (!isQuestViewable(quest)) return false;
            
            return true;
        }
        return true;
    });
    
    // Step 2: Group by category
    const grouped = filteredQuests.reduce((acc, quest) => {
        const cat = quest.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(quest);
        return acc;
    }, {});
    
    // Step 3: Sort categories (matching renderQuestsList logic)
    const sortedCats = Object.keys(grouped).sort((a, b) => {
        if (a === "The First Steps: Beginner's Guide") return -1;
        if (b === "The First Steps: Beginner's Guide") return 1;
        return a.localeCompare(b);
    });
    
    // Step 4: Iterate through categories in UI order and find first viewable quest
    for (const category of sortedCats) {
        const categoryQuests = grouped[category];
        // Quests within category are already in database order (same as allQuests)
        for (const quest of categoryQuests) {
            //console.log('[QUESTS] Found first viewable quest at top of rendered list:', quest.quest_name, 'in category:', category);
            return quest;
        }
    }
    
    //console.log('[QUESTS] No viewable quests found anywhere');
    return null;
}

async function showQuestDetails(quest, userClaimed) {
    activeQuestKey = quest.quest_key;
    window.activeQuestKey = quest.quest_key;
    
    const emptyState = document.getElementById('empty-state');
    const content = document.getElementById('details-content');
    
    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    userClaims = questState.getUserClaims();
    window.userClaims = userClaims;

    const completedQuestIds = userClaims.map(c => c.quest_id);

    const prerequisites = quest.prerequisite_quest_ids || [];
    const prerequisitesMet = prerequisites.every(id => completedQuestIds.includes(id));

    // Initialize or load quest counters - DISABLED
    // const countersData = parseQuestCounters(quest);
    // Counter system temporarily disabled

    document.querySelectorAll('.quest-item').forEach(el => {
        el.classList.remove('active', 'bg-white/10', 'border-l-4', 'border-[#FFD700]');
        if(el.dataset.key === quest.quest_key) {
            el.classList.add('active', 'bg-white/10', 'border-l-4', 'border-[#FFD700]');
        }
    });

    document.getElementById('detail-name').innerText = quest.quest_name;
    
    const reg = quest.regions;
    const regionText = reg ? `${reg.region_name} • ${reg.shard} • ${reg.home_valley}` : 'World Quest';
    document.getElementById('detail-region').innerText = regionText;

    marked.setOptions({
        gfm: true,
        breaks: true,
        pedantic: false,
        smartLists: true,
        smartypants: false
    });

    const formatMarkdownContainer = (targetId, rawContent, fallback) => {
        const target = document.getElementById(targetId);
        const content = rawContent?.trim() || fallback;
        target.innerHTML = marked.parse(content);

        target.querySelectorAll('p').forEach(p => {
            p.style.whiteSpace = "pre-wrap";
        });

        target.querySelectorAll('a').forEach(link => {
            const urlString = link.getAttribute('href');
            let isInternalQuest = false;

            try {
                const url = new URL(link.href, window.location.origin);
                const questKey = url.searchParams.get('quest');

                if (questKey) {
                    isInternalQuest = true;
                    link.classList.add('text-[#FFD700]', 'hover:underline', 'underline-offset-4', 'font-bold', 'cursor-pointer');
                    
                    link.onclick = (e) => {
                        e.preventDefault();
                        const targetQuest = allQuests.find(q => q.quest_key === questKey);
                        if (targetQuest) {
                            if (isQuestLocked(targetQuest, userClaims, allQuests)) {
                                showToast("Access Denied: You have not met the requirements for this archive.", "error");
                            } else {
                                const isClaimed = userClaims.some(c => c.quest_id === targetQuest.id);
                                showQuestDetails(targetQuest, isClaimed);
                                const detailsPanel = document.getElementById('details-content');
                                if (detailsPanel) detailsPanel.scrollTop = 0;
                            }
                        } else {
                            showToast("Quest record not found in the archives.", "error");
                        }
                    };
                }
            } catch (e) {
                isInternalQuest = false;
            }

            if (!isInternalQuest) {
                link.classList.add('text-[#FFD700]', 'hover:underline', 'underline-offset-4', 'font-bold');
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
        });

        target.querySelectorAll('blockquote').forEach(quote => {
            quote.classList.add('border-l-4', 'border-[#FFD700]/50', 'bg-black/20', 'p-4', 'my-4', 'rounded-r-lg', 'italic', 'text-gray-400');
        });

        target.querySelectorAll('ul').forEach(ul => {
            ul.classList.add('list-disc', 'ml-6', 'mb-4', 'text-gray-300');
        });

        target.querySelectorAll('li').forEach(li => {
            li.classList.add('mb-1');
        });
    };

    formatMarkdownContainer('detail-lore', quest.lore, "No lore available.");
    formatMarkdownContainer('detail-location', quest.location, "No quest fulfillment details exist for this quest.");

    // Quest counters temporarily disabled
    // Counter insertion code removed

    const itemEl = document.getElementById('detail-items');
    const goldEl = document.getElementById('detail-gold');
    const rewardsSection = document.querySelector('section:has(#detail-rewards-section)');
    const hasGold = quest.gold && Number(quest.gold) > 0;
    const hasItems = quest.items && (Array.isArray(quest.items) ? quest.items.length > 0 : (quest.items !== 'None' && quest.items !== ''));

    if (!hasGold && !hasItems) {
        // Hide entire rewards section
        if (rewardsSection) {
            rewardsSection.style.display = 'none';
        }
    } else {
        // Show rewards section
        if (rewardsSection) {
            rewardsSection.style.display = 'block';
        }
        itemEl.classList.remove('text-gray-500', 'italic');
        itemEl.innerText = hasItems ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : '';
        goldEl.innerText = hasGold ? `${quest.gold} Gold` : '';
    }

    const signSection = document.querySelector('section:has(#detail-signs)');
    const hasSignSequence = quest.signs && Array.isArray(quest.signs) && quest.signs.length > 0;

    if (!hasSignSequence) {
        // Hide entire sign sequence section
        if (signSection) {
            signSection.style.display = 'none';
        }
    } else {
        // Show sign sequence section
        if (signSection) {
            signSection.style.display = 'block';
        }
        try {
            const response = await fetch('frontend/www/assets/signs.json');
            const signConfig = await response.json();
            const { baseUrl, version } = signConfig.config;
            document.getElementById('detail-signs').innerHTML = generateSignHtml(quest, baseUrl, version);
        } catch (e) {
            document.getElementById('detail-signs').innerHTML = `<span class="text-gray-500 italic text-md">No sign sequence found.</span>`;
        }
    }

    // Hard Lock Prerequisites Display
    const hardLockContainer = document.getElementById('detail-hard-locks');
    if (hardLockContainer) {
        const hardLocks = quest.hard_lock_quest_ids || [];
        if (hardLocks.length > 0) {
            const hardLockList = hardLocks.map(id => {
                const q = allQuests.find(item => item.id === id);
                const name = q ? q.quest_name : "Unknown Quest";
                const isDone = completedQuestIds.includes(id);
                const colorClass = isDone ? "text-green-400" : "text-red-400";
                const icon = isDone ? "fa-circle-check" : "fa-circle-xmark";
                
                // Use the new isPrerequisiteViewable function instead of isQuestLocked
                const isViewable = q ? isPrerequisiteViewable(q, quest, userClaims, allQuests) : false;

                let actionButton = '';
                if (q && isViewable) {
                    actionButton = `<button data-quest-id="${id}" class="hard-lock-link text-[10px] text-gray-500 hover:text-[#FFD700] uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">View <i class="fa-solid fa-arrow-right ml-1"></i></button>`;
                } else {
                    actionButton = `<span class="text-[10px] text-gray-600 uppercase tracking-tighter cursor-not-allowed opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-lock mr-1"></i>Locked</span>`;
                }

                return `<div class="flex items-center justify-between gap-2 p-1 hover:bg-white/5 rounded transition-colors group">
                            <div class="flex items-center gap-2 ${colorClass} text-sm font-medium">
                                <i class="fa-solid ${icon}"></i>
                                <span>${name}</span>
                            </div>
                            ${actionButton}
                        </div>`;
            }).join("");
            
            hardLockContainer.innerHTML = hardLockList;

            hardLockContainer.querySelectorAll('.hard-lock-link').forEach(btn => {
                btn.onclick = (e) => {
                    const targetId = btn.getAttribute('data-quest-id');
                    const targetQuest = allQuests.find(q => q.id === targetId);
                    if (targetQuest) {
                        const isClaimed = userClaims.some(c => c.quest_id === targetQuest.id);
                        showQuestDetails(targetQuest, isClaimed);
                        const detailsPanel = document.getElementById('details-content');
                        if (detailsPanel) detailsPanel.scrollTop = 0;
                    }
                };
            });
        } else {
            hardLockContainer.innerHTML = `<span class="text-gray-500 italic text-sm">None</span>`;
        }
    }

    // Soft Lock Prerequisites Display (Required to Complete)
    const prereqContainer = document.getElementById('detail-prerequisites');
    if (prereqContainer) {
        if (prerequisites.length > 0) {
            const prereqList = prerequisites.map(id => {
                const q = allQuests.find(item => item.id === id);
                const name = q ? q.quest_name : "Unknown Quest";
                const isDone = completedQuestIds.includes(id);
                const colorClass = isDone ? "text-green-400" : "text-red-400";
                const icon = isDone ? "fa-circle-check" : "fa-circle-xmark";
                
                // Use the new isPrerequisiteViewable function instead of isQuestLocked
                const isViewable = q ? isPrerequisiteViewable(q, quest, userClaims, allQuests) : false;

                let actionButton = '';
                if (q && isViewable) {
                    actionButton = `<button data-quest-id="${id}" class="prereq-link text-[10px] text-gray-500 hover:text-[#FFD700] uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">View <i class="fa-solid fa-arrow-right ml-1"></i></button>`;
                } else {
                    actionButton = `<span class="text-[10px] text-gray-600 uppercase tracking-tighter cursor-not-allowed opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-lock mr-1"></i>Locked</span>`;
                }

                return `<div class="flex items-center justify-between gap-2 p-1 hover:bg-white/5 rounded transition-colors group">
                            <div class="flex items-center gap-2 ${colorClass} text-sm font-medium">
                                <i class="fa-solid ${icon}"></i>
                                <span>${name}</span>
                            </div>
                            ${actionButton}
                        </div>`;
            }).join("");
            
            prereqContainer.innerHTML = prereqList;

            prereqContainer.querySelectorAll('.prereq-link').forEach(btn => {
                btn.onclick = (e) => {
                    const targetId = btn.getAttribute('data-quest-id');
                    const targetQuest = allQuests.find(q => q.id === targetId);
                    if (targetQuest) {
                        const isClaimed = userClaims.some(c => c.quest_id === targetQuest.id);
                        showQuestDetails(targetQuest, isClaimed);
                        const detailsPanel = document.getElementById('details-content');
                        if (detailsPanel) detailsPanel.scrollTop = 0;
                    }
                };
            });
        } else {
            prereqContainer.innerHTML = `<span class="text-gray-500 italic text-sm">None</span>`;
        }
    }

    const statusBadge = document.getElementById('detail-status-badge');
    if (userClaimed) {
        statusBadge.innerHTML = '<span class="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-green-500/30">Completed</span>';
    } else if (!prerequisitesMet) {
        statusBadge.innerHTML = '<span class="bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-red-500/30"><i class="fa-solid fa-lock mr-2"></i>Locked</span>';
    } else {
        statusBadge.innerHTML = '<span class="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-yellow-500/30">Active</span>';
    }

    const redeemBtn = document.getElementById('detail-redeem-btn');
    if (userClaimed) {
        redeemBtn.innerText = "Quest Completed";
        redeemBtn.disabled = true;
        redeemBtn.className = "ml-auto bg-gray-800 w-52 text-gray-500 py-3 rounded-lg font-bold uppercase text-md cursor-not-allowed";
    } else if (!prerequisitesMet) {
        redeemBtn.innerText = "Locked";
        redeemBtn.disabled = true;
        redeemBtn.className = "ml-auto bg-gray-900/40 w-52 text-gray-400/50 py-3 rounded-lg font-bold uppercase text-md cursor-not-allowed border border-white/5";
    } else {
        redeemBtn.innerText = "Complete Quest";
        redeemBtn.disabled = false;
        redeemBtn.className = "ml-auto bg-[#FFD700] w-52 text-black py-3 rounded-lg font-bold uppercase text-md hover:bg-yellow-400 transition-all";
        
        redeemBtn.onclick = async () => {
            const user = questState.getUser();
            const charId = questState.getActiveCharacterId();
            
            if (!user) {
                const emptyState = document.getElementById('empty-state');
                const content = document.getElementById('details-content');
                if (content) content.classList.add('hidden');
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    emptyState.innerHTML = `
                        <div class="flex flex-col items-center justify-center p-12 text-center h-full">
                            <div class="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 border border-gray-700">
                                <i class="fa-brands fa-discord text-2xl text-[#5865F2]"></i>
                            </div>
                            <h3 class="text-xl font-bold text-white mb-2 font-serif uppercase tracking-widest">Authentication Required</h3>
                            <p class="text-gray-400 mb-6 max-w-xs italic">The Archives require a soul to bind these records to. Please login with Discord to continue.</p>
                            <button onclick="window.dispatchEvent(new CustomEvent('requestLogin'))" class="px-8 py-3 bg-[#5865F2] text-white font-bold rounded shadow-lg hover:bg-[#4752C4] transition-all flex items-center gap-2 uppercase text-sm tracking-widest">
                                <i class="fa-brands fa-discord"></i> Login with Discord
                            </button>
                        </div>
                    `;
                }
                return;
            }

            if (!charId) {
                showToast("Please select or create a character before claiming a quest.", "error");
                return;
            }

            if (quest.signs && Array.isArray(quest.signs) && quest.signs.length > 0) {
                const modal = document.getElementById('sign-redemption-modal');
                const modalTitle = document.getElementById('modal-target-quest-name');
                if (modalTitle) modalTitle.innerText = quest.quest_name;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            } else {
                const directModal = document.getElementById('direct-confirm-modal');
                document.getElementById('direct-confirm-text').innerHTML = `Confirm completion of <span class="text-[#FFD700] font-bold">"${quest.quest_name}"</span>?`;
                directModal.classList.remove('hidden');
                directModal.classList.add('flex');

                document.getElementById('direct-confirm-submit').onclick = async () => {
                    await claimQuestDirectly(quest);
                };
            }
        };
    }

    const shareBtn = document.getElementById('detail-share-btn');
    if (shareBtn) {
        shareBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                const span = shareBtn.querySelector('span');
                const icon = shareBtn.querySelector('i');
                const originalText = span.innerText;
                const originalIconClass = icon.className;
                span.innerText = "Copied!";
                icon.className = "fa-solid fa-check text-green-400";
                setTimeout(() => {
                    span.innerText = originalText;
                    icon.className = originalIconClass;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy link:', err);
            }
        };
    }

    const url = new URL(window.location);
    url.searchParams.set('quest', quest.quest_key);
    window.history.replaceState({}, '', url);

    requestAnimationFrame(() => {
        const scrollEl = document.getElementById('quest-details-scroll');
        if (scrollEl) scrollEl.scrollTop = 0;
    });

}

window.showQuestDetails = showQuestDetails;

async function renderQuestsList() {
    const listContainer = document.getElementById("quest-titles-list");
    if (!listContainer) return;

    const charId = questState.getActiveCharacterId();
    const filterStatus = document.getElementById('filter-status')?.value || "all";

    userClaims = questState.getUserClaims();
    window.userClaims = userClaims;

    const categoriesData = questState.getCategories();
    const secretCategoryNames = new Set(
        categoriesData.filter(c => c.is_secret).map(c => c.name)
    );

    const unlockedCategoriesList = questState.getUnlockedCategories();
    const unlockedCategories = new Set(unlockedCategoriesList);
    
    const character = questState.getActiveCharacter();
    const userArchetype = character?.archetype;

    const categoryProgress = {};
    userClaims.forEach(claim => {
        const quest = allQuests.find(q => q.id === claim.quest_id);
        if (quest && quest.category) {
            categoryProgress[quest.category] = (categoryProgress[quest.category] || 0) + 1;
        }
    });

    listContainer.innerHTML = "";

    const filteredQuests = allQuests.filter(quest => {
        const category = quest.category || "Uncategorized";
        const isSecret = secretCategoryNames.has(category);
        const isUnlocked = unlockedCategories.has(category);
        
        if (category.startsWith('Archetype: ')) {
            const archetypeName = category.replace('Archetype: ', '').trim();
            if (userArchetype !== archetypeName) {
                return false;
            }
        }
        
        // Check if quest has allowed_archetypes restriction
        if (quest.allowed_archetypes && Array.isArray(quest.allowed_archetypes) && quest.allowed_archetypes.length > 0) {
            if (!userArchetype || !quest.allowed_archetypes.includes(userArchetype)) {
                return false;
            }
        }

        // Secret quests are always hidden unless unlocked
        if (isSecret && !isUnlocked) {
            return false;
        }

        const userClaimed = userClaims.some(c => c.quest_id === quest.id);

        if (filterStatus === "all") return true;
        if (filterStatus === "completed") return userClaimed;
        if (filterStatus === "incomplete") {
            if (userClaimed) return false;
            
            const questCategory = quest.category || "Uncategorized";
            const isQuestCategoryUnlocked = unlockedCategories.has(questCategory);
            
            if (!isQuestCategoryUnlocked) return false;
            
            // Check hard-lock (category-level requirements)
            const reqCat = quest.unlock_prerequisite_category;
            const reqCount = quest.unlock_required_count;
            
            if (reqCat && reqCat !== "") {
                const isPrereqCategoryUnlocked = unlockedCategories.has(reqCat);
                
                if (reqCount && reqCount > 0) {
                    const categoryRequirementMet = isPrereqCategoryUnlocked && (categoryProgress[reqCat] || 0) >= reqCount;
                    if (!categoryRequirementMet) return false; // Hard-locked, hide it
                } else {
                    if (!isPrereqCategoryUnlocked) return false; // Hard-locked, hide it
                }
            }

            // Check quest-level hard locks
            const hardLocks = quest.hard_lock_quest_ids || [];
            const claimedIds = userClaims.map(c => c.quest_id);
            if (hardLocks.length > 0 && !hardLocks.every(id => claimedIds.includes(id))) {
                return false; // Hard-locked by specific quests, hide it
            }

            // Soft-locked quests (prerequisite quests not met) should STILL show
            // They're visible but not completable
            // So we don't filter them out here
            
            return true;
        }
        return true;
    });

    const groupedQuests = filteredQuests.reduce((acc, quest) => {
        const cat = quest.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(quest);
        return acc;
    }, {});

    const sortedCategories = Object.keys(groupedQuests).sort((a, b) => {
        if (a === "The First Steps: Beginner's Guide") return -1;
        if (b === "The First Steps: Beginner's Guide") return 1;
        return a.localeCompare(b);
    });

    sortedCategories.forEach(category => {
        const categoryQuests = groupedQuests[category];
        const isActuallyUnlocked = unlockedCategories.has(category);
        const isCollapsed = collapsedCategories.has(category);
        
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-header p-3 px-4 text-[12px] font-bold uppercase tracking-widest text-[#FFD700] border-b border-gray-700/50 sticky top-0 z-10 backdrop-blur-md cursor-pointer flex justify-between items-center hover:bg-white/5";

        let displayTitle = category;
        if (category.includes(':')) {
            const parts = category.split(':');
            displayTitle = parts.slice(1).join(':').trim();
        }

        const catTitle = document.createElement("span");
        catTitle.innerText = `${displayTitle} (${categoryQuests.length})`;
        categoryHeader.appendChild(catTitle);

        const catIconContainer = document.createElement("div");
        catIconContainer.className = "flex items-center gap-3";
        catIconContainer.innerHTML = `<i class="fa-solid fa-chevron-down text-gray-500"></i>`;
        categoryHeader.appendChild(catIconContainer);

        const contentWrapper = document.createElement("div");
        contentWrapper.className = `category-content-wrapper ${isCollapsed ? 'collapsed' : ''}`;
        
        const innerContainer = document.createElement("div");
        innerContainer.className = "category-inner";

        if (!isActuallyUnlocked) {
            applyLockStyles(categoryHeader, catIconContainer);
        }

        categoryHeader.onclick = (e) => {
            e.preventDefault();
            
            const isNowCollapsed = !contentWrapper.classList.contains('collapsed');
            
            if (isNowCollapsed) {
                collapsedCategories.add(category);
                contentWrapper.classList.add('collapsed');
                catIconContainer.innerHTML = `<i class="fa-solid fa-chevron-right text-gray-500"></i>`;
            } else {
                collapsedCategories.delete(category);
                contentWrapper.classList.remove('collapsed');
                catIconContainer.innerHTML = `<i class="fa-solid fa-chevron-down text-gray-500"></i>`;
            }

            setTimeout(() => {
                renderQuestsList();
            }, 300);
        };

        categoryQuests.forEach(quest => {
            const userClaimed = userClaims.some(c => c.quest_id === quest.id);
            const reqCat = quest.unlock_prerequisite_category;
            const reqCount = quest.unlock_required_count || 0;
            const categoryRequirementMet = !(reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount);
            const claimedIds = userClaims.map(c => c.quest_id);
            const prerequisites = quest.prerequisite_quest_ids || [];
            const prerequisitesMet = prerequisites.every(id => claimedIds.includes(id));
            const isHardLocked = !categoryRequirementMet;
            const isSoftLocked = categoryRequirementMet && !prerequisitesMet;

            const item = document.createElement("div");
            item.dataset.key = quest.quest_key;
            item.className = isHardLocked 
                ? "quest-item p-4 border-b border-gray-700/50 cursor-not-allowed text-md opacity-50 grayscale bg-black/20"
                : `quest-item p-4 border-b border-gray-700/50 cursor-pointer text-md transition-all hover:bg-white/5 ${activeQuestKey === quest.quest_key ? 'bg-white/10 border-l-4 border-[#FFD700]' : ''}`;

            const itemFlex = document.createElement("div");
            itemFlex.className = "flex justify-between items-center pointer-events-none";
            
            let titleMarkup;
            if (isHardLocked) {
                titleMarkup = `<div class="font-bold text-gray-500 text-md flex items-center gap-2"><i class="fa-solid fa-lock text-[10px]"></i>${quest.quest_name} <span class="text-[10px] uppercase tracking-tighter opacity-70">(Locked)</span></div>`;
            } else if (isSoftLocked) {
                titleMarkup = `<div class="font-bold text-white text-md flex items-center gap-2"><i class="fa-solid fa-circle-exclamation text-[10px] text-[#FFD700]/50"></i>${quest.quest_name}</div>`;
            } else {
                titleMarkup = `<div class="font-bold text-white text-md">${quest.quest_name}</div>`;
            }

            itemFlex.innerHTML = `<div>${titleMarkup}</div>`;
            const statusIconContainer = document.createElement("div");
            if (isHardLocked) statusIconContainer.innerHTML = '<i class="fa-solid fa-lock text-gray-800 text-xs"></i>';
            else if (userClaimed) statusIconContainer.innerHTML = '<i class="fa-solid fa-circle-check text-green-500 text-md"></i>';
            else if (isSoftLocked) statusIconContainer.innerHTML = '<i class="fa-solid fa-circle-dot text-gray-600 text-[10px]"></i>';
            else statusIconContainer.innerHTML = '<i class="fa-solid fa-circle text-gray-700 text-[8px]"></i>';

            itemFlex.appendChild(statusIconContainer);
            item.appendChild(itemFlex);

            if (!isHardLocked) {
                item.onclick = () => showQuestDetails(quest, userClaimed);
            }
            innerContainer.appendChild(item);
        });

        contentWrapper.appendChild(innerContainer);
        listContainer.appendChild(categoryHeader);
        listContainer.appendChild(contentWrapper);
    });

    const expandBtn = document.getElementById('expand-all-btn');
    if (expandBtn) {
        expandBtn.onclick = () => {
            const wrappers = document.querySelectorAll('.category-content-wrapper');
            const icons = document.querySelectorAll('.category-header i');
            
            wrappers.forEach(w => w.classList.remove('collapsed'));
            icons.forEach(i => {
                i.classList.remove('fa-chevron-right');
                i.classList.add('fa-chevron-down');
            });

            collapsedCategories.clear();
            setTimeout(() => {
                renderQuestsList();
            }, 300);
        };
    }

    const collapseBtn = document.getElementById('collapse-all-btn');
    if (collapseBtn) {
        collapseBtn.onclick = () => {
            const wrappers = document.querySelectorAll('.category-content-wrapper');
            const icons = document.querySelectorAll('.category-header i');
            
            wrappers.forEach(w => w.classList.add('collapsed'));
            icons.forEach(i => {
                i.classList.remove('fa-chevron-down');
                i.classList.add('fa-chevron-right');
            });

            sortedCategories.forEach(cat => collapsedCategories.add(cat));
            setTimeout(() => {
                renderQuestsList();
            }, 300);
        };
    }
}

// Character archetype check removed - archetypes feature discontinued

async function loadCharacterBanner(characterId) {
    const banner = document.getElementById('character-banner');
    const bannerEmpty = document.getElementById('character-banner-empty');
    if (!banner || !bannerEmpty) return;

    try {
        if (!questState.isReady()) {
            await questState.initialize();
        }

        const character = questState.getActiveCharacter();

        if (!character) {
            banner.classList.add('hidden');
            bannerEmpty.classList.remove('hidden');
            return;
        }

        const claims = questState.getUserClaims();
        const categories = questState.getCategories();

        let categoryActiveMap = {};
        claims.forEach(claim => {
            const quest = questState.getQuestById(claim.quest_id);
            if (quest?.category) {
                categoryActiveMap[quest.category] = true;
            }
        });

        const standardCategories = categories.filter(c => !c.is_secret).map(c => c.name);
        const activeCategoryCount = standardCategories.filter(catName => categoryActiveMap[catName]).length;

        document.getElementById('banner-character-name').innerText = character.character_name;
        
        document.getElementById('chapters-count-text').innerText = activeCategoryCount;
        document.getElementById('chapters-total-text').innerText = standardCategories.length;
        
        const chaptersBar = document.getElementById('chapters-progress-bar');
        if (chaptersBar) {
            const chapPerc = standardCategories.length > 0 ? (activeCategoryCount / standardCategories.length) * 100 : 0;
            chaptersBar.style.width = `${chapPerc}%`;
        }

        banner.classList.remove('hidden');
        bannerEmpty.classList.add('hidden');

    } catch (err) {
        console.error("[QUESTS] Banner Logic Exception:", err);
    }
}

window.addEventListener('characterChanged', async (e) => {
    const newCharacterId = e.detail.characterId;
    
    await loadCharacterBanner(newCharacterId);
    
    activeQuestKey = null;
    window.activeQuestKey = null;
    
    const url = new URL(window.location);
    url.searchParams.delete('quest');
    window.history.replaceState({}, '', url.pathname);

    const emptyState = document.getElementById('empty-state');
    const content = document.getElementById('details-content');
    
    if (content) content.classList.add('hidden');
    if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
        <div class="text-center text-gray-400">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
        <p>Updating records...</p>
        </div>`;
    }

    userClaims = questState.getUserClaims();
    window.userClaims = userClaims;
    
    await fetchCharacters();
    
    const characters = questState.getCharacters();
    if (characters && characters.length === 1) {
        updateSidebarPermissions();
        populateFilters(regionsData);
        initQuestModal();
    }
    
    await renderQuestsList();
    
    if (emptyState) {
        emptyState.innerHTML = `
        <div class="text-center text-gray-400">
                <i class="fa-solid fa-scroll text-4xl mb-4 opacity-20"></i>
                <p>Select a chronicle from the list to view details</p>
            </div>`;
    }
});

window.addEventListener("questClaimed", async (e) => {
   //console.log('[QUESTS] questClaimed event fired');
    
    // CRITICAL: Update userClaims BEFORE finding next quest
    userClaims = questState.getUserClaims();
    window.userClaims = userClaims;
   //console.log('[QUESTS] Updated userClaims after questClaimed event:', userClaims.length);
    
    const nextQuest = findNextAvailableQuest();
    
    await renderQuestsList();

    if (nextQuest) {
       //console.log('[QUESTS] Next quest found after claim, showing details:', nextQuest.quest_name);
        showQuestDetails(nextQuest, false);
    } else {
       //console.log('[QUESTS] No next quest available after claim, clearing details');
        clearQuestDetails();
    }
});


async function init() {
    enableSignTooltip();
    
    if (!questState.isReady()) {
        await questState.initialize();
    }
    
    allQuests = questState.getAllQuests();
    window.allQuests = allQuests;
    regionsData = questState.getRegions();
    userClaims = questState.getUserClaims();
    window.userClaims = userClaims;
    
    // Quest counter system temporarily disabled
    // loadQuestCounters() and initialization removed
    
    await initializeCharacterSystem();
    
    const characters = questState.getCharacters();
    const user = questState.getUser();
    
    if (user && (!characters || characters.length === 0)) {
        const modal = document.getElementById('createCharacterModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
        return;
    }
    
    const characterId = questState.getActiveCharacterId();
    if (characterId) {
        await loadCharacterBanner(characterId);
    }

    updateSidebarPermissions();
    populateFilters(regionsData);
    initQuestModal();
    
    await renderQuestsList();

    const urlParams = new URLSearchParams(window.location.search);
    const targetQuestKey = urlParams.get('quest');
    if (targetQuestKey && allQuests.length > 0) {
        const targetQuest = allQuests.find(q => q.quest_key === targetQuestKey);
        if (targetQuest) {
            showQuestDetails(targetQuest, questState.isQuestClaimed(targetQuest.id));
        }
    }
}

init();
