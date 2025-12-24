import { supabase } from '../supabaseClient.js';

let currentTable = 'quest_categories';

const tableConfigs = {
    quest_categories: {
        display: 'Category',
        columns: ['id', 'name', 'created_at'],
        labels: ['Record ID', 'Name', 'Established'],
        sort: 'created_at',
        insertable: ['name']
    },
    heroic_feats: {
        display: 'Heroic Feat',
        columns: ['id', 'name', 'category', 'required_count', 'active', 'icon'],
        labels: ['Record ID', 'Title', 'Category', 'Target', 'Status', 'Fontawesome Icon'],
        sort: 'created_at',
        insertable: ['name', 'category', 'description', 'required_count', 'required_category', 'icon']
    }
};

async function fetchTableData() {
    const config = tableConfigs[currentTable];
    const { data, error } = await supabase
        .from(currentTable)
        .select('*')
        .order(config.sort, { ascending: false });

    if (error) {
        console.error(`Error fetching ${currentTable}:`, error);
        return;
    }
    renderTable(data, config);
}

function renderTable(data, config) {
    const head = document.getElementById('mgmt-table-head');
    const body = document.getElementById('mgmt-table-body');

    head.innerHTML = `
        <tr>
            ${config.labels.map(label => `<th class="px-6 py-5 font-bold">${label}</th>`).join('')}
            <th class="px-6 py-5 text-right">Actions</th>
        </tr>
    `;

    body.innerHTML = data.map(row => `
        <tr class="hover:bg-slate-800/40 transition-colors">
            ${config.columns.map(col => {
                let val = row[col];
                if (col === 'active') {
                    return `
                        <td class="px-6 py-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-black tracking-widest ${val ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-rose-500/10 text-rose-500'}">
                                ${val ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                        </td>
                    `;
                }
                if (col === 'id' || col.includes('_id')) {
                    return `<td class="px-6 py-4 font-mono text-[12px] text-slate-500 select-all">${val}</td>`;
                }
                if (col === 'created_at' || col === 'claimed_at') {
                    return `<td class="px-6 py-4 text-slate-400 text-md">${new Date(val).toLocaleDateString()} <span class="text-[12px] opacity-50">${new Date(val).toLocaleTimeString()}</span></td>`;
                }
                return `<td class="px-6 py-4 text-slate-200 font-medium">${val ?? '—'}</td>`;
            }).join('')}
            <td class="px-6 py-4 text-right">
                <button class="db-delete-btn text-slate-600 hover:text-rose-500 p-2 transition-colors" data-id="${row.id}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.db-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteRecord(btn.dataset.id));
    });
}

async function deleteRecord(id) {
    if (!confirm(`This action will permanently delete record ${id} from the database. Continue?`)) return;
    const { error } = await supabase.from(currentTable).delete().eq('id', id);
    if (error) alert("Deletion Error: " + error.message);
    else fetchTableData();
}

function showAddForm() {
    const config = tableConfigs[currentTable];
    if (config.insertable.length === 0) {
        alert("The Claims registry is automated and cannot be manually modified.");
        return;
    }

    const container = document.getElementById('add-form-container');
    const fields = document.getElementById('dynamic-form-fields');
    document.getElementById('form-title').innerText = `Register New ${config.display}`;
    
    fields.innerHTML = config.insertable.map(field => `
        <div class="flex flex-col space-y-2">
            <label class="text-[12px] font-black uppercase tracking-[0.15em] text-[#FFD700]">${field.replace('_', ' ')}</label>
            <input type="text" id="field-${field}" placeholder="Enter ${field}..." class="w-full bg-[#0b0e14] border border-slate-700 p-3 rounded-md text-white placeholder-slate-600 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none transition-all">
        </div>
    `).join('');

    container.classList.remove('hidden');
    window.scrollTo({ top: container.offsetTop - 100, behavior: 'smooth' });
}

async function saveRecord() {
    const config = tableConfigs[currentTable];
    const payload = {};
    
    config.insertable.forEach(field => {
        const val = document.getElementById(`field-${field}`).value.trim();
        payload[field] = val;
    });

    const { error } = await supabase.from(currentTable).insert([payload]);

    if (error) {
        alert("Insertion Error: " + error.message);
    } else {
        document.getElementById('add-form-container').classList.add('hidden');
        fetchTableData();
    }
}

function setActiveTab(tableId) {
    currentTable = tableId;
    document.querySelectorAll('.mgmt-tab').forEach(tab => {
        tab.classList.remove('active', 'text-[#FFD700]');
        tab.classList.add('text-slate-400');
    });

    const triggerId = `tab-${tableId.split('_')[1] || tableId}`;
    const activeTab = document.getElementById(triggerId);
    if (activeTab) {
        activeTab.classList.add('active', 'text-[#FFD700]');
        activeTab.classList.remove('text-slate-400');
    }

    document.getElementById('add-form-container').classList.add('hidden');
    fetchTableData();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tab-categories').addEventListener('click', () => setActiveTab('quest_categories'));
    document.getElementById('tab-feats').addEventListener('click', () => setActiveTab('heroic_feats'));
    
    document.getElementById('add-entry-btn').addEventListener('click', showAddForm);
    document.getElementById('cancel-form').addEventListener('click', () => document.getElementById('add-form-container').classList.add('hidden'));
    document.getElementById('save-entry').addEventListener('click', saveRecord);

    fetchTableData();
});