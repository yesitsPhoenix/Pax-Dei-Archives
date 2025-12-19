import { supabase } from "../supabaseClient.js";

let allQuests = [];
let regionsData = [];

async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error(error);
    return user;
}

async function fetchQuests() {
    const { data, error } = await supabase
        .from("cipher_quests")
        .select(`
            *,
            regions:region_id (*)
        `)
        .eq("active", true)
        .order("sort_order", { ascending: true });
    if (error) console.error(error);
    return data || [];
}

async function fetchRegions() {
    const { data, error } = await supabase
        .from("regions")
        .select("*");
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

function populateFilters(regions) {
    const regionSelect = document.getElementById('filter-region');
    const shardSelect = document.getElementById('filter-shard');
    const provinceSelect = document.getElementById('filter-province');
    const valleySelect = document.getElementById('filter-homevalley');
    const statusSelect = document.getElementById('filter-status');
    const clearBtn = document.getElementById('clear-filters');

    const uniqueRegions = [...new Set(regions.map(r => r.region_name))].sort();
    const uniqueShards = [...new Set(regions.map(r => r.shard))].sort();
    const uniqueProvinces = [...new Set(regions.map(r => r.province))].sort();
    const uniqueValleys = [...new Set(regions.map(r => r.home_valley))].sort();

    uniqueRegions.forEach(name => {
        regionSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
    uniqueShards.forEach(name => {
        shardSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
    uniqueProvinces.forEach(name => {
        provinceSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
    uniqueValleys.forEach(name => {
        valleySelect.innerHTML += `<option value="${name}">${name}</option>`;
    });

    [regionSelect, shardSelect, provinceSelect, valleySelect, statusSelect].forEach(select => {
        select.addEventListener('change', () => renderQuestsList());
    });

    clearBtn.addEventListener('click', () => {
        [regionSelect, shardSelect, provinceSelect, valleySelect, statusSelect].forEach(select => {
            select.value = "";
        });
        renderQuestsList();
    });
}

function openQuestModal(quest, signHtml, userClaimed) {
    const modal = document.getElementById('quest-modal');
    document.getElementById('modal-quest-name').innerText = quest.quest_name;
    document.getElementById('modal-quest-lore').innerText = `"${quest.lore || 'No lore available.'}"`;
    document.getElementById('modal-quest-location').innerText = quest.location || 'Location details are hidden.';
    document.getElementById('modal-sign-sequence').innerHTML = signHtml;
    document.getElementById('modal-quest-items').innerText = quest.items ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : 'None';
    document.getElementById('modal-quest-gold').innerText = `${quest.gold || 0} Gold`;

    const modalFooter = modal.querySelector('div.p-6.border-t');
    let modalShareBtn = document.getElementById('modal-share-btn');
    
    if (!modalShareBtn) {
        modalShareBtn = document.createElement('button');
        modalShareBtn.id = 'modal-share-btn';
        modalShareBtn.className = "mr-auto px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-md font-bold uppercase flex items-center gap-2";
        modalShareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i><span>Share Quest</span>';
        modalFooter.prepend(modalShareBtn);
    }

    modalShareBtn.onclick = () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?quest=${quest.quest_key}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            const icon = modalShareBtn.querySelector('i');
            const text = modalShareBtn.querySelector('span');
            icon.className = "fa-solid fa-check text-green-500";
            text.innerText = "Copied!";
            setTimeout(() => { 
                icon.className = "fa-solid fa-share-nodes"; 
                text.innerText = "Share Quest";
            }, 2000);
        });
    };

    const redeemBtn = document.getElementById('modal-redeem-btn');
    if (userClaimed) {
        redeemBtn.innerText = "Quest Completed";
        redeemBtn.disabled = true;
        redeemBtn.className = "bg-gray-700 text-gray-500 px-8 py-3 rounded-full font-bold cursor-not-allowed";
    } else {
        redeemBtn.innerText = "Go to Redemption";
        redeemBtn.disabled = false;
        redeemBtn.className = "bg-[#FFD700] text-black px-8 py-3 rounded-full font-bold hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-900/20";
        redeemBtn.onclick = () => window.location.href = `redeem.html?quest=${quest.quest_key}`;
    }

    modal.classList.remove('hidden');
}

function generateSignHtml(quest, baseUrl, version) {
    if (quest.signs && Array.isArray(quest.signs)) {
        return quest.signs.map(fullId => {
            const parts = fullId.split('_');
            const category = parts[0];
            const itemName = parts.slice(1).join('_');
            const imgSrc = `${baseUrl}${category}_${itemName}.webp?${version}`;
            return `<img src="${imgSrc}" class="w-16 h-16 bg-gray-900 rounded-lg p-1.5 border-2 border-gray-600 shadow-md transition-transform hover:scale-110" title="${itemName.replace(/_/g, ' ')}">`;
        }).join("");
    }
    return "";
}

async function renderQuestsList() {
    const tableBody = document.getElementById("quest-list-table");
    if (!tableBody) return;

    const user = await getCurrentUser();
    
    const filterR = document.getElementById('filter-region').value;
    const filterS = document.getElementById('filter-shard').value;
    const filterP = document.getElementById('filter-province').value;
    const filterV = document.getElementById('filter-homevalley').value;
    const filterStatus = document.getElementById('filter-status').value;

    let signConfig;
    try {
        const response = await fetch('frontend/www/assets/signs.json');
        signConfig = await response.json();
    } catch (err) {
        console.error("Failed to load signs.json", err);
        return;
    }

    const { baseUrl, version } = signConfig.config;
    let userClaims = [];
    if (user) {
        try {
            userClaims = await fetchUserClaims(user.id);
        } catch (err) {
            console.error("Failed to fetch user claims", err);
        }
    }

    tableBody.innerHTML = "";

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

    filteredQuests.forEach(quest => {
        const userClaimed = userClaims.some(c => c.quest_id === quest.id);
        const signHtml = generateSignHtml(quest, baseUrl, version);

        const row = document.createElement("tr");
        row.className = "hover:bg-white/5 transition-colors group border-b border-gray-800/50 cursor-pointer";
        row.innerHTML = `
            <td class="px-6 py-6">
                <div class="font-bold text-xl text-white mb-1">${quest.quest_name}</div>
                <div class="text-lg text-[#FFD700] uppercase mb-1">
                    ${quest.regions ? `${quest.regions.region_name} • ${quest.regions.shard} • ${quest.regions.home_valley}` : 'World Quest'}
                </div>
                <div class="text-md text-gray-400 italic leading-relaxed max-w-sm">${quest.lore || ''}</div>
            </td>
            <td class="px-6 py-6">
                <div class="flex flex-wrap gap-2 min-w-[180px]">
                    ${signHtml}
                </div>
            </td>
            <td class="px-6 py-6">
                <div class="text-sm text-gray-200 font-medium">
                    ${quest.items ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : 'None'}
                </div>
            </td>
            <td class="px-6 py-6 text-right">
                <div class="text-[#ecaf48] font-bold text-lg whitespace-nowrap">${quest.gold || 0} Gold</div>
            </td>
            <td class="px-6 py-6 text-center">
                <div class="flex items-center justify-center gap-3">
                    <button class="share-btn px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-[10px] font-bold uppercase flex items-center gap-2">
                        <i class="fa-solid fa-share-nodes"></i>
                        <span>Share Quest</span>
                    </button>
                    <button class="info-btn px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-md font-bold uppercase transition-all">
                        More Info
                    </button>
                    <button class="claim-btn px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wide transition-all shadow-lg ${userClaimed ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[#FFD700] text-black hover:bg-yellow-400 hover:shadow-yellow-500/20 active:scale-95'}" ${userClaimed ? "disabled" : ""}>
                        ${userClaimed ? "Complete" : "Redeem"}
                    </button>
                </div>
            </td>
        `;

        row.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                openQuestModal(quest, signHtml, userClaimed);
            }
        });

        row.querySelector('.info-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openQuestModal(quest, signHtml, userClaimed);
        });

        row.querySelector('.share-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const shareUrl = `${window.location.origin}${window.location.pathname}?quest=${quest.quest_key}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const icon = row.querySelector('.share-btn i');
                const text = row.querySelector('.share-btn span');
                const originalIcon = icon.className;
                const originalText = text.innerText;
                
                icon.className = "fa-solid fa-check text-green-500";
                text.innerText = "Copied!";
                
                setTimeout(() => { 
                    icon.className = originalIcon; 
                    text.innerText = originalText;
                }, 2000);
            });
        });

        const btn = row.querySelector(".claim-btn");
        if (!userClaimed && btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = `redeem.html?quest=${quest.quest_key}`;
            };
        }

        tableBody.appendChild(row);
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
            const userClaimed = userClaims.some(c => c.quest_id === targetQuest.id);
            
            let signConfig;
            const response = await fetch('frontend/www/assets/signs.json');
            signConfig = await response.json();
            const { baseUrl, version } = signConfig.config;
            
            const signHtml = generateSignHtml(targetQuest, baseUrl, version);
            openQuestModal(targetQuest, signHtml, userClaimed);
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('quest-modal');
    if (!modal) return;
    
    const closeElements = [
        document.getElementById('close-modal'),
        document.getElementById('modal-close-btn'),
        modal
    ];
    
    closeElements.forEach(el => {
        if (!el) return;
        el.addEventListener('click', (e) => {
            if (e.target === el || el.id === 'close-modal' || el.id === 'modal-close-btn') {
                modal.classList.add('hidden');
                const url = new URL(window.location);
                url.searchParams.delete('quest');
                window.history.replaceState({}, '', url);
            }
        });
    });
});

supabase.auth.onAuthStateChange(() => {
    renderQuestsList();
});

init();