import { supabase } from '../supabaseClient.js';
import { enableSignTooltip } from '../ui/signTooltip.js';

let currentTable = 'secret_unlock_configs';
let selectedSignsForForm = [];
let allSignIds = [];
let signsConfig = null;
const alphabet = "abcdefghijklmnopqrstuvwxyz";

const tableConfigs = {
    secret_unlock_configs: {
        display: 'Secret Unlock',
        columns: ['id', 'category_name', 'cipher_keyword', 'unlock_sequence', 'discovery_message'],
        labels: ['ID', 'Target Category', 'Keyword', 'Shifted Sequence', 'Unlock Message'],
        sort: 'created_at',
        insertable: ['category_name', 'cipher_keyword', 'unlock_sequence', 'discovery_message']
    },
    heroic_feats: {
        display: 'Heroic Feat',
        columns: ['id', 'name', 'category', 'required_count', 'active', 'icon'],
        labels: ['Record ID', 'Title', 'Category', 'Target', 'Status', 'Sign'],
        sort: 'created_at',
        insertable: ['name', 'category', 'description', 'required_count', 'required_category', 'icon']
    }
};

async function loadSignsMetadata() {
    const response = await fetch("frontend/www/assets/signs.json");
    const data = await response.json();
    signsConfig = data.config;
    allSignIds = [];
    data.categories.forEach(cat => {
        cat.items.forEach(item => allSignIds.push(`${cat.id}_${item}`));
    });
    return data;
}

function getCipherShift(word) {
    if (!word || word.toLowerCase() === "none") return 0;
    const firstChar = word.charAt(0).toLowerCase();
    const index = alphabet.indexOf(firstChar);
    return index !== -1 ? (index + 1) : 0;
}

async function renderSignPicker(targetId) {
    if (!signsConfig) await loadSignsMetadata();
    const { baseUrl, version } = signsConfig;
    
    const pickerContainer = document.createElement("div");
    pickerContainer.className = "col-span-full bg-black/40 p-6 rounded-lg border border-slate-700 mt-6 flex flex-col w-full";
    pickerContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
            <div class="flex flex-col">
                <label class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 text-center">Placed Sign (Original)</label>
                <div id="original-preview" class="flex flex-wrap justify-center gap-4 min-h-[160px] w-full p-4 bg-black/20 rounded-xl border border-slate-800 items-center">
                    <span class="text-slate-600 italic text-xs">Select signs from the grid below...</span>
                </div>
            </div>
            <div class="flex flex-col">
                <label class="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700] mb-4 text-center">User Enters This (Shifted)</label>
                <div id="shifted-preview" class="flex flex-wrap justify-center gap-4 min-h-[160px] w-full p-4 bg-[#FFD700]/5 rounded-xl border border-[#FFD700]/20 items-center">
                    <span class="text-slate-600 italic text-xs">Awaiting transposition...</span>
                </div>
            </div>
        </div>
        <div class="h-px w-full bg-slate-700/50 mb-8"></div>
        <div id="sign-selection-grid" class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-h-[400px] overflow-y-auto p-2 w-full justify-items-center"></div>
    `;

    const grid = pickerContainer.querySelector("#sign-selection-grid");
    const originalPreview = pickerContainer.querySelector("#original-preview");
    const shiftedPreview = pickerContainer.querySelector("#shifted-preview");
    const inputField = document.getElementById(`field-${targetId}`);
    const keywordSelect = document.getElementById('field-cipher_keyword');

    const updatePreview = () => {
        const keyword = keywordSelect?.value || "none";
        const shift = getCipherShift(keyword);
        
        if (selectedSignsForForm.length === 0) {
            originalPreview.innerHTML = `<span class="text-slate-600 italic text-xs">Select signs from the grid below...</span>`;
            shiftedPreview.innerHTML = `<span class="text-slate-600 italic text-xs">Awaiting transposition...</span>`;
            inputField.value = "";
            return;
        }

        originalPreview.innerHTML = selectedSignsForForm.map((id, index) => `
            <div class="relative group flex flex-col items-center">
                <div class="absolute -top-2 -left-2 bg-[#FFD700] text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md z-10">${index + 1}</div>
                <img src="${baseUrl}${id}.webp?${version}" class="w-28 h-28 bg-gray-700 rounded-xl p-3 border-2 border-[#FFD700] shadow-xl">
                <button type="button" class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-lg" onclick="removeSignFromForm(${index}, '${targetId}')">×</button>
            </div>
        `).join('');

        const shiftedOutputIds = selectedSignsForForm.map(placedId => {
            const currentIndex = allSignIds.indexOf(placedId);
            const encodedIndex = (currentIndex + shift) % allSignIds.length;
            return allSignIds[encodedIndex];
        });

        shiftedPreview.innerHTML = shiftedOutputIds.map((id, index) => `
            <div class="relative flex flex-col items-center">
                <img src="${baseUrl}${id}.webp?${version}" class="w-24 h-24 bg-black/60 rounded-xl p-3 border-2 border-dashed border-gray-600 shadow-2xl">
                <div class="absolute -top-2 -left-2 bg-gray-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10">${index + 1}</div>
            </div>
        `).join('');
        
        inputField.value = shiftedOutputIds.join(',');
    };

    if (keywordSelect) keywordSelect.addEventListener('change', updatePreview);

    window.removeSignFromForm = (index, tid) => {
        selectedSignsForForm.splice(index, 1);
        updatePreview();
    };

    allSignIds.forEach(fullId => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hover:scale-110 active:scale-95 transition-all p-1 bg-[#374151] rounded border border-transparent hover:border-[#72e0cc]";
        btn.innerHTML = `<img src="${baseUrl}${fullId}.webp?${version}" class="w-20 h-20 object-contain" data-sign="${fullId}">`;
        btn.onclick = () => {
            if (selectedSignsForForm.length < 5) {
                selectedSignsForForm.push(fullId);
                updatePreview();
            }
        };
        grid.appendChild(btn);
    });

    return pickerContainer;
}

async function showAddForm() {
    selectedSignsForForm = [];
    const config = tableConfigs[currentTable];
    const container = document.getElementById('add-form-container');
    const fields = document.getElementById('dynamic-form-fields');
    document.getElementById('form-title').innerText = `Register ${config.display}`;

    fields.innerHTML = config.insertable.map(field => {
        if (field === 'cipher_keyword') {
            return `
                <div class="flex flex-col space-y-2">
                    <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                    <select id="field-${field}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors">
                        <option value="" disabled selected>Select a Category</option>
                        <option value="paxdei">paxdei</option>
                        <option value="thelonius">thelonius</option>
                        <option value="badgers">badgers</option>
                        <option value="zebian">zebian</option>
                        <option value="demira">demira</option>
                        <option value="armozel">armozel</option>
                    </select>
                </div>
            `;
        }
        return `
            <div class="flex flex-col space-y-2">
                <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                <input type="text" id="field-${field}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors" ${field === 'unlock_sequence' || field === 'signs' ? 'readonly placeholder="Sequence will be generated via picker below..."' : ''}>
            </div>
        `;
    }).join('');

    if (config.insertable.includes('unlock_sequence') || config.insertable.includes('signs')) {
        const target = config.insertable.includes('unlock_sequence') ? 'unlock_sequence' : 'signs';
        const picker = await renderSignPicker(target);
        fields.appendChild(picker);
    }

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function fetchTableData() {
    const config = tableConfigs[currentTable];
    const { data, error } = await supabase.from(currentTable).select('*').order(config.sort, { ascending: true });
    if (!error) renderTable(data, config);
}

function renderTable(data, config) {
    const head = document.getElementById('mgmt-table-head');
    const body = document.getElementById('mgmt-table-body');
    head.innerHTML = `<tr>${config.labels.map(label => `<th class="px-6 py-5 font-bold">${label}</th>`).join('')}<th class="px-6 py-5 text-right">Actions</th></tr>`;
    
    body.innerHTML = data.map(row => `
        <tr class="hover:bg-slate-800/40 transition-colors">
            ${config.columns.map(col => {
                let val = row[col];
                
                if (col === 'active') {
                    return `<td class="px-6 py-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${val ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${val ? 'ACTIVE' : 'INACTIVE'}</span></td>`;
                }

                if (col === 'unlock_sequence' || col === 'signs') {
                    let signArray = [];
                    if (Array.isArray(val)) {
                        signArray = val;
                    } else if (typeof val === 'string') {
                        try {
                            signArray = JSON.parse(val);
                        } catch (e) {
                            signArray = val.split(',').map(s => s.trim()).filter(s => s !== "");
                        }
                    }

                    if (signArray.length > 0 && signsConfig) {
                        const signHtml = signArray.map(signId => {
                            return `
                                <div class="relative group">
                                    <img src="${signsConfig.baseUrl}${signId}.webp?${signsConfig.version}" 
                                         class="w-16 h-16 bg-slate-900 rounded-lg border border-slate-700 p-2 object-contain transition-transform hover:scale-110" 
                                         data-sign="${signId}">
                                </div>`;
                        }).join('');
                        return `<td class="px-6 py-4"><div class="flex flex-wrap gap-3">${signHtml}</div></td>`;
                    }
                }

                return `<td class="px-6 py-4 text-slate-300 font-medium">${val ?? '—'}</td>`;
            }).join('')}
            <td class="px-6 py-4 text-right"><button class="db-delete-btn text-slate-500 hover:text-red-500" data-id="${row.id}"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`).join('');
    
    document.querySelectorAll('.db-delete-btn').forEach(btn => btn.onclick = () => deleteRecord(btn.dataset.id));
    enableSignTooltip();
}

async function saveRecord() {
    const config = tableConfigs[currentTable];
    const payload = {};
    
    config.insertable.forEach(field => {
        const el = document.getElementById(`field-${field}`);
        if (!el) return;
        
        const val = el.value.trim();
        
        if (['sort_order', 'gold', 'required_count'].includes(field)) {
            payload[field] = parseInt(val) || 0;
        } else {
            payload[field] = (val === "none" || val === "") ? null : val;
        }
    });

    if (currentTable === 'secret_unlock_configs') {
        payload.unlock_sequence = payload.unlock_sequence ? payload.unlock_sequence : null;
    }

    const { error } = await supabase.from(currentTable).insert([payload]);
    if (error) {
        alert(error.message);
    } else { 
        document.getElementById('add-form-container').classList.add('hidden'); 
        fetchTableData(); 
    }
}

async function deleteRecord(id) {
    if (!confirm('Delete record?')) return;
    await supabase.from(currentTable).delete().eq('id', id);
    fetchTableData();
}

function setActiveTab(tableId) {
    currentTable = tableId;
    document.querySelectorAll('.mgmt-tab').forEach(tab => {
        tab.classList.remove('active', 'text-[#FFD700]');
        tab.classList.add('text-slate-400');
    });
    const activeTab = document.getElementById(`tab-${tableId.replace(/_/g, '-')}`);
    if (activeTab) {
        activeTab.classList.add('active', 'text-[#FFD700]');
        activeTab.classList.remove('text-slate-400');
    }
    document.getElementById('add-form-container').classList.add('hidden');
    fetchTableData();
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadSignsMetadata();
    enableSignTooltip();
    ['secret_unlock_configs', 'heroic_feats'].forEach(id => {
        const tab = document.getElementById(`tab-${id.replace(/_/g, '-')}`);
        if (tab) tab.onclick = () => setActiveTab(id);
    });
    document.getElementById('add-entry-btn').onclick = showAddForm;
    document.getElementById('cancel-form').onclick = () => document.getElementById('add-form-container').classList.add('hidden');
    document.getElementById('save-entry').onclick = saveRecord;
    fetchTableData();
});