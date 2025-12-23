import { supabase } from "../supabaseClient.js";
import { enableSignTooltip } from '../ui/signTooltip.js';


const alphabet = "abcdefghijklmnopqrstuvwxyz";


function getCipherShift(word) {
    if (!word || word.toLowerCase() === "none") return 0;
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 0;
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

    const signRes = await fetch('frontend/www/assets/signs.json');
    const signData = await signRes.json();
    
    signData.categories.forEach(category => {
        category.items.forEach(itemName => {
            allSignIds.push(`${category.id}_${itemName}`);
        });
    });

    if (!questId) {
        await renderQuestManager(user.id, signData.config);
    } else {
        await loadEditor(user.id, signData);
    }
}

async function renderQuestManager(userId, config) {
    const { baseUrl, version } = config;
    
    const managerInterface = document.getElementById('manager-interface');
    const editorInterface = document.getElementById('editor-interface');
    
    if (managerInterface) managerInterface.classList.remove('hidden');
    if (editorInterface) editorInterface.classList.add('hidden');

    managerInterface.innerHTML = `
        <div id="manager-controls" class="mb-6 flex flex-wrap gap-4 items-end">
            <div class="w-full md:w-64">
                <label class="block text-base font-bold text-gray-400 uppercase mb-2 tracking-wider">Filter by Category</label>
                <select id="filter-category" class="w-full bg-[#1f2937] border border-gray-700 rounded-lg p-3 text-white focus:border-[#FFD700] outline-none cursor-pointer text-base">
                    <option value="all">All Categories</option>
                </select>
            </div>
            <div class="w-full md:w-64">
                <label class="block text-base font-bold text-gray-400 uppercase mb-2 tracking-wider">Search Quests</label>
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input type="text" id="search-quests" placeholder="Quest name..." class="w-full bg-[#1f2937] border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-[#FFD700] outline-none text-base">
                </div>
            </div>
        </div>
        <div class="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-black/40 text-[#FFD700] text-base uppercase tracking-widest font-bold border-b border-gray-700">
                            <th class="px-6 py-4">Quest Name</th>
                            <th class="px-6 py-4">Category</th>
                            <th class="px-6 py-4">Cipher (World)</th>
                            <th class="px-6 py-4">Solution (Input)</th>
                            <th class="px-6 py-4">Key</th>
                            <th class="px-6 py-4">Claims</th>
                            <th class="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="user-quest-list" class="text-white divide-y divide-gray-700/50">
                    </tbody>
                </table>
            </div>
            <div id="manager-loading" class="p-12 text-center">
                <i class="fas fa-circle-notch fa-spin text-2xl text-[#FFD700]"></i>
            </div>
        </div>
    `;

    const questsReq = supabase.from("cipher_quests").select("*").eq("created_by", userId);
    const claimsReq = supabase.from("user_claims").select("quest_id");

    const [questsRes, claimsRes] = await Promise.all([questsReq, claimsReq]);

    const quests = questsRes.data || [];
    const claims = claimsRes.data || [];
    const list = document.getElementById('user-quest-list');
    const loader = document.getElementById('manager-loading');
    const filterSelect = document.getElementById('filter-category');
    const searchInput = document.getElementById('search-quests');
    
    if (loader) loader.remove();

    if (questsRes.error || quests.length === 0) {
        list.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-gray-400 text-base">No quests found.</td></tr>';
        return;
    }

    const categories = [...new Set(quests.map(q => q.category).filter(Boolean))];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterSelect.appendChild(opt);
    });

    const renderRows = () => {
        const catFilter = filterSelect.value;
        const searchFilter = searchInput.value.toLowerCase();
        list.innerHTML = "";

        const filtered = quests.filter(q => {
            const matchesCat = catFilter === 'all' || q.category === catFilter;
            const matchesSearch = q.quest_name.toLowerCase().includes(searchFilter);
            return matchesCat && matchesSearch;
        });

        filtered.forEach(quest => {
            const claimCount = claims.filter(c => c.quest_id === quest.id).length;
            const maxClaims = quest.max_claims || 0;
            const keyword = quest.cipher_keyword || 'None';
            const shift = getCipherShift(keyword);
            
            const cipherKeyHtml = quest.signs && quest.signs.length > 0
                ? quest.signs.map(id =>
                    `<img src="${baseUrl}${id}.webp?${version}" style="width: 50px; height: 50px;" class="inline-block bg-black/40 rounded p-1 border border-gray-700 mr-1 hover:border-[#72e0cc]" data-sign="${id}">`
                ).join('')
                : '<span class="text-gray-500 italic text-base">None</span>';


            const solutionSignsHtml = quest.signs && quest.signs.length > 0
                ? quest.signs.map(id => {
                    const currentIndex = allSignIds.indexOf(id);
                    const encodedIndex = (currentIndex + shift) % allSignIds.length;
                    const encodedId = allSignIds[encodedIndex];
                    return `<img src="${baseUrl}${encodedId}.webp?${version}" style="width: 50px; height: 50px;" class="inline-block bg-gray-800 rounded p-1 border border-gray-600 mr-1 hover:border-[#72e0cc]" data-sign="${encodedId}">`;
                }).join('')
                : '<span class="text-gray-500 italic text-base">No Signs</span>';

            const row = document.createElement('tr');
            row.className = 'hover:bg-white/5 transition-colors group';
            
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="font-bold text-base">${quest.quest_name}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-base text-gray-300 font-medium">${quest.category || 'No Category'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">${cipherKeyHtml}</td>
                <td class="px-6 py-4 whitespace-nowrap">${solutionSignsHtml}</td>
                <td class="px-6 py-4">
                     <span class="text-base font-bold text-[#FFD700] uppercase">${keyword}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2 text-base">
                        <span class="font-bold ${claimCount >= maxClaims && maxClaims > 0 ? 'text-red-400' : 'text-green-400'}">${claimCount}</span>
                        <span class="text-gray-500">/</span>
                        <span class="text-gray-400">${maxClaims}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <a href="?id=${quest.id}" class="bg-[#FFD700] hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-black text-base uppercase transition-all shadow-lg active:scale-95 inline-block text-center decoration-0">
                        Edit Quest
                    </a>
                </td>
            `;
            list.appendChild(row);
        });
    };

    filterSelect.addEventListener('change', renderRows);
    searchInput.addEventListener('input', renderRows);
    renderRows();
}

async function loadEditor(userId, signData) {
    const { baseUrl, version } = signData.config;

    document.getElementById('manager-interface').classList.add('hidden');
    document.getElementById('editor-interface').classList.remove('hidden');

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

    const { data: allQuests } = await supabase
        .from("cipher_quests")
        .select("category");

    const categories = [...new Set(allQuests.map(q => q.category).filter(Boolean))];
    const catSelect = document.getElementById("quest-category-select");
    
    catSelect.innerHTML = '<option value="" disabled selected>Select Category</option><option value="NEW">+ Add New Category</option>';
    
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    const { data: regions } = await supabase
        .from("regions")
        .select("*")
        .order("region_name", { ascending: true })
        .order("shard", { ascending: true });

    const select = document.getElementById("region-selection");
    select.innerHTML = '<option value="">Select Location...</option>';
    const globalOption = document.createElement("option");
    globalOption.value = "global";
    globalOption.textContent = "Global | All Shards | All Provinces | All Valleys";
    select.appendChild(globalOption);

    regions.forEach(reg => {
        const option = document.createElement("option");
        option.value = reg.id;
        option.textContent = `${reg.region_name} | ${reg.shard} | ${reg.province} | ${reg.home_valley}`;
        select.appendChild(option);
    });


    grid.innerHTML = "";
    allSignIds.forEach(fullId => {
        const btn = document.createElement("button");
        btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#72e0cc] transition-all";

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
    document.getElementById('quest-author').value = quest.author || '';
    document.getElementById('quest-key').value = quest.quest_key;
    document.getElementById('quest-category-select').value = quest.category || '';
    document.getElementById('region-selection').value = quest.region_id || "global";
    document.getElementById('location').value = quest.location || '';
    document.getElementById('cipher-keyword-select').value = quest.cipher_keyword || "None";
    document.getElementById('lore').value = quest.lore || '';
    document.getElementById('items').value = Array.isArray(quest.items) ? quest.items.join(', ') : (quest.items || '');
    document.getElementById('gold').value = quest.gold || 0;
    document.getElementById('max-claims').value = quest.max_claims || 1;

    selected = [];
    if (quest.signs) {
        selected.push(...quest.signs);
        updateSelected(baseUrl, version);
    }

    setupEditorEvents(baseUrl, version);
}

function updateSelected(baseUrl, version) {
    selectedDisplay.innerHTML = "";
    const keywordRaw = document.getElementById("cipher-keyword-select").value;
    const currentKeyword = (keywordRaw === "None" || !keywordRaw) ? "" : keywordRaw;
    
    selected.forEach((placedId, index) => {
        const column = document.createElement("div");
        column.className = "flex flex-col items-center gap-3 mb-4 w-40";

        const currentIndex = allSignIds.indexOf(placedId);
        const shift = getCipherShift(currentKeyword);
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
        infoBottom.className = "text-md text-gray-400 uppercase mt-2 font-bold";
        infoBottom.textContent = "User Enters This";

        bottomContainer.append(imgBottom, labelBottom, infoBottom);

        column.append(topContainer, arrow, bottomContainer);
        selectedDisplay.appendChild(column);
    });
}

function setupEditorEvents(baseUrl, version) {
    const categorySelect = document.getElementById("quest-category-select");
    const newCategoryWrapper = document.getElementById("new-category-wrapper");
    const newCategoryInput = document.getElementById("new-category-input");

    categorySelect.addEventListener("change", () => {
        if (categorySelect.value === "NEW") {
            newCategoryWrapper.classList.remove("hidden");
        } else {
            newCategoryWrapper.classList.add("hidden");
        }
    });

    document.getElementById("clear-signs").onclick = () => {
        selected.length = 0;
        selectedDisplay.innerHTML = "";
        document.getElementById("limit-message")?.classList.add("hidden");
    };

    document.getElementById("cipher-keyword-select").addEventListener("change", () => {
        updateSelected(baseUrl, version);
    });

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
        const author = document.getElementById('quest-author').value.trim();
        const keywordRaw = document.getElementById('cipher-keyword-select').value;
        const currentKeyword = (keywordRaw === "None" || !keywordRaw) ? "" : keywordRaw;
        const region_id = document.getElementById('region-selection').value;
        
        let finalCategory = categorySelect.value;
        if (finalCategory === "NEW") {
            finalCategory = newCategoryInput.value.trim();
        }

        const reward_keys = selected.map(placedId => {
            const currentIndex = allSignIds.indexOf(placedId);
            const shift = getCipherShift(currentKeyword);
            const encodedIndex = (currentIndex + shift) % allSignIds.length;
            return allSignIds[encodedIndex].split('_').slice(1).join('_');
        });

        const updatedData = {
            quest_name: document.getElementById('quest-name').value.trim(),
            author,
            quest_key: document.getElementById('quest-key').value.trim(),
            category: finalCategory,
            region_id: region_id === "global" ? null : region_id,
            location: document.getElementById('location').value.trim(),
            cipher_keyword: currentKeyword || null,
            lore: document.getElementById('lore').value.trim(),
            items: itemsInput ? itemsInput.split(',').map(i => i.trim()).filter(Boolean) : [],
            gold: parseInt(document.getElementById('gold').value) || 0,
            max_claims: parseInt(document.getElementById('max-claims').value) || 1,
            signs: selected.length > 0 ? selected : null,
            reward_key: reward_keys.length > 0 ? reward_keys.join(",") : null
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

enableSignTooltip();
init();