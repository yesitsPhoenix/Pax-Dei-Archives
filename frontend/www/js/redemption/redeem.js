import { supabase } from "../supabaseClient.js";

const alphabet = "abcdefghijklmnopqrstuvwxyz";

async function fetchQuests() {
    const { data, error } = await supabase
        .from("cipher_quests")
        .select("*")
        .eq("active", true);
    if (error) console.error(error);
    return data || [];
}

function buildCipher(keyword) {
    const seen = new Set();
    let cipher = "";
    for (const c of keyword.toLowerCase()) {
        if (alphabet.includes(c) && !seen.has(c)) {
            seen.add(c);
            cipher += c;
        }
    }
    for (const c of alphabet) {
        if (!seen.has(c)) cipher += c;
    }
    return cipher;
}

function encode(input, ciphered) {
    return input
        .toLowerCase()
        .split("")
        .map(c => {
            const i = alphabet.indexOf(c);
            return i !== -1 ? ciphered[i] : c;
        })
        .join("");
}

function decode(input, ciphered) {
    return input
        .toLowerCase()
        .split("")
        .map(c => {
            const i = ciphered.indexOf(c);
            return i !== -1 ? alphabet[i] : c;
        })
        .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
    const verifyBtn = document.getElementById("verify-btn");
    const claimBtn = document.getElementById("claim-btn");
    const codeInput = document.getElementById("claim-code");
    const errorMsg = document.getElementById("error-msg");
    const rewardDisplay = document.getElementById("reward-display");
    const inputSection = document.getElementById("input-section");
    const successState = document.getElementById("success-state");

    const quests = await fetchQuests();
    let currentQuest = null;

    verifyBtn.addEventListener("click", async () => {
        const rawValue = codeInput.value.trim().toLowerCase();
        if (!rawValue) return;

        errorMsg.classList.add("hidden");

        let matchedQuest = null;
        for (const quest of quests) {
            const ciphered = buildCipher("thelonius");
            const decodedKey = decode(rawValue, ciphered);
            if (decodedKey === quest.reward_key.toLowerCase()) {
                matchedQuest = quest;
                break;
            }
        }

        if (!matchedQuest) {
            errorMsg.textContent = "The code provided is invalid or incorrectly deciphered.";
            errorMsg.classList.remove("hidden");
            return;
        }

        const { count: claimCount, error: claimError } = await supabase
            .from("user_claims")
            .select("*", { count: "exact", head: true })
            .eq("quest_id", matchedQuest.id);

        if (claimError) {
            errorMsg.textContent = "Error checking quest claims.";
            errorMsg.classList.remove("hidden");
            return;
        }

        if (matchedQuest.max_claims && claimCount >= matchedQuest.max_claims) {
            errorMsg.textContent = "This quest has already reached the maximum number of claims.";
            errorMsg.classList.remove("hidden");
            return;
        }

        currentQuest = matchedQuest;

        document.getElementById("item-list").innerHTML = matchedQuest.items
            .map(item => `<li class="flex items-center gap-3"><i class="fa-solid fa-square-check text-[#72e0cc]"></i> ${item}</li>`)
            .join("");

        document.getElementById("gold-amount").textContent = matchedQuest.gold > 0 ? `${matchedQuest.gold} Gold` : "";
        document.getElementById("pickup-location").textContent = matchedQuest.location;

        rewardDisplay.classList.remove("hidden");
        verifyBtn.disabled = true;
        verifyBtn.classList.add("opacity-50", "cursor-not-allowed");
    });

    claimBtn.addEventListener("click", async () => {
    if (!currentQuest) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        errorMsg.textContent = "You must be logged in to claim a quest.";
        errorMsg.classList.remove("hidden");
        return;
    }

    const { data: existingClaim, error: claimError } = await supabase
        .from("user_claims")
        .select("*")
        .eq("quest_id", currentQuest.id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (claimError) {
        errorMsg.textContent = "Error checking your claim status.";
        errorMsg.classList.remove("hidden");
        return;
    }

    if (existingClaim) {
        errorMsg.textContent = "You have already claimed this quest.";
        errorMsg.classList.remove("hidden");
        return;
    }

    const { error: insertError } = await supabase.from("user_claims").insert({
        quest_id: currentQuest.id,
        user_id: user.id
    });

    if (insertError) {
        errorMsg.textContent = "Error recording your claim.";
        errorMsg.classList.remove("hidden");
        return;
    }

    rewardDisplay.classList.add("hidden");
    inputSection.classList.add("hidden");
    successState.classList.remove("hidden");


    });
});
