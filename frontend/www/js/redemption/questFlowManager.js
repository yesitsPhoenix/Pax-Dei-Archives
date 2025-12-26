import { supabase } from '../supabaseClient.js';

let fullNodes = [];
let fullLinks = [];
let zoomBehavior;
let svgElement;

const colorScale = d3.scaleThreshold()
    .domain([1, 2, 5, 8, 10])
    .range(["#FFD700", "#f59e0b", "#d97706", "#b45309", "#78350f", "#451a03"]);

async function initDiagram() {
    const { data, error } = await supabase
        .from('cipher_quests')
        .select('id, category, unlock_prerequisite_category, unlock_required_count, quest_name, prerequisite_quest_ids')
        .order('unlock_required_count', { ascending: true });

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    injectStyles();
    addLegend();
    setupTraceCollapsible();

    const nodes = [];
    const hardLinks = [];
    const softLinks = [];
    const traceList = document.getElementById('trace-list');
    if (traceList) traceList.innerHTML = '';
    
    const idMap = new Map(data.map(q => [q.id, q]));
    const categoryGroups = d3.group(data, d => d.category);

    data.forEach((entry) => {
        nodes.push({
            id: entry.id,
            name: entry.quest_name,
            category: entry.category,
            count: entry.unlock_required_count,
            originalPrereq: entry.unlock_prerequisite_category,
            prereqIds: entry.prerequisite_quest_ids
        });

        let primaryParent = "VIRTUAL_ROOT";
        let foundHardParent = false;

        if (entry.unlock_prerequisite_category && entry.unlock_prerequisite_category !== entry.category) {
            const parentGroup = categoryGroups.get(entry.unlock_prerequisite_category);
            if (parentGroup) {
                const targetParentNode = parentGroup.find(q => q.unlock_required_count === entry.unlock_required_count);
                
                if (targetParentNode) {
                    primaryParent = targetParentNode.id;
                    foundHardParent = true;
                } else {
                    const lastInGroup = parentGroup[parentGroup.length - 1];
                    primaryParent = lastInGroup.id;
                    foundHardParent = true;
                }
            }
        } else {
            const sameCat = categoryGroups.get(entry.category) || [];
            const idx = sameCat.findIndex(q => q.id === entry.id);
            if (idx > 0) {
                primaryParent = sameCat[idx - 1].id;
                foundHardParent = true;
            }
        }

        hardLinks.push({ 
            source: primaryParent, 
            target: entry.id, 
            type: foundHardParent ? 'hard' : 'virtual' 
        });

        let explicitIds = [];
        try {
            explicitIds = Array.isArray(entry.prerequisite_quest_ids) 
                ? entry.prerequisite_quest_ids 
                : JSON.parse(entry.prerequisite_quest_ids || "[]");
        } catch(e) { explicitIds = []; }

        explicitIds.forEach(pId => {
            if (idMap.has(pId)) {
                softLinks.push({ source: pId, target: entry.id });
            } else if (pId) {
                addIssue(`Missing Requirement: "${entry.quest_name}" references ID ${pId} which does not exist.`);
            }
        });
    });

    nodes.push({ id: "VIRTUAL_ROOT", name: "Root", isVirtual: true });
    
    fullNodes = nodes;
    fullLinks = { hard: hardLinks, soft: softLinks };

    if (traceList && traceList.innerHTML === '') {
        traceList.innerHTML = '<p class="text-green-500 text-md italic">No logical inconsistencies detected.</p>';
    }

    populateFilter();
    setupResetButton();
    render(fullNodes, fullLinks);
}

function injectStyles() {
    if (document.getElementById('diagram-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'diagram-custom-styles';
    style.innerHTML = `
        .inspector-panel { transition: width 0.3s ease, min-width 0.3s ease, padding 0.3s ease; overflow: hidden; position: relative; }
        .inspector-panel.collapsed { width: 45px !important; min-width: 45px !important; padding-left: 10px !important; padding-right: 10px !important; }
        .inspector-panel.collapsed h2 span, .inspector-panel.collapsed #trace-list { display: none; }
        .inspector-panel.collapsed h2 { writing-mode: vertical-lr; margin-bottom: 0; height: 100%; justify-content: start; padding-top: 15px; }
        #layout-wrapper { transition: grid-template-columns 0.3s ease; }
        #layout-wrapper.collapsed-state { grid-template-columns: 1fr 45px; }
    `;
    document.head.appendChild(style);
}

function addIssue(msg) {
    const traceList = document.getElementById('trace-list');
    if (!traceList) return;
    const log = document.createElement('div');
    log.className = 'step-item mb-2 p-2 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-lg';
    log.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i> ${msg}`;
    traceList.appendChild(log);
}

function setupTraceCollapsible() {
    const panel = document.querySelector('.inspector-panel');
    const wrapper = document.getElementById('layout-wrapper');
    if (!panel || !wrapper) return;
    const header = panel.querySelector('h2');
    const chevron = document.getElementById('trace-chevron');
    header.onclick = () => {
        panel.classList.toggle('collapsed');
        wrapper.classList.toggle('collapsed-state');
        chevron.className = panel.classList.contains('collapsed') ? 'fas fa-chevron-left text-gray-500' : 'fas fa-chevron-right ml-auto text-gray-500';
        setTimeout(() => render(fullNodes, fullLinks), 310);
    };
}

function addLegend() {
    const resetBtn = document.getElementById('reset-view');
    if (!resetBtn || document.getElementById('diagram-legend')) return;
    const legend = document.createElement('div');
    legend.id = 'diagram-legend';
    legend.className = 'flex items-center gap-6 px-4 py-2 bg-white/5 rounded-lg border border-white/10 ml-4';
    legend.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-8 h-0.5 bg-[#dededeff]"></div>
            <span class="text-md text-gray-400 uppercase tracking-widest font-bold">Hard Lock</span>
        </div>
        <div class="flex items-center gap-2">
            <div class="w-8 h-0 border-b border-dashed border-[#10b0dcff]"></div>
            <span class="text-md text-gray-400 uppercase tracking-widest font-bold">Soft Lock</span>
        </div>
    `;
    resetBtn.parentNode.insertBefore(legend, resetBtn.nextSibling);
}

function populateFilter() {
    const filterDropdown = document.getElementById('root-filter');
    if (!filterDropdown) return;
    filterDropdown.innerHTML = '<option value="all">View All Branches</option>';
    const uniqueCats = [...new Set(fullNodes.filter(d => !d.isVirtual).map(d => d.category))];
    uniqueCats.sort().forEach(catName => {
        const opt = document.createElement('option');
        opt.value = catName;
        opt.textContent = catName;
        filterDropdown.appendChild(opt);
    });
    filterDropdown.onchange = (e) => {
        hideDetails();
        const selected = e.target.value;
        if (selected === 'all') {
            render(fullNodes, fullLinks);
        } else {
            const filteredNodes = fullNodes.filter(n => n.category === selected || n.isVirtual);
            const nodeIds = new Set(filteredNodes.map(n => n.id));
            const filteredHard = fullLinks.hard.filter(l => nodeIds.has(l.target)).map(l => {
                if (!nodeIds.has(l.source)) return { ...l, source: "VIRTUAL_ROOT", type: "virtual" };
                return l;
            });
            const filteredSoft = fullLinks.soft.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
            render(filteredNodes, { hard: filteredHard, soft: filteredSoft });
        }
    };
}

function render(nodes, links) {
    const container = document.getElementById('quest-diagram-container');
    const width = container.getBoundingClientRect().width;
    const height = container.getBoundingClientRect().height;
    svgElement = d3.select("#visualizer");
    svgElement.selectAll("*").remove();
    
    zoomBehavior = d3.zoom().scaleExtent([0.05, 5]).on("zoom", (e) => g.attr("transform", e.transform));
    const svg = svgElement.attr("viewBox", `0 0 ${width} ${height}`).call(zoomBehavior).on("click", (event) => {
        if (event.target.tagName === "svg") hideDetails();
    });
    const g = svg.append("g");

    try {
        const stratifier = d3.stratify()
            .id(d => d.id)
            .parentId(d => {
                if (d.id === "VIRTUAL_ROOT") return null;
                const l = links.hard.find(link => link.target === d.id);
                return l ? l.source : "VIRTUAL_ROOT";
            });

        const root = stratifier(nodes);
        const treeLayout = d3.tree().nodeSize([120, 450]);
        treeLayout(root);

        const nodeMap = new Map(root.descendants().map(d => [d.data.id, d]));

        g.selectAll(".link-hard")
            .data(root.links().filter(d => d.source.id !== "VIRTUAL_ROOT"))
            .enter().append("path")
            .attr("class", "link-hard")
            .attr("stroke", "#dededeff")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x + height / 2));

        g.selectAll(".link-soft")
            .data(links.soft)
            .enter().append("path")
            .attr("class", "link-soft")
            .attr("stroke", "#10b0dcff")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("fill", "none")
            .attr("d", d => {
                const s = nodeMap.get(d.source);
                const t = nodeMap.get(d.target);
                if (!s || !t) return null;
                const path = d3.path();
                path.moveTo(s.y, s.x + height / 2);
                path.bezierCurveTo(
                    (s.y + t.y) / 2, s.x + height / 2,
                    (s.y + t.y) / 2, t.x + height / 2,
                    t.y, t.x + height / 2
                );
                return path.toString();
            });

        const node = g.selectAll(".node").data(root.descendants()).enter().append("g")
            .attr("transform", d => `translate(${d.y},${d.x + height / 2})`)
            .style("display", d => d.data.isVirtual ? "none" : "block")
            .style("cursor", "pointer")
            .on("click", (e, d) => { e.stopPropagation(); showDetails(d.data); });

        node.append("circle").attr("r", 10).attr("fill", d => colorScale(d.data.count)).attr("stroke", "#fff").attr("stroke-width", 1);
        node.append("text").attr("dy", -20).attr("text-anchor", "middle").attr("fill", "white").style("font-size", "14px").style("font-weight", "600").text(d => d.data.name);

        svgElement.call(zoomBehavior.transform, d3.zoomIdentity.translate(150, 0).scale(0.4));
    } catch (err) {
        console.error("D3 Layout Error:", err);
    }
}

function setupResetButton() {
    const resetBtn = document.getElementById('reset-view');
    if (resetBtn) resetBtn.onclick = () => {
        document.getElementById('root-filter').value = 'all';
        hideDetails();
        render(fullNodes, fullLinks);
    };
}

function showDetails(data) {
    const panel = document.getElementById('details-panel');
    document.getElementById('detail-name').textContent = data.name;
    document.getElementById('detail-pre').textContent = data.originalPrereq || "None";
    document.getElementById('detail-count').textContent = data.count;
    document.getElementById('detail-id').textContent = data.id;
    panel.style.display = 'block';
}

function hideDetails() {
    const panel = document.getElementById('details-panel');
    if (panel) panel.style.display = 'none';
}

window.addEventListener('load', initDiagram);