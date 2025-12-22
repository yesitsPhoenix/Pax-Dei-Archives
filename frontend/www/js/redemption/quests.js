import { supabase } from "../supabaseClient.js";
import { getUnlockedCategories, applyLockStyles } from "./unlocks.js";
import { enableSignTooltip } from '../ui/signTooltip.js';

let allQuests = [];
let regionsData = [];
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

async function updateSidebarPermissions() {
    const createBtn = document.getElementById("create-quest-nav");
    const editBtn = document.getElementById("edit-quest-nav");

    if (!createBtn || !editBtn) return;

    const cachedRole = sessionStorage.getItem("user_quest_role");
    if (cachedRole === "quest_adder") {
        createBtn.classList.remove("hidden");
        editBtn.classList.remove("hidden");
        return;
    }

    const user = await getCurrentUser();
    if (!user) {
        createBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
        return;
    }

    const { data } = await supabase
        .from("admin_users")
        .select("quest_role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (data?.quest_role === "quest_adder") {
        sessionStorage.setItem("user_quest_role", "quest_adder");
        createBtn.classList.remove("hidden");
        editBtn.classList.remove("hidden");
    } else {
        sessionStorage.removeItem("user_quest_role");
        createBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
    }
}

async function fetchQuests() {
    const { data, error } = await supabase
        .from("cipher_quests")
        .select(`*, regions:region_id (*)`)
        .eq("active", true)
        .order("sort_order", { ascending: true });
    if (error) console.error("Error fetching quests:", error);
    return data || [];
}

async function fetchRegions() {
    const { data, error } = await supabase.from("regions").select("*");
    if (error) console.error("Error fetching regions:", error);
    return data || [];
}

async function fetchUserClaims(userId) {
    const { data, error } = await supabase
        .from("user_claims")
        .select("*")
        .eq("user_id", userId);
    if (error) console.error("Error fetching claims:", error);
    return data || [];
}

function populateFilters(regions) {
    const statusInput = document.getElementById('filter-status');
    const filterButtons = document.querySelectorAll('.sidebar-filter-btn');

    if (statusInput && filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                
                filterButtons.forEach(b => b.classList.remove('active', 'bg-[#FFD700]', 'text-black'));
                btn.classList.add('active', 'bg-[#FFD700]', 'text-black');

                const statusValue = btn.getAttribute('data-filter-status');
                statusInput.value = statusValue;

                renderQuestsList();
            });
        });
    }

    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (statusInput) statusInput.value = "";
            filterButtons.forEach(b => b.classList.remove('active', 'bg-[#FFD700]', 'text-black'));
            const allBtn = document.querySelector('[data-filter-status=""]');
            if (allBtn) allBtn.classList.add('active', 'bg-[#FFD700]', 'text-black');
            
            activeQuestKey = null;
            renderQuestsList();
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
    const user = await getCurrentUser();
    if (!user) return;

    const { error } = await supabase
        .from('user_claims')
        .insert({
            user_id: user.id,
            quest_id: quest.id,
            claimed_at: new Date().toISOString()
        });

    if (!error) {
        const modal = document.getElementById('redemption-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        await renderQuestsList();
        await showQuestDetails(quest, true);
    } else {
        alert("Error claiming quest: " + error.message);
    }
}

async function showQuestDetails(quest, userClaimed) {
    activeQuestKey = quest.quest_key;
    const emptyState = document.getElementById('empty-state');
    const content = document.getElementById('details-content');
    
    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

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
            p.style.marginBottom = "1rem";
        });

        target.querySelectorAll('a').forEach(link => {
            link.classList.add('text-[#FFD700]', 'hover:underline', 'underline-offset-4', 'font-bold');
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        });

        target.querySelectorAll('blockquote').forEach(quote => {
            quote.classList.add('border-l-4', 'border-[#FFD700]/50', 'bg-black/20', 'p-4', 'my-4', 'rounded-r-lg', 'italic', 'text-gray-400');
            quote.style.whiteSpace = "pre-wrap";
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

    const statusBadge = document.getElementById('detail-status-badge');
    statusBadge.innerHTML = userClaimed 
        ? '<span class="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-green-500/30">Completed</span>'
        : '<span class="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-yellow-500/30">Active</span>';

    const redeemBtn = document.getElementById('detail-redeem-btn');
    if (userClaimed) {
        redeemBtn.innerText = "Quest Completed";
        redeemBtn.disabled = true;
        redeemBtn.className = "ml-auto bg-gray-800 w-52 text-gray-500 py-3 rounded-lg font-bold uppercase text-md cursor-not-allowed";
    } else {
        redeemBtn.innerText = "Complete Quest";
        redeemBtn.disabled = false;
        redeemBtn.className = "ml-auto bg-[#FFD700] w-52 text-black py-3 rounded-lg font-bold uppercase text-md hover:bg-green-300 transition-all";
        
        redeemBtn.onclick = async () => {
            const user = await getCurrentUser();
            if (!user) {
                alert("Please login to complete quests.");
                return;
            }

            const modal = document.getElementById('redemption-modal');
            if (quest.signs && Array.isArray(quest.signs) && quest.signs.length > 0) {
                document.getElementById('modal-target-quest-name').innerText = quest.quest_name;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            } else {
                const modalContent = modal.querySelector('.bg-\\[\\#1f2937\\]');
                const originalHtml = modalContent.innerHTML;

                modal.classList.remove('hidden');
                modal.classList.add('flex');

                modalContent.innerHTML = `
                    <div class="p-8 text-center">
                        <h2 class="text-2xl font-bold text-white mb-4">Complete Quest</h2>
                        <p class="text-gray-400 mb-8">Confirm completion of <span class="text-[#FFD700] font-bold">"${quest.quest_name}"</span>?</p>
                        <div class="flex gap-4 justify-center">
                            <button id="cancel-direct-claim" class="px-6 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition-all">Cancel</button>
                            <button id="confirm-direct-claim" class="px-6 py-2 bg-[#FFD700] text-black rounded-lg font-bold hover:bg-green-300 transition-all">Confirm</button>
                        </div>
                    </div>
                `;

                document.getElementById('cancel-direct-claim').onclick = () => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    modalContent.innerHTML = originalHtml;
                };

                document.getElementById('confirm-direct-claim').onclick = async () => {
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

    document.getElementById('close-redemption')?.addEventListener('click', () => {
        document.getElementById('redemption-modal').classList.add('hidden');
        document.getElementById('redemption-modal').classList.remove('flex');
    });

    const url = new URL(window.location);
    url.searchParams.set('quest', quest.quest_key);
    window.history.replaceState({}, '', url);
}

async function renderQuestsList() {
    const listContainer = document.getElementById("quest-titles-list");
    if (!listContainer) return;

    const user = await getCurrentUser();
    const filterStatus = document.getElementById('filter-status')?.value;

    let userClaims = [];
    if (user) userClaims = await fetchUserClaims(user.id);

    const unlockedCategoriesList = await getUnlockedCategories(user?.id, allQuests, userClaims);
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
        const userClaimed = userClaims.some(c => c.quest_id === quest.id);
        let matchesStatus = true;
        if (filterStatus === "completed") matchesStatus = userClaimed;
        if (filterStatus === "incomplete") matchesStatus = !userClaimed;
        return matchesStatus;
    });

    const groupedQuests = filteredQuests.reduce((acc, quest) => {
        const cat = quest.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(quest);
        return acc;
    }, {});

    Object.keys(groupedQuests).sort().forEach(category => {
        const isCollapsed = collapsedCategories.has(category);
        const isLocked = !unlockedCategories.has(category);
        
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-header p-3 px-4 text-[12px] font-bold uppercase tracking-widest text-[#FFD700] border-b border-gray-700/50 sticky top-0 z-10 backdrop-blur-md cursor-pointer flex justify-between items-center hover:bg-white/5";
        
        const catTitle = document.createElement("span");
        catTitle.innerText = `${category} (${groupedQuests[category].length})`;
        categoryHeader.appendChild(catTitle);

        const catIconContainer = document.createElement("div");
        catIconContainer.className = "flex items-center gap-3";
        catIconContainer.innerHTML = `<i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-gray-500"></i>`;
        categoryHeader.appendChild(catIconContainer);

        if (isLocked) {
            applyLockStyles(categoryHeader, catIconContainer);
        } else {
            categoryHeader.onclick = () => {
                if (isCollapsed) collapsedCategories.delete(category);
                else collapsedCategories.add(category);
                renderQuestsList();
            };
        }

        listContainer.appendChild(categoryHeader);

        if (!isCollapsed && !isLocked) {
            groupedQuests[category].forEach(quest => {
                const reqCat = quest.unlock_prerequisite_category;
                const reqCount = quest.unlock_required_count || 0;
                const questIsLocked = reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount;

                const userClaimed = userClaims.some(c => c.quest_id === quest.id);
                const item = document.createElement("div");
                item.dataset.key = quest.quest_key;
                item.className = `quest-item p-4 border-b border-gray-700/50 cursor-pointer text-md transition-all hover:bg-white/5 ${activeQuestKey === quest.quest_key ? 'bg-white/10 border-l-4 border-[#FFD700]' : ''}`;
                
                const itemFlex = document.createElement("div");
                itemFlex.className = "flex justify-between items-center pointer-events-none";
                itemFlex.innerHTML = `<div><div class="font-bold text-white text-md">${quest.quest_name}</div></div>`;
                
                const statusIconContainer = document.createElement("div");
                statusIconContainer.innerHTML = userClaimed 
                    ? '<i class="fa-solid fa-circle-check text-green-500 text-md"></i>' 
                    : '<i class="fa-solid fa-circle text-gray-700 text-[8px]"></i>';
                
                itemFlex.appendChild(statusIconContainer);
                item.appendChild(itemFlex);

                if (questIsLocked) {
                    applyLockStyles(item, statusIconContainer);
                } else {
                    item.onclick = () => showQuestDetails(quest, userClaimed);
                }
                listContainer.appendChild(item);
            });
        }
    });
}

async function init() {
    enableSignTooltip();
    updateSidebarPermissions();
    allQuests = await fetchQuests();
    regionsData = await fetchRegions();
    populateFilters(regionsData);
    await renderQuestsList();

    window.addEventListener("questClaimed", async (e) => {
        const { quest } = e.detail;
        await renderQuestsList();
        await showQuestDetails(quest, true);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const targetQuestKey = urlParams.get('quest');
    if (targetQuestKey) {
        const targetQuest = allQuests.find(q => q.quest_key === targetQuestKey);
        if (targetQuest) {
            const user = await getCurrentUser();
            let userClaims = [];
            if (user) userClaims = await fetchUserClaims(user.id);
            
            const categoryProgress = {};
            userClaims.forEach(claim => {
                const q = allQuests.find(item => item.id === claim.quest_id);
                if (q && q.category) {
                    categoryProgress[q.category] = (categoryProgress[q.category] || 0) + 1;
                }
            });

            const reqCat = targetQuest.unlock_prerequisite_category;
            const reqCount = targetQuest.unlock_required_count || 0;
            const questIsLocked = reqCat && reqCat !== "" && (categoryProgress[reqCat] || 0) < reqCount;

            if (!questIsLocked) {
                showQuestDetails(targetQuest, userClaims.some(c => c.quest_id === targetQuest.id));
            } else {
                const emptyState = document.getElementById('empty-state');
                if (emptyState) {
                    emptyState.innerHTML = `
                        <div class="text-center">
                            <i class="fa-solid fa-lock text-4xl mb-4 text-[#FFD700]/50"></i>
                            <p class="text-xl font-bold text-white mb-2">Quest Locked</p>
                            <p class="text-gray-400 italic">This chapter is currently hidden from your records.</p>
                        </div>
                    `;
                }
            }
        }
    }
}

supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("user_quest_role");
    }
    updateSidebarPermissions();
    renderQuestsList();
});

init();