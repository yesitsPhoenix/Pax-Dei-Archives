import { supabase } from "../supabaseClient.js";
import { getUnlockedCategories, applyLockStyles, } from "./unlocks.js";
import { enableSignTooltip } from '../ui/signTooltip.js';
import { loadArchetypeBanner, initArchetypeSelection } from "../archetypes/archetypesUI.js";
import { initQuestModal } from './questModal.js';


let allQuests = [];
let regionsData = [];
let userClaims = [];
let activeQuestKey = null;
let collapsedCategories = new Set();

async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    } catch (e) {
        return null;
    }
}

async function getActiveCharacterId() {
    const sessionCharId = sessionStorage.getItem("active_character_id");
    if (sessionCharId) return sessionCharId;

    const user = await getCurrentUser();
    if (!user) return null;

    try {
        const { data: character } = await supabase
            .from("characters")
            .select("character_id")
            .eq("user_id", user.id)
            .eq("is_default_character", true)
            .maybeSingle();

        if (character) {
            sessionStorage.setItem("active_character_id", character.character_id);
            return character.character_id;
        }
    } catch (e) {
        return null;
    }
    return null;
}

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

async function updateSidebarPermissions() {
    const createBtn = document.getElementById("create-quest-nav");
    const editBtn = document.getElementById("edit-quest-nav");

    if (!createBtn || !editBtn) return;

    createBtn.classList.add("hidden");
    editBtn.classList.add("hidden");

    try {
        const user = await getCurrentUser();
        if (!user) {
            sessionStorage.removeItem("user_quest_role");
            return;
        }

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
        } else {
            sessionStorage.removeItem("user_quest_role");
        }
    } catch (err) {
        sessionStorage.removeItem("user_quest_role");
    }
}

async function fetchQuests() {
    const { data, error } = await supabase
        .from("cipher_quests")
        .select(`*, regions:region_id (*)`)
        .eq("active", true)
        .order("sort_order", { ascending: true });
    if (error) return [];
    return data || [];
}

async function fetchRegions() {
    const { data, error } = await supabase.from("regions").select("*");
    if (error) return [];
    return data || [];
}

async function fetchUserClaims(characterId) {
    if (!characterId) return [];
    const { data, error } = await supabase
        .from("user_claims")
        .select("*")
        .eq("character_id", characterId);
    
    return error ? [] : data;
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

async function claimQuestDirectly(quest) {
    const charId = await getActiveCharacterId();
    if (!charId) {
        showToast("Please select a character first.", "error");
        return;
    }

    const { error } = await supabase
        .from('user_claims')
        .insert({
            character_id: charId,
            quest_id: quest.id,
            claimed_at: new Date().toISOString()
        });

    if (!error) {
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

        const nextQuest = findNextAvailableQuest();

        const updatedClaims = await fetchUserClaims(charId);
        userClaims = updatedClaims;
        window.userClaims = userClaims;
        
        await renderQuestsList();

        if (nextQuest) {
            showQuestDetails(nextQuest, false);
        } else {
            activeQuestKey = null;
            window.activeQuestKey = null;
            const emptyState = document.getElementById('empty-state');
            const content = document.getElementById('details-content');
            if (emptyState) emptyState.classList.remove('hidden');
            if (content) content.classList.add('hidden');
            const url = new URL(window.location);
            url.searchParams.delete('quest');
            window.history.replaceState({}, '', url);
        }
    } else {
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

    const reqCat = quest.unlock_prerequisite_category;
    const reqCount = quest.unlock_required_count || 0;
    if (reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount) {
        return true;
    }

    const prerequisites = quest.prerequisite_quest_ids || [];
    if (prerequisites.length > 0 && !prerequisites.every(id => claimedIds.includes(id))) {
        return true;
    }

    return false;
}

function findNextAvailableQuest() {
    const listContainer = document.getElementById("quest-titles-list");
    if (!listContainer) return null;

    const questItems = Array.from(listContainer.querySelectorAll('.quest-item'));
    const activeIndex = questItems.findIndex(item => item.dataset.key === activeQuestKey);

    if (activeIndex !== -1 && activeIndex + 1 < questItems.length) {
        const currentQuest = allQuests.find(q => q.quest_key === activeQuestKey);
        const nextItem = questItems[activeIndex + 1];
        const nextQuest = allQuests.find(q => q.quest_key === nextItem.dataset.key);

        if (currentQuest && nextQuest && currentQuest.category === nextQuest.category) {
            if (!nextItem.classList.contains('cursor-not-allowed')) {
                return nextQuest;
            }
        }
    }

    const firstAvailable = questItems.find(item => !item.classList.contains('cursor-not-allowed'));
    if (firstAvailable) {
        return allQuests.find(q => q.quest_key === firstAvailable.dataset.key);
    }

    return null;
}

async function showQuestDetails(quest, userClaimed) {
    activeQuestKey = quest.quest_key;
    window.activeQuestKey = quest.quest_key;
    
    const emptyState = document.getElementById('empty-state');
    const content = document.getElementById('details-content');
    
    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    const charId = await getActiveCharacterId();
    const currentClaims = await fetchUserClaims(charId);
    userClaims = currentClaims; 
    window.userClaims = userClaims;

    const completedQuestIds = currentClaims.map(c => c.quest_id);

    const prerequisites = quest.prerequisite_quest_ids || [];
    const prerequisitesMet = prerequisites.every(id => completedQuestIds.includes(id));

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
    formatMarkdownContainer('detail-location', quest.location, "No location details exist for this quest.");

    const itemEl = document.getElementById('detail-items');
    const goldEl = document.getElementById('detail-gold');
    const hasGold = quest.gold && Number(quest.gold) > 0;
    const hasItems = quest.items && (Array.isArray(quest.items) ? quest.items.length > 0 : (quest.items !== 'None' && quest.items !== ''));

    if (!hasGold && !hasItems) {
        itemEl.innerText = "No reward(s) found for this quest";
        itemEl.classList.add('text-gray-500', 'italic');
        goldEl.innerText = "";
    } else {
        itemEl.classList.remove('text-gray-500', 'italic');
        itemEl.innerText = hasItems ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : '';
        goldEl.innerText = hasGold ? `${quest.gold} Gold` : '';
    }

    try {
        const response = await fetch('frontend/www/assets/signs.json');
        const signConfig = await response.json();
        const { baseUrl, version } = signConfig.config;
        document.getElementById('detail-signs').innerHTML = generateSignHtml(quest, baseUrl, version);
    } catch (e) {
        document.getElementById('detail-signs').innerHTML = `<span class="text-gray-500 italic text-md">No sign sequence found.</span>`;
    }

    const prereqContainer = document.getElementById('detail-prerequisites');
    if (prereqContainer) {
        if (prerequisites.length > 0) {
            const prereqList = prerequisites.map(id => {
                const q = allQuests.find(item => item.id === id);
                const name = q ? q.quest_name : "Unknown Quest";
                const isDone = completedQuestIds.includes(id);
                const colorClass = isDone ? "text-green-400" : "text-red-400";
                const icon = isDone ? "fa-circle-check" : "fa-circle-xmark";
                
                const locked = q ? isQuestLocked(q, userClaims, allQuests) : true;

                let actionButton = '';
                if (q && !locked) {
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
            const user = await getCurrentUser();
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

    const charId = await getActiveCharacterId();
    const filterStatus = document.getElementById('filter-status')?.value || "all";

    if (charId) {
        userClaims = await fetchUserClaims(charId);
        window.userClaims = userClaims;
    }

    const { data: categoriesData } = await supabase
        .from("quest_categories")
        .select("name, is_secret");
    
    const secretCategoryNames = new Set(
        categoriesData?.filter(c => c.is_secret).map(c => c.name) || []
    );

    const unlockedCategoriesList = await getUnlockedCategories(charId, allQuests, userClaims);
    const unlockedCategories = new Set(unlockedCategoriesList);

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

        if (isSecret && !isUnlocked) {
            return false;
        }

        const userClaimed = userClaims.some(c => c.quest_id === quest.id);

        if (filterStatus === "all") return true;
        if (filterStatus === "completed") return userClaimed;
        if (filterStatus === "incomplete") {
            if (userClaimed) return false;
            
            const reqCat = quest.unlock_prerequisite_category;
            const reqCount = quest.unlock_required_count || 0;
            const categoryRequirementMet = !(reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount);

            return categoryRequirementMet;
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

async function checkCharacterArchetype(characterId) {
    const { data: char } = await supabase.from('characters').select('archetype').eq('character_id', characterId).single();
    
    if (char && !char.archetype) {
        const overlay = document.getElementById('archetype-selection-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            await initArchetypeSelection('archetype-node-container');
        }
    }
}

async function fetchAllowedQuests() {
    const characterId = sessionStorage.getItem('active_character_id');
    if (!characterId) return;

    const { data: character } = await supabase
        .from('characters')
        .select('archetype')
        .eq('character_id', characterId)
        .single();

    const { data: categories } = await supabase
        .from('quest_categories')
        .select('name, is_secret');

    const activeArchetypeCategory = `Archetype: ${character.archetype}`;

    const allowedCategoryNames = categories
        .filter(cat => !cat.is_secret || cat.name === activeArchetypeCategory)
        .map(cat => cat.name);

    const { data: quests, error } = await supabase
        .from('cipher_quests')
        .select('*')
        .in('category', allowedCategoryNames)
        .eq('active', true);

    if (!error) {
        renderQuests(quests);
    }
}


async function init() {
    enableSignTooltip();
    const characterId = await getActiveCharacterId();
    
    if (characterId) {
        await checkCharacterArchetype(characterId);
        await loadArchetypeBanner(characterId);
        userClaims = await fetchUserClaims(characterId);
        window.userClaims = userClaims;
    }

    updateSidebarPermissions();
    allQuests = await fetchQuests();
    window.allQuests = allQuests;
    regionsData = await fetchRegions();
    populateFilters(regionsData);
    initQuestModal();
    
    await renderQuestsList();

    window.addEventListener('characterChanged', async (e) => {
        const newCharacterId = e.detail.characterId;
        initArchetypeSelection('archetype-node-container');
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

        const { data: claims, error } = await supabase
            .from("user_claims")
            .select("*")
            .eq("character_id", newCharacterId);

        if (!error) {
            userClaims = claims;
            window.userClaims = userClaims;
            await renderQuestsList();
            
            if (emptyState) {
                emptyState.innerHTML = `
                    <div class="text-center text-gray-400">
                        <i class="fa-solid fa-scroll text-4xl mb-4 opacity-20"></i>
                        <p>Select a chronicle from the list to view details</p>
                    </div>`;
            }
        }
    });

    window.addEventListener("questClaimed", async (e) => {
        const { character_id } = e.detail;
        const activeCharId = character_id || sessionStorage.getItem("active_character_id");
        if (!activeCharId) return;

        const nextQuest = findNextAvailableQuest();

        const { data: updatedClaims } = await supabase
            .from("user_claims")
            .select("*")
            .eq("character_id", activeCharId);

        if (updatedClaims) {
            userClaims = updatedClaims;
            window.userClaims = userClaims;
            await renderQuestsList();

            if (nextQuest) {
                showQuestDetails(nextQuest, false);
            } else {
                activeQuestKey = null;
                window.activeQuestKey = null;
                const emptyState = document.getElementById('empty-state');
                const content = document.getElementById('details-content');
                if (emptyState) emptyState.classList.remove('hidden');
                if (content) content.classList.add('hidden');
                const url = new URL(window.location);
                url.searchParams.delete('quest');
                window.history.replaceState({}, '', url);
            }
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const targetQuestKey = urlParams.get('quest');
    if (targetQuestKey && allQuests.length > 0) {
        const targetQuest = allQuests.find(q => q.quest_key === targetQuestKey);
        if (targetQuest) {
            showQuestDetails(targetQuest, userClaims.some(c => c.quest_id === targetQuest.id));
        }
    }
}

// async function init() {
//     enableSignTooltip();
//     updateSidebarPermissions();

//     allQuests = await fetchQuests();
//     window.allQuests = allQuests;
//     regionsData = await fetchRegions();
//     populateFilters(regionsData);
//     initQuestModal();
    
//     const characterId = await getActiveCharacterId();
//     if (characterId) {
//         userClaims = await fetchUserClaims(characterId);
//         window.userClaims = userClaims;
//     }

//     await renderQuestsList();
//     loadArchetypeBanner(await getActiveCharacterId());

//     window.addEventListener('characterChanged', async (e) => {
//         const newCharacterId = e.detail.characterId;
//         activeQuestKey = null; 
//         window.activeQuestKey = null;
        
//         const url = new URL(window.location);
//         url.searchParams.delete('quest');
//         window.history.replaceState({}, '', url.pathname);

//         const emptyState = document.getElementById('empty-state');
//         const content = document.getElementById('details-content');
        
//         if (content) content.classList.add('hidden');
//         if (emptyState) {
//             emptyState.classList.remove('hidden');
//             emptyState.innerHTML = `
//                 <div class="text-center text-gray-400">
//                     <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
//                     <p>Updating records...</p>
//                 </div>`;
//         }

//         const { data: claims, error } = await supabase
//             .from("user_claims")
//             .select("*")
//             .eq("character_id", newCharacterId);

//         if (!error) {
//             userClaims = claims;
//             window.userClaims = userClaims;
//             await renderQuestsList();
            
//             if (emptyState) {
//                 emptyState.innerHTML = `
//                     <div class="text-center text-gray-400">
//                         <i class="fa-solid fa-scroll text-4xl mb-4 opacity-20"></i>
//                         <p>Select a chronicle from the list to view details</p>
//                     </div>`;
//             }
//         }
//     });

//     window.addEventListener("questClaimed", async (e) => {
//         const { character_id } = e.detail;
//         const activeCharId = character_id || sessionStorage.getItem("active_character_id");
//         if (!activeCharId) return;

//         const nextQuest = findNextAvailableQuest();

//         const { data: updatedClaims } = await supabase
//             .from("user_claims")
//             .select("*")
//             .eq("character_id", activeCharId);

//         if (updatedClaims) {
//             userClaims = updatedClaims;
//             window.userClaims = userClaims;
//             await renderQuestsList();

//             if (nextQuest) {
//                 showQuestDetails(nextQuest, false);
//             } else {
//                 activeQuestKey = null;
//                 window.activeQuestKey = null;
//                 const emptyState = document.getElementById('empty-state');
//                 const content = document.getElementById('details-content');
//                 if (emptyState) emptyState.classList.remove('hidden');
//                 if (content) content.classList.add('hidden');
//                 const url = new URL(window.location);
//                 url.searchParams.delete('quest');
//                 window.history.replaceState({}, '', url);
//             }
//         }
//     });

//     const urlParams = new URLSearchParams(window.location.search);
//     const targetQuestKey = urlParams.get('quest');
//     if (targetQuestKey && allQuests.length > 0) {
//         const targetQuest = allQuests.find(q => q.quest_key === targetQuestKey);
//         if (targetQuest) {
//             showQuestDetails(targetQuest, userClaims.some(c => c.quest_id === targetQuest.id));
//         }
//     }
// }

supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("user_quest_role");
    }
    updateSidebarPermissions().catch(() => {});
    renderQuestsList();
});

init();