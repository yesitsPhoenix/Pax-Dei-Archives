import { supabase } from "../supabaseClient.js";

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
    const regionSelect = document.getElementById('filter-region');
    const shardSelect = document.getElementById('filter-shard');
    const provinceSelect = document.getElementById('filter-province');
    const valleySelect = document.getElementById('filter-homevalley');
    const statusSelect = document.getElementById('filter-status');
    const clearBtn = document.getElementById('clear-filters');

    if (!regionSelect) return;

    const uniqueRegions = [...new Set(regions.map(r => r.region_name))].filter(Boolean).sort();
    const uniqueShards = [...new Set(regions.map(r => r.shard))].filter(Boolean).sort();
    const uniqueProvinces = [...new Set(regions.map(r => r.province))].filter(Boolean).sort();
    const uniqueValleys = [...new Set(regions.map(r => r.home_valley))].filter(Boolean).sort();

    uniqueRegions.forEach(name => { regionSelect.innerHTML += `<option value="${name}">${name}</option>`; });
    uniqueShards.forEach(name => { shardSelect.innerHTML += `<option value="${name}">${name}</option>`; });
    uniqueProvinces.forEach(name => { provinceSelect.innerHTML += `<option value="${name}">${name}</option>`; });
    uniqueValleys.forEach(name => { valleySelect.innerHTML += `<option value="${name}">${name}</option>`; });

    [regionSelect, shardSelect, provinceSelect, valleySelect, statusSelect].forEach(select => {
        if (select) select.addEventListener('change', () => renderQuestsList());
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            [regionSelect, shardSelect, provinceSelect, valleySelect, statusSelect].forEach(select => { if(select) select.value = ""; });
            activeQuestKey = null;
            document.getElementById('empty-state')?.classList.remove('hidden');
            document.getElementById('details-content')?.classList.add('hidden');
            const url = new URL(window.location);
            url.searchParams.delete('quest');
            window.history.replaceState({}, '', url.pathname);
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
            return `<img src="${imgSrc}" class="w-16 h-16 bg-gray-900 rounded-lg p-1 border border-gray-600 transition-transform duration-200 hover:scale-110 hover:border-[#FFD700] cursor-pointer" title="${itemName.replace(/_/g, ' ')}" onerror="this.style.display='none'">`;
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
        location.reload();
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
    
    const rawLore = quest.lore || "No lore available.";
    const loreTarget = document.getElementById('detail-lore');

    marked.setOptions({
        gfm: true,
        breaks: true,
        pedantic: false,
        smartLists: true,
        smartypants: false
    });

    loreTarget.innerHTML = marked.parse(rawLore.trim());

    loreTarget.querySelectorAll('p').forEach(p => {
        p.style.whiteSpace = "pre-wrap";
        p.style.marginBottom = "1rem";
    });

    loreTarget.querySelectorAll('a').forEach(link => {
        link.classList.add('text-[#FFD700]', 'hover:underline', 'underline-offset-4', 'font-bold');
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    });

    loreTarget.querySelectorAll('blockquote').forEach(quote => {
        quote.classList.add('border-l-4', 'border-[#FFD700]/50', 'bg-black/20', 'p-4', 'my-4', 'rounded-r-lg', 'italic', 'text-gray-400');
        quote.style.whiteSpace = "pre-wrap";
    });

    document.getElementById('detail-location').innerText = quest.location || 'No location details exist for this quest.';

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
        document.getElementById('detail-signs').innerHTML = `<span class="text-gray-500 italic text-sm">No sign sequence found.</span>`;
    }

    const statusBadge = document.getElementById('detail-status-badge');
    statusBadge.innerHTML = userClaimed 
        ? '<span class="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-green-500/30">Completed</span>'
        : '<span class="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full text-md font-bold uppercase border border-yellow-500/30">Active</span>';

    const redeemBtn = document.getElementById('detail-redeem-btn');
    if (userClaimed) {
        redeemBtn.innerText = "Quest Completed";
        redeemBtn.disabled = true;
        redeemBtn.className = "ml-auto bg-gray-800 w-52 text-gray-500 py-3 rounded-lg font-bold uppercase text-sm cursor-not-allowed";
    } else {
        redeemBtn.innerText = "Complete Quest";
        redeemBtn.disabled = false;
        redeemBtn.className = "ml-auto bg-[#FFD700] w-52 text-black py-3 rounded-lg font-bold uppercase text-sm hover:bg-yellow-400 transition-all";
        
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
                            <button id="confirm-direct-claim" class="px-6 py-2 bg-[#FFD700] text-black rounded-lg font-bold hover:bg-yellow-400 transition-all">Confirm</button>
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
    const filterR = document.getElementById('filter-region')?.value;
    const filterS = document.getElementById('filter-shard')?.value;
    const filterP = document.getElementById('filter-province')?.value;
    const filterV = document.getElementById('filter-homevalley')?.value;
    const filterStatus = document.getElementById('filter-status')?.value;

    let userClaims = [];
    if (user) userClaims = await fetchUserClaims(user.id);

    listContainer.innerHTML = "";

    const filteredQuests = allQuests.filter(quest => {
        const reg = quest.regions || {};
        const userClaimed = userClaims.some(c => c.quest_id === quest.id);
        const matchesRegion = !filterR || reg.region_name === filterR;
        const matchesShard = !filterS || reg.shard === filterS;
        const matchesProvince = !filterP || reg.province === filterP;
        const matchesValley = !filterV || reg.home_valley === filterV;
        let matchesStatus = true;
        if (filterStatus === "completed") matchesStatus = userClaimed;
        if (filterStatus === "incomplete") matchesStatus = !userClaimed;
        return matchesRegion && matchesShard && matchesProvince && matchesValley && matchesStatus;
    });

    const groupedQuests = filteredQuests.reduce((acc, quest) => {
        const cat = quest.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(quest);
        return acc;
    }, {});

    Object.keys(groupedQuests).sort().forEach(category => {
        const isCollapsed = collapsedCategories.has(category);
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-header p-3 px-4 text-[12px] font-bold uppercase tracking-widest text-[#FFD700] border-b border-gray-700/50 sticky top-0 z-10 backdrop-blur-md cursor-pointer flex justify-between items-center hover:bg-white/5";
        categoryHeader.innerHTML = `
            <span>${category} (${groupedQuests[category].length})</span>
            <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-gray-500"></i>
        `;
        categoryHeader.onclick = () => {
            if (isCollapsed) {
                collapsedCategories.delete(category);
            } else {
                collapsedCategories.add(category);
            }
            renderQuestsList();
        };

        listContainer.appendChild(categoryHeader);

        if (!isCollapsed) {
            groupedQuests[category].forEach(quest => {
                const userClaimed = userClaims.some(c => c.quest_id === quest.id);
                const item = document.createElement("div");
                item.dataset.key = quest.quest_key;
                item.className = `quest-item p-4 border-b border-gray-700/50 cursor-pointer text-md transition-all hover:bg-white/5 ${activeQuestKey === quest.quest_key ? 'bg-white/10 border-l-4 border-[#FFD700]' : ''}`;
                item.innerHTML = `
                    <div class="flex justify-between items-center pointer-events-none">
                        <div>
                            <div class="font-bold text-white text-sm">${quest.quest_name}</div>
                        </div>
                        ${userClaimed ? '<i class="fa-solid fa-circle-check text-green-500 text-md"></i>' : '<i class="fa-solid fa-circle text-gray-700 text-[8px]"></i>'}
                    </div>
                `;
                item.onclick = () => showQuestDetails(quest, userClaimed);
                listContainer.appendChild(item);
            });
        }
    });
}

async function init() {
    allQuests = await fetchQuests();
    regionsData = await fetchRegions();
    populateFilters(regionsData);
    await renderQuestsList();

    const urlParams = new URLSearchParams(window.location.search);
    const targetQuestKey = urlParams.get('quest');
    if (targetQuestKey) {
        const targetQuest = allQuests.find(q => q.quest_key === targetQuestKey);
        if (targetQuest) {
            const user = await getCurrentUser();
            let userClaims = [];
            if (user) userClaims = await fetchUserClaims(user.id);
            showQuestDetails(targetQuest, userClaims.some(c => c.quest_id === targetQuest.id));
        }
    }
}

supabase.auth.onAuthStateChange(() => {
    renderQuestsList();
});

init();