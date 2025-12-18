import { supabase } from "../supabaseClient.js";

async function loadSigns() {
    const response = await fetch('frontend/www/assets/signs.json');
    const data = await response.json();
    const { baseUrl, version } = data.config;

    data.categories.forEach(category => {
        category.items.forEach(itemName => {
            const fullId = `${category.prefix}${itemName}`;
            const btn = document.createElement("button");
            btn.className = "p-1 bg-[#374151] rounded hover:bg-[#4b5563] border border-transparent hover:border-[#FFD700] transition-all";

            const img = document.createElement("img");
            img.src = `${baseUrl}${category.id}_${itemName}.webp?${version}`;
            img.className = "w-full h-auto pointer-events-none";

            img.onerror = () => btn.remove();

            btn.appendChild(img);
            btn.onclick = () => {
                selected.push(fullId);
                updateSelected(baseUrl, version);
            };
            grid.appendChild(btn);
        });
    });
}

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const keyword = "thelonius";

function buildCipher(keyword) {
    const seen = new Set();
    let cipher = "";
    for (const c of keyword) {
        if (!seen.has(c)) {
            seen.add(c);
            cipher += c;
        }
    }
    for (const c of alphabet) {
        if (!seen.has(c)) cipher += c;
    }
    return cipher;
}

const ciphered = buildCipher(keyword);

function encode(input) {
    return input.split("").map(c => {
        const i = alphabet.indexOf(c);
        return i !== -1 ? ciphered[i] : c;
    }).join("");
}

function decode(input) {
    return input.split("").map(c => {
        const i = ciphered.indexOf(c);
        return i !== -1 ? alphabet[i] : c;
    }).join("");
}

const selected = [];
const grid = document.getElementById("sign-grid");
const selectedDisplay = document.getElementById("selected-signs");
const rewardKeyEl = document.getElementById("reward-key");
const encodedEl = document.getElementById("encoded-input");
const validationEl = document.getElementById("validation-status");

function updateSelected(baseUrl, version) {
    selectedDisplay.innerHTML = "";
    selected.forEach((fullId, index) => {
        const container = document.createElement("div");
        container.className = "relative inline-block mr-2 mb-2 group";

        const img = document.createElement("img");
        const parts = fullId.split('_');
        const category = parts[0];
        const itemName = parts.slice(1).join('_');
        
        img.src = `${baseUrl}${category}_${itemName}.webp?${version}`;
        img.className = "w-10 h-10 bg-gray-700 rounded p-1 border border-gray-500";

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "×";
        removeBtn.className = "absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity";

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            selected.splice(index, 1);
            updateSelected(baseUrl, version);
        };

        container.appendChild(img);
        container.appendChild(removeBtn);
        selectedDisplay.appendChild(container);
    });

    const rewardKey = selected.join(",").toLowerCase();
    const encoded = encode(rewardKey);
    rewardKeyEl.textContent = rewardKey;
    if (encodedEl) encodedEl.textContent = encoded.toUpperCase();
    
    if (validationEl) {
        validationEl.textContent = decode(encoded) === rewardKey ? "✓ Cipher Valid" : "✗ Cipher Error";
        validationEl.className = decode(encoded) === rewardKey ? "text-green-400" : "text-red-400";
    }
}

document.getElementById("clear-signs").onclick = () => {
    selected.length = 0;
    const rewardKeyDisplay = document.getElementById("reward-key");
    rewardKeyDisplay.textContent = "";
    selectedDisplay.innerHTML = "";
};

const questNameInput = document.getElementById("quest-name");
const questKeyInput = document.getElementById("quest-key");
const maxClaimsInput = document.getElementById("max-claims");

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
    return new Promise((resolve) => {
        modalCancel.onclick = () => {
            modal.classList.add("hidden");
            resolve(false);
        };
        modalConfirm.onclick = () => {
            modal.classList.add("hidden");
            resolve(true);
        };
    });
}

document.getElementById("create-quest").onclick = async () => {
    const quest_name = questNameInput.value.trim();
    const quest_key = questKeyInput.value.trim();
    const locationStr = document.getElementById("location").value.trim();
    const lore = document.getElementById("lore").value.trim();
    const items = document.getElementById("items").value.split(",").map(i => i.trim()).filter(Boolean);
    const gold = parseInt(document.getElementById("gold").value || 0);
    const reward_key = rewardKeyEl.textContent;
    const max_claims = parseInt(maxClaimsInput.value) || 1;

    if (!quest_name || !quest_key || !reward_key) {
        await showModal("Missing Fields", "Please fill in all required fields and select signs.");
        return;
    }

    const confirmed = await showModal("Confirm Quest Creation", `Create quest "${quest_name}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("cipher_quests").insert({
        quest_key,
        quest_name,
        signs: selected,
        reward_key,
        location: locationStr,
        lore,
        items,
        gold,
        max_claims,
        active: true
    });

    if (error) {
        await showModal("Error", error.message);
    } else {
        await showModal("Success", "Quest created!");
        location.reload();
    }
};

loadSigns();