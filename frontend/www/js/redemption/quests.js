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

function openQuestModal(quest, signHtml, userClaimed) {
    const modal = document.getElementById('quest-modal');
    document.getElementById('modal-quest-name').innerText = quest.quest_name;
    document.getElementById('modal-quest-lore').innerText = `"${quest.lore || 'No lore available.'}"`;
    document.getElementById('modal-quest-location').innerText = quest.location || 'Location details are hidden.';
    document.getElementById('modal-sign-sequence').innerHTML = signHtml;
    document.getElementById('modal-quest-items').innerText = quest.items ? (Array.isArray(quest.items) ? quest.items.join(', ') : quest.items) : 'None';
    document.getElementById('modal-quest-gold').innerText = `${quest.gold || 0} Gold`;

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

async function renderQuests() {
    const user = await getCurrentUser();
    const quests = await fetchQuests();
    
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
    if (user) userClaims = await fetchUserClaims(user.id);

    const tableBody = document.getElementById("quest-list-table");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    quests.forEach(quest => {
        const userClaimed = userClaims.some(c => c.quest_id === quest.id);

        let signHtml = "";
        if (quest.signs && Array.isArray(quest.signs)) {
            signHtml = quest.signs.map(fullId => {
                const parts = fullId.split('_');
                const category = parts[0];
                const itemName = parts.slice(1).join('_');
                const imgSrc = `${baseUrl}${category}_${itemName}.webp?${version}`;
                return `<img src="${imgSrc}" class="w-16 h-16 bg-gray-900 rounded-lg p-1.5 border-2 border-gray-600 shadow-md transition-transform hover:scale-110" title="${itemName.replace(/_/g, ' ')}">`;
            }).join("");
        }

        const row = document.createElement("tr");
        row.className = "hover:bg-white/5 transition-colors group border-b border-gray-800/50 cursor-pointer";
        row.innerHTML = `
            <td class="px-6 py-6">
                <div class="font-bold text-lg text-white mb-1">${quest.quest_name}</div>
                <div class="text-sm text-gray-400 italic leading-relaxed max-w-sm">${quest.lore || ''}</div>
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
                    <button class="info-btn px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold uppercase transition-all">
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

        row.querySelector('.info-btn').addEventListener('click', () => {
            openQuestModal(quest, signHtml, userClaimed);
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
            }
        });
    });
});

supabase.auth.onAuthStateChange(() => {
    renderQuests();
});

renderQuests();