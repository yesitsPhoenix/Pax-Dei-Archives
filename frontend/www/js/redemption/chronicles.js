import { supabase } from "../supabaseClient.js";
import { getUnlockedCategories } from "./unlocks.js";

async function getActiveCharacterId() {
    let sessionCharId = sessionStorage.getItem("active_character_id");
    if (sessionCharId && sessionCharId !== "null") return sessionCharId;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: char } = await supabase.from("characters")
        .select("character_id")
        .eq("user_id", session.user.id)
        .eq("is_default_character", true)
        .maybeSingle();

    if (char) {
        sessionStorage.setItem("active_character_id", char.character_id);
        return char.character_id;
    }

    const { data: anyChar } = await supabase.from("characters")
        .select("character_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

    if (anyChar) {
        sessionStorage.setItem("active_character_id", anyChar.character_id);
        return anyChar.character_id;
    }

    return null;
}

async function initChronicles() {
    const characterId = await getActiveCharacterId();
    
    if (!characterId) {
        setTimeout(initChronicles, 500);
        return;
    }

    const requests = [
        supabase.from("cipher_quests").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("heroic_feats").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("user_claims").select("*").eq("character_id", characterId),
        supabase.from("user_unlocked_categories").select("category_name").eq("character_id", characterId),
        fetch("frontend/www/assets/signs.json").then(res => res.json()).catch(() => ({}))
    ];

    const results = await Promise.all(requests);
    
    const allQuests = results[0].data || [];
    const allFeats = results[1].data || [];
    const userClaims = results[2].data || [];
    const manualUnlocks = new Set((results[3].data || []).map(u => u.category_name));
    const signsConfig = results[4];

    const unlockedData = await getUnlockedCategories(characterId, allQuests, userClaims);
    let unlockedCategories = new Set(unlockedData);

    renderPage(allQuests, userClaims, allFeats, unlockedCategories, manualUnlocks, signsConfig);
}

function showQuestModal(chapterName, quests, claims) {
    const modal = document.getElementById("quest-modal");
    const wrapper = document.getElementById("quest-modal-content");
    if (!modal || !wrapper) return;

    const claimedIds = new Set(claims.map(c => c.quest_id));

    let questListHtml = quests.map(q => {
        const isDone = claimedIds.has(q.id);
        return `
            <div class="flex items-center justify-between p-5 rounded-lg bg-slate-800/50 border border-slate-700 w-full shadow-sm">
                <div class="flex items-center gap-5">
                    <i class="fa-solid ${isDone ? 'fa-check-circle text-green-500' : 'fa-circle text-slate-600'} text-xl"></i>
                    <span class="${isDone ? 'text-white' : 'text-slate-400'} text-md font-medium tracking-normal">${q.quest_name}</span>
                </div>
                ${isDone ? '<span class="text-[11px] bg-green-500/20 text-green-400 px-3 py-1 rounded-full uppercase font-bold tracking-wider border border-green-500/20">Completed</span>' : ''}
            </div>
        `;
    }).join('');

    wrapper.innerHTML = `
        <div class="p-10">
            <div class="flex justify-between items-start mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-[#FFD700] uppercase tracking-widest">${chapterName}</h2>
                    <p class="text-slate-400 text-md mt-2 uppercase tracking-tight">Required Records & Completion Status</p>
                </div>
                <button id="close-quest-modal" class="text-slate-400 hover:text-white transition-colors p-2 -mt-2 -mr-2">
                    <i class="fa-solid fa-xmark text-3xl"></i>
                </button>
            </div>
            <div class="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                <div class="flex flex-col gap-4">
                    ${questListHtml}
                </div>
            </div>
        </div>
    `;

    modal.style.display = "flex";
    document.getElementById("close-quest-modal").onclick = () => modal.style.display = "none";
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

async function renderPage(allQuests, userClaims, allFeats, unlockedCategories, manualUnlocks, signsConfig) {
    const chaptersContainer = document.getElementById('chapters-container');
    const firstStepsContainer = document.getElementById('first-steps-container');
    const featsContainer = document.getElementById('feats-container');
    
    if (!chaptersContainer) return;
    chaptersContainer.innerHTML = '';
    if (firstStepsContainer) firstStepsContainer.innerHTML = ''; 
    if (featsContainer) featsContainer.innerHTML = '';

    const categoryProgress = {};
    allQuests.forEach(q => {
        if (!categoryProgress[q.category]) {
            categoryProgress[q.category] = { total: 0, completed: 0 };
        }
        categoryProgress[q.category].total++;
        if (userClaims.some(c => c.quest_id === q.id)) {
            categoryProgress[q.category].completed++;
        }
    });

    const tales = {};
    allQuests.forEach(q => {
        const cat = q.category || "Uncategorized";
        let taleName = "Uncategorized";
        let chapterName = cat;

        if (cat.includes(':')) {
            const parts = cat.split(':');
            taleName = parts[0].trim();
            chapterName = parts.slice(1).join(':').trim();
        }

        if (!tales[taleName]) tales[taleName] = [];
        if (!tales[taleName].some(c => c.chapter === chapterName)) {
            tales[taleName].push({ chapter: chapterName, full: cat });
        }
    });

    const sortedTaleNames = Object.keys(tales).sort((a, b) => {
        if (a === "The First Steps") return -1;
        if (b === "The First Steps") return 1;
        return a.localeCompare(b);
    });

    sortedTaleNames.forEach(taleName => {
        const isFirstSteps = taleName === "The First Steps";
        
        const taleWrapper = document.createElement('div');
        taleWrapper.className = isFirstSteps 
            ? "flex flex-col gap-4 mb-8 w-full" 
            : "flex flex-col gap-4 mb-8 h-fit";

        taleWrapper.insertAdjacentHTML('beforeend', `
            <div class="mt-4 mb-2">
                <div class="flex items-center gap-4">
                    <h2 class="text-lg font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">${taleName}</h2>
                    <div class="h-px flex-grow bg-slate-800"></div>
                </div>
            </div>
        `);

        const chaptersGrid = document.createElement('div');
        chaptersGrid.className = isFirstSteps ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "contents";

        const chaptersInTale = tales[taleName].map(item => {
            const catQuests = allQuests.filter(q => q.category === item.full);
            const stats = categoryProgress[item.full] || { total: 0, completed: 0 };
            const isUnlocked = unlockedCategories.has(item.full);
            const percent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            return { ...item, catQuests, isUnlocked, percent };
        });

        chaptersInTale.forEach(item => {
            const card = document.createElement('div');
            card.className = `chapter-card p-6 rounded-lg ${item.isUnlocked ? 'cursor-pointer' : 'opacity-40 grayscale'}`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold ${item.isUnlocked ? 'text-[#FFD700]' : 'text-gray-500'}">${item.isUnlocked ? item.chapter : 'Locked Records'}</h3>
                        <p class="text-slate-400 text-md mt-1">${item.isUnlocked ? `Journey in ${item.chapter}` : 'Prerequisites not met'}</p>
                    </div>
                    <i class="fa-solid ${item.isUnlocked ? 'fa-book-open text-[#FFD700]' : 'fa-lock text-slate-600'} mt-1"></i>
                </div>
                <div class="relative pt-1">
                    <div class="flex mb-1 items-center justify-between">
                        <span class="text-[10px] uppercase font-bold text-[#FFD700]">Progress</span>
                        <span class="text-md text-white">${Math.round(item.percent)}%</span>
                    </div>
                    <div class="overflow-hidden h-1.5 flex rounded bg-slate-800">
                        <div style="width:${item.percent}%" class="progress-fill flex bg-[#FFD700]"></div>
                    </div>
                </div>
            `;

            if (item.isUnlocked) {
                card.onclick = () => showQuestModal(item.chapter, item.catQuests, userClaims);
            }
            
            chaptersGrid.appendChild(card);
        });

        taleWrapper.appendChild(chaptersGrid);

        if (isFirstSteps && firstStepsContainer) {
            firstStepsContainer.appendChild(taleWrapper);
        } else {
            chaptersContainer.appendChild(taleWrapper);
        }
    });

    if (featsContainer && allFeats.length > 0) {
            allFeats.forEach(feat => {
                const targetCategory = feat.required_category || feat.category;
                const stats = categoryProgress[targetCategory] || { total: 0, completed: 0 };
                const totalToCompare = feat.required_count || stats.total;
                const isEarned = totalToCompare > 0 && stats.completed >= totalToCompare;
                
                let iconHtml = '';
                if (isEarned) {
                    let matchedSignId = null;
                    const baseUrl = "https://paxdei-archives.com/frontend/www/assets/signs/";
                    const version = "v=1.0.4";

                    if (signsConfig.signs) {
                        for (const [signId, signData] of Object.entries(signsConfig.signs)) {
                            if (signData.name === feat.name) {
                                matchedSignId = signId;
                                break;
                            }
                        }
                    }

                    if (matchedSignId) {
                        iconHtml = `<img src="${baseUrl}${matchedSignId}.webp?${version}" alt="${feat.name}" class="w-8 h-8 object-contain">`;
                    } else {
                        iconHtml = `<i class="fa-solid fa-trophy text-[#FFD700] text-xl"></i>`;
                    }
                } else {
                    iconHtml = `<i class="fa-solid fa-lock text-slate-600 text-xl"></i>`;
                }

                featsContainer.insertAdjacentHTML('beforeend', `
                    <div class="feat-card p-4 rounded-lg flex items-center gap-4 ${isEarned ? 'unlocked border-[#FFD700]' : 'border-slate-800'}">
                        <div class="w-12 h-12 rounded-full flex items-center justify-center border ${isEarned ? 'border-[#FFD700] bg-[#FFD700]/10' : 'border-slate-700 bg-slate-900'}">
                            ${iconHtml}
                        </div>
                        <div>
                            <h4 class="font-bold text-md ${isEarned ? 'text-white' : 'text-slate-500'}">${feat.name}</h4>
                            <p class="text-[10px] uppercase tracking-wider text-slate-500">${isEarned ? 'Mastered' : `Progress: ${stats.completed} / ${totalToCompare}`}</p>
                        </div>
                    </div>
                `);
            });
    }
}

window.addEventListener('characterChanged', () => {
    sessionStorage.removeItem("active_character_id");
    initChronicles();
});

document.addEventListener('DOMContentLoaded', initChronicles);