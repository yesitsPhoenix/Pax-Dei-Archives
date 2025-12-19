import { supabase } from "../supabaseClient.js";

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const keyword = "thelonius";

function getCipherShift(word) {
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 5;
}

let selected = [];
let allSignIds = [];
const urlParams = new URLSearchParams(window.location.search);
const questId = urlParams.get('id');

const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

async function init() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "quests.html";
        return;
    }

    if (!questId) {
        await renderQuestManager(user.id);
    } else {
        await loadEditor(user.id);
    }
}

async function renderQuestManager(userId) {
    const container = document.querySelector('.page-content');
    container.innerHTML = `
        <div class="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-black/40 text-[#FFD700] text-[10px] uppercase tracking-widest font-bold border-b border-gray-700">
                        <th class="px-6 py-4">Quest Name</th>
                        <th class="px-6 py-4">Location</th>
                        <th class="px-6 py-4">Key</th>
                        <th class="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody id="user-quest-list" class="text-white divide-y divide-gray-700/50">
                </tbody>
            </table>
            <div id="manager-loading" class="p-12 text-center">
                <i class="fas fa-circle-notch fa-spin text-2xl text-[#FFD700]"></i>
            </div>
        </div>
    `;

    const { data: quests, error } = await supabase
        .from("cipher_quests")
        .select("*, regions(region_name)")
        .eq("created_by", userId);

    const list = document.getElementById('user-quest-list');
    const loader = document.getElementById('manager-loading');
    if (loader) loader.remove();

    if (error || !quests || quests.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400">You haven\'t created any quests yet.</td></tr>';
        return;
    }

    quests.forEach(quest => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-white/5 transition-colors group';
        row.innerHTML = `
            <td class="px-6 py-4 font-bold">${quest.quest_name}</td>
            <td class="px-6 py-4 text-sm text-gray-400">${quest.regions ? quest.regions.region_name : 'N/A'}</td>
            <td class="px-6 py-4 font-mono text-lg text-[#FFD700]">${quest.quest_key}</td>
            <td class="px-6 py-4 text-right">
                <a href="edit_quest.html?id=${quest.id}" class="bg-[#FFD700] hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-m uppercase transition-all inline-block">
                    Edit Quest
                </a>
            </td>
        `;
        list.appendChild(row);
    });
}

async function loadEditor(userId) {
    const signRes = await fetch('frontend/www/assets/signs.json');
    const signData = await signRes.json();
    const { baseUrl, version } = signData.config;

    const { data: quest, error: questError } = await supabase
        .from("cipher_quests")
        .select("*, regions(*)")
        .eq("id", questId)
        .eq("created_by", userId)
        .maybeSingle();

    if (questError || !quest) {
        window.location.href = 'edit_quest.html';
        return;
    }

    const { data: regions } = await supabase
        .from("regions")
        .select("*")
        .order("region_name", { ascending: true })
        .order("shard", { ascending: true });

    const select = document.getElementById("region-selection");
    regions.forEach(reg => {
        const option = document.createElement("option");
        option.value = reg.id;
        option.textContent = `${reg.region_name} | ${reg.shard} | ${reg.province} | ${reg.home_valley}`;
        select.appendChild(option);
    });

    signData.categories.forEach(category => {
        category.items.forEach(itemName => {
            allSignIds.push(`${category.id}_${itemName}`);
        });
    });

    allSignIds.forEach(fullId => {
        const btn = document.createElement("button");
        btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#FFD700] transition-all";

        const img = document.createElement("img");
        img.src = `${baseUrl}${fullId}.webp?${version}`;
        img.className = "w-full h-auto pointer-events-none";
        img.onerror = () => btn.remove();

        btn.appendChild(img);
        btn.onclick = () => {
            const limitMsg = document.getElementById("limit-message");
            if (selected.length < 5) {
                selected.push(fullId);
                updateSelected(baseUrl, version);
                if (limitMsg) limitMsg.classList.add("hidden");
            } else {
                if (limitMsg) limitMsg.classList.remove("hidden");
            }
        };
        grid.appendChild(btn);
    });

    document.getElementById('quest-name').value = quest.quest_name;
    document.getElementById('quest-key').value = quest.quest_key;
    document.getElementById('region-selection').value = quest.region_id;
    document.getElementById('location').value = quest.location || '';
    document.getElementById('lore').value = quest.lore || '';
    document.getElementById('items').value = Array.isArray(quest.items) ? quest.items.join(', ') : quest.items;
    document.getElementById('gold').value = quest.gold || 0;
    document.getElementById('max-claims').value = quest.max_claims || 1;

    if (quest.signs) {
        selected.push(...quest.signs);
        updateSelected(baseUrl, version);
    }

    setupEditorEvents();
}

function updateSelected(baseUrl, version) {
    selectedDisplay.innerHTML = "";
    
    selected.forEach((placedId, index) => {
        const column = document.createElement("div");
        column.className = "flex flex-col items-center gap-3 mb-4 w-40";

        const currentIndex = allSignIds.indexOf(placedId);
        const shift = getCipherShift(keyword);
        const encodedIndex = (currentIndex + shift) % allSignIds.length;
        const encodedSignId = allSignIds[encodedIndex];

        const topContainer = document.createElement("div");
        topContainer.className = "relative group flex flex-col items-center";

        const badge = document.createElement("div");
        badge.className = "absolute -top-2 -left-2 bg-[#FFD700] text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-m shadow-md z-10";
        badge.textContent = index + 1;

        const imgTop = document.createElement("img");
        imgTop.src = `${baseUrl}${placedId}.webp?${version}`;
        imgTop.className = "w-28 h-28 bg-gray-700 rounded-xl p-3 border-2 border-[#FFD700] shadow-xl";

        const placedName = placedId.split('_').slice(1).join(' ').replace(/_/g, ' ');
        const labelTop = document.createElement("span");
        labelTop.className = "text-[14px] text-white font-bold uppercase mt-1 text-center";
        labelTop.textContent = placedName;

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "×";
        removeBtn.className = "absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20";
        removeBtn.onclick = () => {
            selected.splice(index, 1);
            updateSelected(baseUrl, version);
        };

        topContainer.append(badge, imgTop, labelTop, removeBtn);

        const arrow = document.createElement("div");
        arrow.className = "text-[#FFD700] flex flex-col items-center opacity-80";
        arrow.innerHTML = '<span class="text-[14px] font-black uppercase mb-1">Place this sign:</span><i class="fa-solid fa-circle-chevron-down text-lg"></i>';

        const bottomContainer = document.createElement("div");
        bottomContainer.className = "flex flex-col items-center p-4 bg-black/60 rounded-xl border-2 border-dashed border-gray-600 w-full";
        
        const imgBottom = document.createElement("img");
        imgBottom.src = `${baseUrl}${encodedSignId}.webp?${version}`;
        imgBottom.className = "w-24 h-24 object-contain mb-2";
        
        const encodedName = encodedSignId.split('_').slice(1).join('_').replace(/_/g, ' ');
        const labelBottom = document.createElement("span");
        labelBottom.className = "text-[14px] text-[#FFD700] font-bold uppercase text-center";
        labelBottom.textContent = encodedName;
        
        const infoBottom = document.createElement("span");
        infoBottom.className = "text-[10px] text-gray-400 uppercase mt-2 font-bold";
        infoBottom.textContent = "User Enters This";

        bottomContainer.append(imgBottom, labelBottom, infoBottom);

        column.append(topContainer, arrow, bottomContainer);
        selectedDisplay.appendChild(column);
    });
}

function setupEditorEvents() {
    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        selectedDisplay.innerHTML = "";
        document.getElementById("limit-message")?.classList.add("hidden");
    };

    document.getElementById('update-quest').onclick = () => {
        document.getElementById('confirmation-modal').classList.remove('hidden');
        document.getElementById('confirmation-modal').classList.add('flex');
    };

    document.getElementById('modal-cancel').onclick = () => {
        document.getElementById('confirmation-modal').classList.add('hidden');
        document.getElementById('confirmation-modal').classList.remove('flex');
    };

    document.getElementById('modal-confirm').onclick = async () => {
        const itemsInput = document.getElementById('items').value;
        const reward_keys = selected.map(placedId => {
            const currentIndex = allSignIds.indexOf(placedId);
            const shift = getCipherShift(keyword);
            const encodedIndex = (currentIndex + shift) % allSignIds.length;
            return allSignIds[encodedIndex].split('_').slice(1).join('_');
        });

        const updatedData = {
            quest_name: document.getElementById('quest-name').value.trim(),
            quest_key: document.getElementById('quest-key').value.trim(),
            region_id: document.getElementById('region-selection').value,
            location: document.getElementById('location').value.trim(),
            lore: document.getElementById('lore').value.trim(),
            items: itemsInput ? itemsInput.split(',').map(i => i.trim()).filter(Boolean) : [],
            gold: parseInt(document.getElementById('gold').value) || 0,
            max_claims: parseInt(document.getElementById('max-claims').value) || 1,
            signs: selected,
            reward_key: reward_keys.join(",")
        };

        const { error } = await supabase
            .from("cipher_quests")
            .update(updatedData)
            .eq("id", questId);

        if (error) {
            alert(error.message);
        } else {
            window.location.href = 'edit_quest.html';
        }
    };
}

init();