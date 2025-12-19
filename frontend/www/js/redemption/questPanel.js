import { supabase } from "../supabaseClient.js";

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const keyword = "thelonius";

function getCipherShift(word) {
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 5;
}

const selected = [];
let allSignIds = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");

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

    init();
}

async function loadSigns() {
    const response = await fetch('frontend/www/assets/signs.json');
    const data = await response.json();
    const { baseUrl, version } = data.config;

    data.categories.forEach(category => {
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

document.getElementById("clear-signs").onclick = () => {
    selected.length = 0;
    selectedDisplay.innerHTML = "";
    document.getElementById("limit-message")?.classList.add("hidden");
};

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

document.getElementById("create-quest").onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const quest_name = questNameInput.value.trim();
    const quest_key = questKeyInput.value.trim();
    const locationStr = document.getElementById("location").value.trim();
    const lore = document.getElementById("lore").value.trim();
    const itemsInput = document.getElementById("items").value;
    const items = itemsInput ? itemsInput.split(",").map(i => i.trim()).filter(Boolean) : [];
    const gold = parseInt(document.getElementById("gold").value || 0);
    
    const reward_keys = selected.map(placedId => {
        const currentIndex = allSignIds.indexOf(placedId);
        const shift = getCipherShift(keyword);
        const encodedIndex = (currentIndex + shift) % allSignIds.length;
        return allSignIds[encodedIndex].split('_').slice(1).join('_');
    });

    if (!quest_name || !quest_key || selected.length === 0) {
        await showModal("Missing Fields", "Please fill in all required fields and select 2-5 signs.");
        return;
    }

    const confirmed = await showModal("Confirm Quest Creation", `Create quest "${quest_name}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("cipher_quests").insert({
        quest_key,
        quest_name,
        signs: selected,
        reward_key: reward_keys.join(","),
        cipher_keyword: keyword,
        location: locationStr,
        lore,
        items,
        gold,
        max_claims: parseInt(document.getElementById("max-claims").value) || 1,
        active: true,
        created_by: user.id
    });

    if (error) {
        await showModal("Error", error.message);
    } else {
        await showModal("Success", "Quest created!");
        location.reload();
    }
};

function init() {
    loadSigns();
}

checkAccess();