import { supabase } from "../supabaseClient.js";
import { enableSignTooltip, mouseTooltip } from '../ui/signTooltip.js';
import { initializeCharacterSystem } from "./characterManager.js";
import { questState } from './questStateManager.js';
import { initializeMarkdownToolbar } from '../ui/markdownToolbar.js';
import { 
    createAdditionalCategoriesUI, 
    getSelectedAdditionalCategories,
    updateAdditionalCategoriesForPrimaryChange 
} from './additionalCategoriesHelper.js';

const alphabet = "abcdefghijklmnopqrstuvwxyz";

async function prefillAuthor() {
    const characterSelect = document.getElementById('character-select');
    const authorInput = document.getElementById("quest-author");
    
    if (characterSelect && authorInput) {
        const selectedText = characterSelect.options[characterSelect.selectedIndex]?.text;
        if (selectedText) {
            authorInput.value = selectedText;
        }
    }
}

async function checkAccess() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "quests.html";
        return;
    }

    const { data: adminData, error: adminError } = await supabase
        .from("admin_users")
        .select("quest_role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError || !adminData || adminData.quest_role !== "quest_adder") {
        window.location.href = "quests.html";
        return;
    }

    // Initialize quest state manager
    if (!questState.isReady()) {
        await questState.initialize();
    }

    await initializeCharacterSystem(user.id);
    
    setTimeout(() => {
        prefillAuthor();
    }, 500);

    window.addEventListener('characterChanged', () => {
        prefillAuthor();
    });

    init();
}

function getCipherShift(word) {
    if (!word || word.toLowerCase() === "none") return 0;
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 0;
}

const selected = [];
let allSignIds = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

async function loadCategories() {
    //console.log('[PANEL.HTML] loadCategories called');
    
    // Wait for state manager to be ready
    if (!questState.isReady()) {
        //console.log('[PANEL.HTML] State manager not ready, initializing...');
        await questState.initialize();
    }

    const categories = questState.getCategories();
    //console.log('[PANEL.HTML] Categories from state manager:', categories);
    //console.log('[PANEL.HTML] Total categories:', categories.length);
    //console.log('[PANEL.HTML] Category names:', categories.map(c => c.name));
    
    const catSelect = document.getElementById("quest-category-select");
    const preCatSelect = document.getElementById("unlock-pre-cat");

    if (catSelect) {
        catSelect.innerHTML = '<option value="" disabled selected>Select Category</option><option value="NEW">+ Add New Category</option>';
        categories.forEach(cat => {
            const opt = new Option(cat.name, cat.name);
            catSelect.add(opt);
        });
        //console.log('[PANEL.HTML] Quest category dropdown populated with', catSelect.options.length - 2, 'categories');
    }

    if (preCatSelect) {
        preCatSelect.innerHTML = '<option value="">None (Always Unlocked)</option>';
        categories.forEach(cat => {
            const opt = new Option(cat.name, cat.name);
            preCatSelect.add(opt);
        });
        //console.log('[PANEL.HTML] Prerequisite category dropdown populated with', preCatSelect.options.length - 1, 'categories');
    }
    
    // Initialize additional categories UI (will show placeholder until primary category is selected)
    const additionalCatContainer = document.getElementById('additional-categories-wrapper');
    if (additionalCatContainer && categories) {
        const additionalCategoriesUI = createAdditionalCategoriesUI(
            categories, 
            '', // No primary category selected yet
            [] // No existing additional categories
        );
        additionalCatContainer.innerHTML = '';
        additionalCatContainer.appendChild(additionalCategoriesUI);
    }
}

async function loadRegions() {
    // Wait for state manager to be ready
    if (!questState.isReady()) {
        await questState.initialize();
    }

    const regions = questState.getRegions();

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
}

async function loadSigns() {
    const response = await fetch('frontend/www/assets/signs.json');
    const data = await response.json();
    const { baseUrl, version } = data.config;

    data.categories.forEach(category => {
        category.items.forEach(itemName => {
            const fullId = `${category.id}_${itemName}`;
            allSignIds.push(fullId);
            
            const btn = document.createElement("button");
            btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#72e0cc] transition-all relative";

            const img = document.createElement("img");
            img.src = `${baseUrl}${fullId}.webp?${version}`;
            img.className = "w-full h-auto pointer-events-none";
            img.onerror = () => btn.remove();
            btn.appendChild(img);

            btn.onmouseenter = () => {
                mouseTooltip.innerText = itemName.replace(/-/g, " ");
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
    });
}

function updateSelected(baseUrl, version) {
    selectedDisplay.innerHTML = "";
    const keywordRaw = document.getElementById("cipher-keyword-select").value;
    const currentKeyword = (keywordRaw === "none" || !keywordRaw) ? "" : keywordRaw;
    
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
        const labelTop = document.createElement("span");
        labelTop.className = "text-[14px] text-white font-bold uppercase mt-1 text-center";
        labelTop.textContent = placedId.split('_').slice(1).join(' ').replace(/_/g, ' ');

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
        const labelBottom = document.createElement("span");
        labelBottom.className = "text-[14px] text-[#FFD700] font-bold uppercase text-center";
        labelBottom.textContent = encodedSignId.split('_').slice(1).join('_').replace(/_/g, ' ');
        const infoBottom = document.createElement("span");
        infoBottom.className = "text-[10px] text-gray-400 uppercase mt-2 font-bold";
        infoBottom.textContent = "User Enters This";

        bottomContainer.append(imgBottom, labelBottom, infoBottom);
        column.append(topContainer, arrow, bottomContainer);
        selectedDisplay.appendChild(column);
    });
}

document.getElementById("clear-signs").onclick = () => {
    selected.length = 0;
    selectedDisplay.innerHTML = "";
    document.getElementById("limit-message")?.classList.add("hidden");
};

document.getElementById("cipher-keyword-select").addEventListener("change", () => {
    fetch('frontend/www/assets/signs.json').then(r => r.json()).then(data => {
        updateSelected(data.config.baseUrl, data.config.version);
    });
});

document.getElementById('quest-category-select').addEventListener('change', (e) => {
    const wrapper = document.getElementById('new-category-wrapper');
    if (e.target.value === 'NEW') {
        wrapper.classList.remove('hidden');
    } else {
        wrapper.classList.add('hidden');
        
        // Update additional categories UI when primary category changes
        const categories = questState.getCategories();
        if (categories) {
            updateAdditionalCategoriesForPrimaryChange(categories, e.target.value);
        }
    }
});

const questNameInput = document.getElementById("quest-name");
const questKeyInput = document.getElementById("quest-key");

questNameInput.addEventListener("input", () => {
    const slug = questNameInput.value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    questKeyInput.value = slug;
});

const modal = document.getElementById("confirmation-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalCancel = document.getElementById("modal-cancel");
const modalConfirm = document.getElementById("modal-confirm");

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    return new Promise((resolve) => {
        modalCancel.onclick = () => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            resolve(false);
        };
        modalConfirm.onclick = () => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            resolve(true);
        };
    });
}

async function loadPrerequisiteOptions(containerId, inputName = 'prereq-quest', searchId = 'prereq-search', listId = 'prereq-list') {
    // Wait for state manager to be ready
    if (!questState.isReady()) {
        await questState.initialize();
    }

    const allQuests = questState.getAllQuests();
    const quests = allQuests.map(q => ({
        id: q.id,
        quest_name: q.quest_name,
        category: q.category || 'Uncategorized'
    })).sort((a, b) => a.category.localeCompare(b.category));

    const parent = document.getElementById(containerId);
    if (!parent) return;

    let selectedIds = [];

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
                const isChecked = selectedIds.includes(q.id) ? 'checked' : '';
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
        selectedIds = [...new Set([...selectedIds, ...currentChecked])];
        
        const currentUnchecked = Array.from(document.querySelectorAll(`input[name="${inputName}"]:not(:checked)`)).map(cb => cb.value);
        selectedIds = selectedIds.filter(id => !currentUnchecked.includes(id));
        
        renderPrereqs(e.target.value);
    });

    renderPrereqs();
}

document.getElementById("create-quest").onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const quest_name = questNameInput.value.trim();
    const quest_key = questKeyInput.value.trim();
    const author = document.getElementById("quest-author").value.trim();
    let category = document.getElementById("quest-category-select").value;
    const region_id = document.getElementById("region-selection").value;
    const locationStr = document.getElementById("location").value.trim();
    const keywordRaw = document.getElementById("cipher-keyword-select").value;
    const currentKeyword = (keywordRaw === "none" || !keywordRaw) ? "" : keywordRaw;
    const lore = document.getElementById("lore").value.trim();
    const itemsInput = document.getElementById("items")?.value;
    const items = itemsInput ? itemsInput.split(",").map(i => i.trim()).filter(Boolean) : [];
    const gold = parseInt(document.getElementById("gold")?.value || 0);
    const unlockPreCat = document.getElementById("unlock-pre-cat")?.value || null;
    const unlockReqCount = parseInt(document.getElementById("unlock-req-count")?.value || 0);

    const selectedPrereqs = Array.from(document.querySelectorAll('input[name="prereq-quest"]:checked'))
        .map(cb => cb.value);

    const selectedHardLocks = Array.from(document.querySelectorAll('input[name="hard-lock-quest"]:checked'))
        .map(cb => cb.value);

    if (category === 'NEW') {
        const newCatName = document.getElementById("new-category-input").value.trim();
        if (!newCatName) {
            await showModal("Error", "Please enter a name for the new category.");
            return;
        }
        const { error: catError } = await supabase
            .from("quest_categories")
            .upsert({ name: newCatName, is_secret: false }, { onConflict: 'name' });
        if (catError) {
            await showModal("Error", "Error saving new category: " + catError.message);
            return;
        }
        category = newCatName;
        // Invalidate the categories cache to pick up the new category
        await questState.invalidate(['categories']);
    }

    const reward_keys = selected.map(placedId => {
        const currentIndex = allSignIds.indexOf(placedId);
        const shift = getCipherShift(currentKeyword);
        const encodedIndex = (currentIndex + shift) % allSignIds.length;
        return allSignIds[encodedIndex].split('_').slice(1).join('_');
    });

    if (!quest_name || !quest_key || !category || !region_id) {
        await showModal("Missing Fields", "Please fill in all required fields (Name, Key, Category, and Region).");
        return;
    }

    // Get additional categories
    const additionalCategories = getSelectedAdditionalCategories();
    
    const confirmed = await showModal("Confirm Quest Creation", `Create quest "${quest_name}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("cipher_quests").insert({
        quest_key,
        quest_name,
        author,
        category,
        additional_categories: additionalCategories.length > 0 ? additionalCategories : null,
        region_id: region_id === "global" ? null : region_id,
        signs: selected.length > 0 ? selected : null,
        reward_key: reward_keys.length > 0 ? reward_keys.join(",") : null,
        cipher_keyword: currentKeyword || null,
        location: locationStr,
        lore,
        items,
        gold,
        max_claims: parseInt(document.getElementById("max-claims")?.value) || 1,
        active: true,
        created_by: user.id,
        unlock_prerequisite_category: unlockPreCat,
        unlock_required_count: unlockReqCount,
        prerequisite_quest_ids: selectedPrereqs,
        hard_lock_quest_ids: selectedHardLocks
    });

    if (error) {
        await showModal("Error", error.message);
    } else {
        await showModal("Success", "Quest created!");
        // Invalidate quests cache after creating a new quest
        await questState.invalidate(['quests']);
        window.location.reload();
    }
};

function init() {
    enableSignTooltip();
    loadRegions();
    loadCategories();
    loadSigns();
    loadPrerequisiteOptions('hard-lock-container', 'hard-lock-quest', 'hard-lock-search', 'hard-lock-list');
    loadPrerequisiteOptions('prerequisite-container', 'prereq-quest', 'prereq-search', 'prereq-list');
    initializeMarkdownToolbar();
}

checkAccess();
