import { supabase } from '../supabaseClient.js';
import { questState } from './questStateManager.js';
import { enableSignTooltip } from '../ui/signTooltip.js';

let currentTable = 'secret_unlock_configs';
let selectedSignsForForm = [];
let allSignIds = [];
let signsConfig = null;
const alphabet = "abcdefghijklmnopqrstuvwxyz";
let allTableData = [];
let isEditMode = false;
let editingRecordId = null;

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
    },
    quest_categories: {
        display: 'Quest Category',
        columns: ['name', 'is_secret', 'created_at'],
        labels: ['Category Name', 'Secret Category', 'Created Date'],
        sort: 'name',
        insertable: ['name', 'is_secret']
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

async function showAddForm(recordToEdit = null) {
    selectedSignsForForm = [];
    
    // Ensure we only enter edit mode if there's actually a record to edit
    if (recordToEdit && (recordToEdit.id || recordToEdit.name)) {
        isEditMode = true;
        editingRecordId = recordToEdit.id || recordToEdit.name;
        //console.log('Edit mode activated for:', editingRecordId);
    } else {
        isEditMode = false;
        editingRecordId = null;
        //console.log('Create mode activated');
    }
    
    const config = tableConfigs[currentTable];
    const container = document.getElementById('add-form-container');
    const fields = document.getElementById('dynamic-form-fields');
    const saveBtn = document.getElementById('save-entry');
    
    document.getElementById('form-title').innerText = isEditMode ? `Edit ${config.display}` : `Register ${config.display}`;
    saveBtn.innerHTML = isEditMode ? '<i class="fa-solid fa-save mr-2"></i>Update Record' : 'Commit to Database';

    fields.innerHTML = config.insertable.map(field => {
        const value = recordToEdit ? (recordToEdit[field] ?? '') : '';
        
        if (field === 'cipher_keyword') {
            return `
                <div class="flex flex-col space-y-2">
                    <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                    <select id="field-${field}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors">
                        <option value="" ${value === '' ? 'selected' : ''}>Select a Category</option>
                        <option value="paxdei" ${value === 'paxdei' ? 'selected' : ''}>paxdei</option>
                        <option value="thelonius" ${value === 'thelonius' ? 'selected' : ''}>thelonius</option>
                        <option value="badgers" ${value === 'badgers' ? 'selected' : ''}>badgers</option>
                        <option value="zebian" ${value === 'zebian' ? 'selected' : ''}>zebian</option>
                        <option value="demira" ${value === 'demira' ? 'selected' : ''}>demira</option>
                        <option value="armozel" ${value === 'armozel' ? 'selected' : ''}>armozel</option>
                    </select>
                </div>
            `;
        }
        if (field === 'is_secret') {
            const boolValue = value === true || value === 'true';
            return `
                <div class="flex flex-col space-y-2">
                    <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                    <select id="field-${field}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors">
                        <option value="false" ${!boolValue ? 'selected' : ''}>No (Regular Category)</option>
                        <option value="true" ${boolValue ? 'selected' : ''}>Yes (Secret Category)</option>
                    </select>
                </div>
            `;
        }
        if (field === 'active') {
            const boolValue = value === true || value === 'true';
            return `
                <div class="flex flex-col space-y-2">
                    <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                    <select id="field-${field}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors">
                        <option value="true" ${boolValue ? 'selected' : ''}>Active</option>
                        <option value="false" ${!boolValue ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
            `;
        }
        
        return `
            <div class="flex flex-col space-y-2">
                <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace(/_/g, ' ')}</label>
                <input type="text" id="field-${field}" value="${value}" class="w-full bg-[#0b0e14] border border-slate-700 p-4 rounded-lg text-white outline-none focus:border-[#FFD700] transition-colors" ${field === 'unlock_sequence' || field === 'signs' ? 'readonly placeholder="Sequence will be generated via picker below..."' : ''}>
            </div>
        `;
    }).join('');
    
    if (recordToEdit && (recordToEdit.unlock_sequence || recordToEdit.signs)) {
        const signField = recordToEdit.unlock_sequence ? 'unlock_sequence' : 'signs';
        let signArray = [];
        const val = recordToEdit[signField];
        
        if (Array.isArray(val)) {
            signArray = val;
        } else if (typeof val === 'string') {
            try {
                signArray = JSON.parse(val);
            } catch (e) {
                signArray = val.split(',').map(s => s.trim()).filter(s => s !== "");
            }
        }
        
        selectedSignsForForm = signArray;
    }

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
    if (!error) {
        allTableData = data || [];
        applyFilters();
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';
    const config = tableConfigs[currentTable];
    
    let filtered = [...allTableData];
    
    if (searchTerm) {
        filtered = filtered.filter(row => {
            return config.columns.some(col => {
                const val = row[col];
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(searchTerm);
            });
        });
    }
    
    if (statusFilter !== 'all') {
        if (currentTable === 'quest_categories') {
            if (statusFilter === 'active') {
                filtered = filtered.filter(row => row.is_secret === true);
            } else if (statusFilter === 'inactive') {
                filtered = filtered.filter(row => row.is_secret === false);
            }
        } else if (config.columns.includes('active')) {
            if (statusFilter === 'active') {
                filtered = filtered.filter(row => row.active === true);
            } else if (statusFilter === 'inactive') {
                filtered = filtered.filter(row => row.active === false);
            }
        }
    }
    
    renderTable(filtered, config);
}

function renderTable(data, config) {
    const head = document.getElementById('mgmt-table-head');
    const body = document.getElementById('mgmt-table-body');
    head.innerHTML = `<tr>${config.labels.map(label => `<th class="px-6 py-5 font-bold">${label}</th>`).join('')}<th class="px-6 py-5 text-right">Actions</th></tr>`;
    
    body.innerHTML = data.map(row => `
        <tr class="hover:bg-slate-800/40 transition-colors">
            ${config.columns.map(col => {
                let val = row[col];
                
                if (col === 'active' || col === 'is_secret') {
                    const isActive = val === true;
                    return `<td class="px-6 py-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${isActive ? (col === 'is_secret' ? 'SECRET' : 'ACTIVE') : (col === 'is_secret' ? 'REGULAR' : 'INACTIVE')}</span></td>`;
                }
                
                if (col === 'created_at') {
                    const date = new Date(val);
                    return `<td class="px-6 py-4 text-slate-400 text-sm">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>`;
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
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button class="db-edit-btn text-slate-500 hover:text-[#FFD700] transition-colors" data-record='${JSON.stringify(row).replace(/'/g, "&apos;")}' title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="db-delete-btn text-slate-500 hover:text-red-500 transition-colors" data-id="${row.id || row.name}" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
    
    document.querySelectorAll('.db-delete-btn').forEach(btn => btn.onclick = () => deleteRecord(btn.dataset.id));
    document.querySelectorAll('.db-edit-btn').forEach(btn => {
        btn.onclick = () => {
            const record = JSON.parse(btn.dataset.record.replace(/&apos;/g, "'"));
            showAddForm(record);
        };
    });
    enableSignTooltip();
}

async function saveRecord() {
    const config = tableConfigs[currentTable];
    const payload = {};
    
    // Validation for quest categories
    if (currentTable === 'quest_categories') {
        const nameField = document.getElementById('field-name');
        if (!nameField || !nameField.value.trim()) {
            alert('Category name is required!');
            return;
        }
    }
    
    config.insertable.forEach(field => {
        const el = document.getElementById(`field-${field}`);
        if (!el) return;
        
        const val = el.value.trim();
        
        if (['sort_order', 'gold', 'required_count'].includes(field)) {
            payload[field] = parseInt(val) || 0;
        } else if (field === 'is_secret' || field === 'active') {
            payload[field] = val === 'true';
        } else {
            payload[field] = (val === "none" || val === "") ? null : val;
        }
    });

    if (currentTable === 'secret_unlock_configs') {
        payload.unlock_sequence = payload.unlock_sequence ? payload.unlock_sequence : null;
    }

    //console.log('Attempting to save record:', payload);
    //console.log('Current table:', currentTable);
    //console.log('Edit mode:', isEditMode);

    let error, data;
    
    if (isEditMode) {
        if (currentTable === 'quest_categories') {
            ({ error, data } = await supabase.from(currentTable).update(payload).eq('name', editingRecordId).select());
        } else {
            ({ error, data } = await supabase.from(currentTable).update(payload).eq('id', editingRecordId).select());
        }
    } else {
        ({ error, data } = await supabase.from(currentTable).insert([payload]).select());
    }
    
    //console.log('Save result - Error:', error);
    //console.log('Save result - Data:', data);
    
    if (error) {
        console.error('Database error:', error);
        alert(`Error: ${error.message}\nDetails: ${error.details || 'No additional details'}\nHint: ${error.hint || 'No hint available'}`);
    } else {
        //console.log('Record saved successfully:', data);
        showToast(isEditMode ? 'Record updated successfully!' : 'Record created successfully!', 'success');
        
        document.getElementById('add-form-container').classList.add('hidden');
        
        isEditMode = false;
        editingRecordId = null;
        
        if (currentTable === 'secret_unlock_configs' || currentTable === 'heroic_feats' || currentTable === 'quest_categories') {
            if (questState.isReady()) {
                await questState.invalidate(['quests']);
            }
        }
        
        await fetchTableData();
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-24 right-6 px-6 py-4 rounded-lg shadow-2xl toast-animate z-50 ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white font-semibold`;
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} text-xl"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function deleteRecord(identifier) {
    if (!confirm('Delete record?')) return;
    
    if (currentTable === 'quest_categories') {
        await supabase.from(currentTable).delete().eq('name', identifier);
    } else {
        await supabase.from(currentTable).delete().eq('id', identifier);
    }
    
    if (currentTable === 'secret_unlock_configs' || currentTable === 'heroic_feats' || currentTable === 'quest_categories') {
        if (questState.isReady()) {
            await questState.invalidate(['quests']);
        }
    }
    
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
    
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('filter-status');
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    
    isEditMode = false;
    editingRecordId = null;
    
    fetchTableData();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!questState.isReady()) {
        await questState.initialize();
    }
    
    await loadSignsMetadata();
    enableSignTooltip();
    
    ['secret_unlock_configs', 'heroic_feats', 'quest_categories'].forEach(id => {
        const tab = document.getElementById(`tab-${id.replace(/_/g, '-')}`);
        if (tab) tab.onclick = () => setActiveTab(id);
    });
    
    document.getElementById('add-entry-btn').onclick = () => {
        // Explicitly reset edit mode when clicking "Create New"
        isEditMode = false;
        editingRecordId = null;
        //console.log('Create New button clicked - Reset edit mode');
        showAddForm();
    };
    document.getElementById('cancel-form').onclick = () => {
        document.getElementById('add-form-container').classList.add('hidden');
        isEditMode = false;
        editingRecordId = null;
    };
    document.getElementById('save-entry').onclick = saveRecord;
    
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('filter-status');
    const clearBtn = document.getElementById('clear-filters-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = 'all';
            applyFilters();
        };
    }
    
    fetchTableData();
});