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
let sortColumn = null;
let sortDirection = 'asc';

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
    },
    user_claims: {
        display: 'User Quest Claim',
        columns: ['username', 'character_name', 'quest_name', 'claimed_at'],
        labels: ['Username', 'Character', 'Quest Name', 'Claimed Date'],
        sort: 'claimed_at',
        insertable: [], // No creation for user claims
        searchable: true,
        sortableColumns: ['quest_name', 'claimed_at'] // Enable sorting on these columns
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
    // User claims cannot be created, only deleted
    if (currentTable === 'user_claims') {
        return;
    }
    
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
    const tbody = document.getElementById('mgmt-table-body');
    const thead = document.getElementById('mgmt-table-head');
    tbody.innerHTML = '<tr><td colspan="99" class="text-center py-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>';

    const config = tableConfigs[currentTable];
    if (!config) return;

    let data = [];
    
    if (currentTable === 'user_claims') {
        // Load all user claims at once (no pagination) - ADMIN VIEW
        const { data: claimsData, error, count } = await supabase
            .from('user_claims')
            .select('id, user_id, quest_id, character_id, claimed_at', { count: 'exact' })
            .order(config.sort, { ascending: false });
        
        if (error) {
            console.error('Error fetching user claims:', error);
            tbody.innerHTML = '<tr><td colspan="99" class="text-center py-8 text-red-500">Error loading data</td></tr>';
            return;
        }
        
        // Fetch related data separately
        const userIds = [...new Set(claimsData.map(c => c.user_id))];
        const questIds = [...new Set(claimsData.map(c => c.quest_id))];
        const characterIds = [...new Set(claimsData.map(c => c.character_id))];
        
        const { data: users } = await supabase.from('users').select('id, username').in('id', userIds);
        const { data: quests } = await supabase.from('cipher_quests').select('id, quest_name, quest_key').in('id', questIds);
        const { data: characters } = await supabase.from('characters').select('character_id, character_name').in('character_id', characterIds);
        
        const userMap = new Map(users?.map(u => [u.id, u]) || []);
        const questMap = new Map(quests?.map(q => [q.id, q]) || []);
        const characterMap = new Map(characters?.map(c => [c.character_id, c]) || []);
        
        // Transform the data to match our column structure
        data = claimsData.map(claim => ({
            id: claim.id,
            user_id: claim.user_id,
            quest_id: claim.quest_id,
            character_id: claim.character_id,
            username: userMap.get(claim.user_id)?.username || 'Unknown',
            character_name: characterMap.get(claim.character_id)?.character_name || 'Unknown',
            quest_name: questMap.get(claim.quest_id)?.quest_name || 'Unknown',
            quest_key: questMap.get(claim.quest_id)?.quest_key || 'unknown',
            claimed_at: claim.claimed_at
        }));
    } else {
        const { data: fetchedData, error } = await supabase
            .from(currentTable)
            .select('*')
            .order(config.sort, { ascending: false });
        
        if (error) {
            console.error('Error:', error);
            tbody.innerHTML = '<tr><td colspan="99" class="text-center py-8 text-red-500">Error loading data</td></tr>';
            return;
        }
        data = fetchedData;
    }

    allTableData = data;
    applyFilters();
}

function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';
    const config = tableConfigs[currentTable];
    
    let filtered = [...allTableData];
    
    // User claims specific filtering
    if (currentTable === 'user_claims') {
        const usernameSearch = document.getElementById('search-username')?.value.toLowerCase() || '';
        const questSearch = document.getElementById('search-quest')?.value.toLowerCase() || '';
        
        if (usernameSearch) {
            filtered = filtered.filter(row => {
                const username = (row.username || '').toLowerCase();
                const characterName = (row.character_name || '').toLowerCase();
                return username.includes(usernameSearch) || characterName.includes(usernameSearch);
            });
        }
        
        if (questSearch) {
            filtered = filtered.filter(row => {
                const questName = (row.quest_name || '').toLowerCase();
                return questName.includes(questSearch);
            });
        }
    } else if (searchTerm) {
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
    
    // Apply sorting if a column is selected
    if (sortColumn) {
        filtered.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];
            
            // Handle dates
            if (sortColumn === 'claimed_at' || sortColumn === 'created_at') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }
            // Handle strings (case insensitive)
            else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal || '').toLowerCase();
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    renderTable(filtered, config);
}

function renderTable(data, config) {
    const head = document.getElementById('mgmt-table-head');
    const body = document.getElementById('mgmt-table-body');
    
    // Create table headers with sorting indicators
    const sortableColumns = config.sortableColumns || [];
    const headerCells = config.labels.map((label, index) => {
        const columnName = config.columns[index];
        const isSortable = sortableColumns.includes(columnName);
        
        if (isSortable) {
            const isActive = sortColumn === columnName;
            const sortIcon = isActive 
                ? (sortDirection === 'asc' ? '<i class="fa-solid fa-sort-up ml-2"></i>' : '<i class="fa-solid fa-sort-down ml-2"></i>')
                : '<i class="fa-solid fa-sort ml-2 opacity-30"></i>';
            
            return `<th class="px-6 py-5 font-bold cursor-pointer hover:text-[#FFD700] transition-colors ${isActive ? 'text-[#FFD700]' : ''}" data-column="${columnName}">${label}${sortIcon}</th>`;
        }
        return `<th class="px-6 py-5 font-bold">${label}</th>`;
    }).join('');
    
    head.innerHTML = `<tr>${headerCells}<th class="px-6 py-5 text-right">Actions</th></tr>`;
    
    // Add click handlers for sortable columns
    head.querySelectorAll('th[data-column]').forEach(th => {
        th.onclick = () => {
            const column = th.getAttribute('data-column');
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }
            applyFilters();
        };
    });
    
    body.innerHTML = data.map(row => `
        <tr class="hover:bg-slate-800/40 transition-colors">
            ${config.columns.map(col => {
                let val = row[col];
                
                if (col === 'active' || col === 'is_secret') {
                    const isActive = val === true;
                    return `<td class="px-6 py-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${isActive ? (col === 'is_secret' ? 'SECRET' : 'ACTIVE') : (col === 'is_secret' ? 'REGULAR' : 'INACTIVE')}</span></td>`;
                }
                
                if (col === 'created_at' || col === 'claimed_at') {
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
                    ${currentTable !== 'user_claims' ? `<button class="db-edit-btn text-slate-500 hover:text-[#FFD700] transition-colors" data-record='${JSON.stringify(row).replace(/'/g, "&apos;")}' title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>` : ''}
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
    const record = allTableData.find(r => (r.id || r.name) === identifier);
    
    // Show custom modal instead of browser confirm
    const modal = document.getElementById('delete-confirm-modal');
    const message = document.getElementById('delete-confirm-message');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    
    // Set the message based on table type
    if (currentTable === 'user_claims' && record) {
        message.innerHTML = `Delete claim for user <span class="text-[#FFD700] font-bold">"${record.username}"</span> (${record.character_name}) on quest <span class="text-[#FFD700] font-bold">"${record.quest_name}"</span>?`;
    } else {
        message.textContent = 'Are you sure you want to delete this record?';
    }
    
    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Set up one-time event handlers
    const handleConfirm = async () => {
        // Hide modal
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Perform deletion
        let result;
        if (currentTable === 'quest_categories') {
            result = await supabase.from(currentTable).delete().eq('name', identifier);
        } else {
            result = await supabase.from(currentTable).delete().eq('id', identifier);
        }
        
        if (result.error) {
            console.error('Delete failed:', result.error);
            showToast(`Delete failed: ${result.error.message}`, 'error');
        } else {
            showToast('Record deleted successfully', 'success');
        }
        
        if (currentTable === 'secret_unlock_configs' || currentTable === 'heroic_feats' || currentTable === 'quest_categories') {
            if (questState.isReady()) {
                await questState.invalidate(['quests']);
            }
        }
        
        await fetchTableData();
        
        // Clean up listeners
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    const handleCancel = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    // Also close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            handleCancel();
        }
    });
}

function setActiveTab(tableId) {
    currentTable = tableId;
    sortColumn = null;
    sortDirection = 'asc';
    
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
    
    // Hide/show Create New button based on table
    const addBtn = document.getElementById('add-entry-btn');
    if (addBtn) {
        if (currentTable === 'user_claims') {
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'block';
        }
    }
    
    // Hide/show status filter and user claims filters
    const statusFilter = document.getElementById('filter-status');
    const userClaimsFilters = document.getElementById('user-claims-filters');
    const mainSearchInput = document.getElementById('search-input');
    
    if (currentTable === 'user_claims') {
        if (statusFilter) statusFilter.style.display = 'none';
        if (userClaimsFilters) userClaimsFilters.classList.remove('hidden');
        if (mainSearchInput) mainSearchInput.style.display = 'none';
    } else {
        if (statusFilter) statusFilter.style.display = 'block';
        if (userClaimsFilters) userClaimsFilters.classList.add('hidden');
        if (mainSearchInput) mainSearchInput.style.display = 'block';
    }
    
    const searchInput = document.getElementById('search-input');
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
    
    ['secret_unlock_configs', 'heroic_feats', 'quest_categories', 'user_claims'].forEach(id => {
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
            
            const usernameSearch = document.getElementById('search-username');
            const questSearch = document.getElementById('search-quest');
            if (usernameSearch) usernameSearch.value = '';
            if (questSearch) questSearch.value = '';
            
            applyFilters();
        };
    }
    
    // Add event listeners for user claims search fields
    const usernameSearch = document.getElementById('search-username');
    const questSearch = document.getElementById('search-quest');
    
    if (usernameSearch) {
        usernameSearch.addEventListener('input', applyFilters);
    }
    
    if (questSearch) {
        questSearch.addEventListener('input', applyFilters);
    }
    
    fetchTableData();
});