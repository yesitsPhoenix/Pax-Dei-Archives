import { supabase } from "../supabaseClient.js";
import { enableSignTooltip, mouseTooltip } from '../ui/signTooltip.js';
import { questState } from './questStateManager.js';

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

    // Initialize quest state manager
    //console.log('[EDIT_QUEST.HTML] Initializing quest state manager...');
    if (!questState.isReady()) {
        await questState.initialize();
    }
    //console.log('[EDIT_QUEST.HTML] Quest state manager initialized');

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
    enableSignTooltip();
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
                <label class="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Filter by Category</label>
                <select id="filter-category" class="w-full bg-[#1f2937] border border-gray-700 rounded-lg p-2.5 text-white focus:border-[#FFD700] outline-none cursor-pointer text-sm">
                    <option value="all">All Categories</option>
                </select>
            </div>
            <div class="w-full md:w-64">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Search Quests</label>
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                    <input type="text" id="search-quests" placeholder="Quest name..." class="w-full bg-[#1f2937] border border-gray-700 rounded-lg p-2.5 pl-9 text-white focus:border-[#FFD700] outline-none text-sm">
                </div>
            </div>
        </div>
        <div class="bg-[#1f2937] rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse table-auto">
                    <thead>
                        <tr class="bg-black/40 text-[#FFD700] text-xs uppercase tracking-widest font-bold border-b border-gray-700">
                            <th class="px-4 py-3">Quest Name</th>
                            <th class="px-4 py-3">Category</th>
                            <th class="px-4 py-3">Cipher (World)</th>
                            <th class="px-4 py-3">Solution (Input)</th>
                            <th class="px-4 py-3">Key</th>
                            <th class="px-4 py-3">Claims</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="user-quest-list" class="text-white divide-y divide-gray-700/50">
                    </tbody>
                </table>
            </div>
            <div id="manager-loading" class="p-8 text-center">
                <i class="fas fa-circle-notch fa-spin text-xl text-[#FFD700]"></i>
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
        list.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400 text-sm">No quests found.</td></tr>';
        return;
    }

    // Load categories from state manager for the filter dropdown
    //console.log('[EDIT_QUEST.HTML] Loading categories for manager filter dropdown...');
    if (!questState.isReady()) {
        await questState.initialize();
    }
    
    const allCategories = questState.getCategories();
    //console.log('[EDIT_QUEST.HTML] Categories from state manager for filter:', allCategories);
    //console.log('[EDIT_QUEST.HTML] Total categories for filter:', allCategories.length);
    
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        filterSelect.appendChild(opt);
    });
    //console.log('[EDIT_QUEST.HTML] Manager filter dropdown populated with', allCategories.length, 'categories');

    const attachTooltip = (el, name) => {
        el.onmouseenter = () => {
            mouseTooltip.innerText = name.replace(/-/g, " ");
            mouseTooltip.style.display = "block";
        };
        el.onmousemove = e => {
            mouseTooltip.style.left = `${e.clientX + 15}px`;
            mouseTooltip.style.top = `${e.clientY + 15}px`;
        };
        el.onmouseleave = () => {
            mouseTooltip.style.display = "none";
        };
    };

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
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-white/5 transition-colors group';
            
            const questNameCell = document.createElement('td');
            questNameCell.className = 'px-4 py-3';
            questNameCell.innerHTML = `<div class="font-bold text-sm">${quest.quest_name}</div>`;

            const categoryCell = document.createElement('td');
            categoryCell.className = 'px-4 py-3';
            categoryCell.innerHTML = `<div class="text-xs text-gray-400 font-medium">${quest.category || 'No Category'}</div>`;

            const cipherCell = document.createElement('td');
            cipherCell.className = 'px-4 py-3 whitespace-nowrap';
            if (quest.signs && quest.signs.length > 0) {
                quest.signs.forEach(id => {
                    const img = document.createElement('img');
                    img.src = `${baseUrl}${id}.webp?${version}`;
                    img.style.width = '36px';
                    img.style.height = '36px';
                    img.className = 'inline-block bg-black/40 rounded p-1 border border-gray-700 mr-1 hover:border-[#72e0cc]';
                    attachTooltip(img, id.split('_').slice(1).join(' '));
                    cipherCell.appendChild(img);
                });
            } else {
                cipherCell.innerHTML = '<span class="text-gray-500 italic text-xs">None</span>';
            }

            const solutionCell = document.createElement('td');
            solutionCell.className = 'px-4 py-3 whitespace-nowrap';
            if (quest.signs && quest.signs.length > 0) {
                quest.signs.forEach(id => {
                    const currentIndex = allSignIds.indexOf(id);
                    const encodedIndex = (currentIndex + shift) % allSignIds.length;
                    const encodedId = allSignIds[encodedIndex];
                    const img = document.createElement('img');
                    img.src = `${baseUrl}${encodedId}.webp?${version}`;
                    img.style.width = '36px';
                    img.style.height = '36px';
                    img.className = 'inline-block bg-gray-800 rounded p-1 border border-gray-600 mr-1 hover:border-[#72e0cc]';
                    attachTooltip(img, encodedId.split('_').slice(1).join(' '));
                    solutionCell.appendChild(img);
                });
            } else {
                solutionCell.innerHTML = '<span class="text-gray-500 italic text-xs">No Signs</span>';
            }

            const keywordCell = document.createElement('td');
            keywordCell.className = 'px-4 py-3';
            keywordCell.innerHTML = `<span class="text-xs font-bold text-[#FFD700] uppercase">${keyword}</span>`;

            const claimsCell = document.createElement('td');
            claimsCell.className = 'px-4 py-3';
            claimsCell.innerHTML = `
                <div class="flex items-center gap-1.5 text-xs">
                    <span class="font-bold ${claimCount >= maxClaims && maxClaims > 0 ? 'text-red-400' : 'text-green-400'}">${claimCount}</span>
                    <span class="text-gray-600">/</span>
                    <span class="text-gray-500">${maxClaims}</span>
                </div>
            `;

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-4 py-3 text-right';
            actionsCell.innerHTML = `
                <a href="?id=${quest.id}" class="bg-[#FFD700] hover:bg-yellow-400 text-black px-4 py-1.5 rounded-lg font-bold text-xs uppercase transition-all shadow-md active:scale-95 inline-block text-center decoration-0">
                    Edit
                </a>
            `;

            row.append(questNameCell, categoryCell, cipherCell, solutionCell, keywordCell, claimsCell, actionsCell);
            list.appendChild(row);
        });
    };

    filterSelect.addEventListener('change', renderRows);
    searchInput.addEventListener('input', renderRows);
    renderRows();
}

async function loadCategories() {
    //console.log('[EDIT_QUEST.HTML] loadCategories called');
    
    // Wait for state manager to be ready
    if (!questState.isReady()) {
        //console.log('[EDIT_QUEST.HTML] State manager not ready, initializing...');
        await questState.initialize();
    }

    const categories = questState.getCategories();
    //console.log('[EDIT_QUEST.HTML] Categories from state manager:', categories);
    //console.log('[EDIT_QUEST.HTML] Total categories:', categories.length);
    //console.log('[EDIT_QUEST.HTML] Category names:', categories.map(c => c.name));
    
    const catSelect = document.getElementById("quest-category-select");
    const preCatSelect = document.getElementById("unlock-pre-cat");

    if (catSelect) {
        catSelect.innerHTML = '<option value="" disabled selected>Select Category</option><option value="NEW">+ Add New Category</option>';
        categories.forEach(cat => {
            const opt = new Option(cat.name, cat.name);
            catSelect.add(opt);
        });
        //console.log('[EDIT_QUEST.HTML] Quest category dropdown populated with', catSelect.options.length - 2, 'categories');
    }

    if (preCatSelect) {
        preCatSelect.innerHTML = '<option value="">None (Always Unlocked)</option>';
        categories.forEach(cat => {
            const opt = new Option(cat.name, cat.name);
            preCatSelect.add(opt);
        });
        //console.log('[EDIT_QUEST.HTML] Prerequisite category dropdown populated with', preCatSelect.options.length - 1, 'categories');
    }
}

async function loadRegions() {
    //console.log('[EDIT_QUEST.HTML] loadRegions called');
    
    // Wait for state manager to be ready
    if (!questState.isReady()) {
        await questState.initialize();
    }

    const regions = questState.getRegions();
    //console.log('[EDIT_QUEST.HTML] Regions from state manager:', regions.length);

    const select = document.getElementById("region-selection");
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Select Location...</option>';

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
    
    //console.log('[EDIT_QUEST.HTML] Region dropdown populated with', regions.length, 'regions');
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

    //console.log('[EDIT_QUEST.HTML] Loading categories for editor...');
    await loadCategories();
    
    //console.log('[EDIT_QUEST.HTML] Loading regions for editor...');
    await loadRegions();

    grid.innerHTML = "";
    allSignIds.forEach(fullId => {
        const btn = document.createElement("button");
        btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#72e0cc] transition-all relative";

        const img = document.createElement("img");
        img.src = `${baseUrl}${fullId}.webp?${version}`;
        img.className = "w-full h-auto pointer-events-none";
        img.onerror = () => btn.remove();

        btn.appendChild(img);

        btn.onmouseenter = () => {
            mouseTooltip.innerText = fullId.split('_').slice(1).join(' ').replace(/-/g, " ");
            mouseTooltip.style.display = "block";
        };
        btn.onmousemove = e => {
            mouseTooltip.style.left = `${e.clientX + 15}px`;
            mouseTooltip.style.top = `${e.clientY + 15}px`;
        };
        btn.onmouseleave = () => {
            mouseTooltip.style.display = "none";
        };

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
    document.getElementById('unlock-pre-cat').value = quest.unlock_prerequisite_category || '';
    document.getElementById('unlock-req-count').value = quest.unlock_required_count || '';
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
    await loadPrerequisiteOptionsForEdit('hard-lock-container', quest.hard_lock_quest_ids || [], 'hard-lock-quest', 'hard-lock-search', 'hard-lock-list');
    await loadPrerequisiteOptionsForEdit('prerequisite-container', quest.prerequisite_quest_ids || [], 'prereq-quest', 'prereq-search', 'prereq-list');

    setupEditorEvents(baseUrl, version);
}

async function loadPrerequisiteOptionsForEdit(containerId, existingIds = [], inputName = 'prereq-quest', searchId = 'prereq-search', listId = 'prereq-list') {
    //console.log('[EDIT_QUEST.HTML] Loading prerequisite options...');
    
    // Use state manager to get quests
    if (!questState.isReady()) {
        await questState.initialize();
    }

    const allQuests = questState.getAllQuests();
    const quests = allQuests
        .filter(q => q.id !== questId)
        .map(q => ({
            id: q.id,
            quest_name: q.quest_name,
            category: q.category || 'Uncategorized'
        }))
        .sort((a, b) => a.category.localeCompare(b.category));
    
    //console.log('[EDIT_QUEST.HTML] Loaded', quests.length, 'quests for prerequisites');

    const parent = document.getElementById(containerId);
    if (!parent) return;

    parent.innerHTML = `
        <div class="mb-3">
            <input type="text" id="${searchId}" placeholder="Search quests..." class="w-full bg-[#374151] border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-[#FFD700] outline-none">
        </div>
        <div id="${listId}" class="space-y-1"></div>
    `;

    const listContainer = document.getElementById(listId);

    const renderPrereqs = (filter = "") => {
        listContainer.innerHTML = quests
            .filter(q => q.quest_name.toLowerCase().includes(filter.toLowerCase()))
            .map(q => {
                const isChecked = existingIds.includes(q.id) ? 'checked' : '';
                return `
                    <label class="flex items-center space-x-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                        <input type="checkbox" name="${inputName}" value="${q.id}" ${isChecked} class="w-4 h-4 rounded border-gray-700 text-[#FFD700] focus:ring-[#FFD700] bg-gray-900">
                        <span class="text-sm text-gray-300">${q.quest_name} <small class="text-gray-500 ml-2">(${q.category})</small></span>
                    </label>
                `;
            }).join('');
    };

    document.getElementById(searchId).addEventListener('input', (e) => {
        const currentChecked = Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`)).map(cb => cb.value);
        existingIds = [...new Set([...existingIds, ...currentChecked])];
        
        const currentUnchecked = Array.from(document.querySelectorAll(`input[name="${inputName}"]:not(:checked)`)).map(cb => cb.value);
        existingIds = existingIds.filter(id => !currentUnchecked.includes(id));
        
        renderPrereqs(e.target.value);
    });

    renderPrereqs();
    //console.log('[EDIT_QUEST.HTML] Prerequisite container populated');
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
        
        const selectedPrereqs = Array.from(document.querySelectorAll('input[name="prereq-quest"]:checked'))
            .map(cb => cb.value);

        const selectedHardLocks = Array.from(document.querySelectorAll('input[name="hard-lock-quest"]:checked'))
            .map(cb => cb.value);

        let finalCategory = categorySelect.value;
        if (finalCategory === "NEW") {
            finalCategory = newCategoryInput.value.trim();
            
            if (!finalCategory) {
                alert("Please enter a name for the new category.");
                return;
            }
            
            // Add new category to database
            const { error: catError } = await supabase
                .from("quest_categories")
                .upsert({ name: finalCategory, is_secret: false }, { onConflict: 'name' });
            
            if (catError) {
                alert("Error saving new category: " + catError.message);
                return;
            }
            
            // Invalidate the categories cache to pick up the new category
            await questState.invalidate(['categories']);
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
            unlock_prerequisite_category: document.getElementById('unlock-pre-cat').value || null,
            unlock_required_count: parseInt(document.getElementById('unlock-req-count').value) || null,
            region_id: region_id === "global" ? null : region_id,
            location: document.getElementById('location').value.trim(),
            cipher_keyword: currentKeyword || null,
            lore: document.getElementById('lore').value.trim(),
            items: itemsInput ? itemsInput.split(',').map(i => i.trim()).filter(Boolean) : [],
            gold: parseInt(document.getElementById('gold').value) || 0,
            max_claims: parseInt(document.getElementById('max-claims').value) || 1,
            signs: selected.length > 0 ? selected : null,
            reward_key: reward_keys.length > 0 ? reward_keys.join(",") : null,
            prerequisite_quest_ids: selectedPrereqs,
            hard_lock_quest_ids: selectedHardLocks
        };

        const { error } = await supabase
            .from("cipher_quests")
            .update(updatedData)
            .eq("id", questId);

        if (error) {
            alert(error.message);
        } else {
            // Invalidate quests cache after updating
            await questState.invalidate(['quests']);
            window.location.href = 'edit_quest.html';
        }
    };
}

init();
