import { questState } from './questStateManager.js';

let cy = null;
let allQuests = [];
let activeFilters = new Set(); // Track which categories are being highlighted

// Enhanced color scale based on unlock_required_count
const getNodeColor = (quest) => {
    const count = quest.unlock_required_count || 0;
    
    // Color based on unlock_required_count (matches the legend)
    if (count === 0) return '#FFD700';      // Gold - Entry points
    if (count <= 2) return '#10B981';       // Emerald Green - Early
    if (count <= 5) return '#06B6D4';       // Cyan - Mid
    if (count <= 8) return '#F59E0B';       // Amber - Late
    return '#EF4444';                        // Red - Advanced
};

async function initDiagram() {
    try {
        if (!questState.isReady()) {
            await questState.initialize();
        }
        
        allQuests = questState.getAllQuests();
        
        if (!allQuests || allQuests.length === 0) {
            console.error("No quest data available");
            return;
        }

        //console.log(`Loaded ${allQuests.length} quests`);

        setupUI();
        initCytoscape();
        populateFilter();
        renderGraph();
        
        // Run validation and metrics after render completes
        setTimeout(() => {
            runValidation();
            calculateMetrics();
        }, 500);
    } catch (error) {
        console.error("Error initializing diagram:", error);
    }
}

function setupUI() {
    setupTraceCollapsible();
    setupResetButton();
    setupMainPathToggle();
    setupCategoryFilters();
}

function initCytoscape() {
    const container = document.getElementById('visualizer');
    if (!container) {
        console.error("Visualizer container not found");
        return;
    }

    cy = cytoscape({
        container: container,
        
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'label': 'data(label)',
                    'color': '#ffffff',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 5,
                    'font-size': '14px',
                    'font-weight': '600',
                    'width': 30,
                    'height': 30,
                    'border-width': 2,
                    'border-color': '#fff',
                    'text-outline-width': 2,
                    'text-outline-color': '#000',
                    'transition-property': 'background-color, border-color, width, height',
                    'transition-duration': '0.3s'
                }
            },
            {
                selector: 'node.main-path',
                style: {
                    'width': 35,
                    'height': 35,
                    'border-width': 3,
                    'border-color': '#FFD700'
                }
            },
            {
                selector: 'node[!color]',
                style: {
                    'background-color': '#666'
                }
            },
            {
                selector: 'node[virtual="true"]',
                style: {
                    'width': 0.1,
                    'height': 0.1,
                    'opacity': 0,
                    'label': '',
                    'events': 'no'
                }
            },
            {
                selector: 'edge.hard',
                style: {
                    'width': 2,
                    'line-color': '#dedede',
                    'target-arrow-color': '#dedede',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.5
                }
            },
            {
                selector: 'edge.hard-lock',
                style: {
                    'width': 3,
                    'line-color': '#EF4444',
                    'target-arrow-color': '#EF4444',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.5,
                    'line-style': 'solid'
                }
            },
            {
                selector: 'edge.soft-lock',
                style: {
                    'width': 2,
                    'line-color': '#F59E0B',
                    'target-arrow-color': '#F59E0B',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.2,
                    'line-style': 'dashed'
                }
            },
            {
                selector: 'edge.main-path',
                style: {
                    'width': 3,
                    'line-color': '#FFD700',
                    'target-arrow-color': '#FFD700'
                }
            },
            {
                selector: 'node.highlighted',
                style: {
                    'border-color': '#FFD700',
                    'border-width': 4,
                    'width': 40,
                    'height': 40,
                    'background-color': 'data(color)' // Keep original color
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'width': 4,
                    'line-color': '#FFD700',
                    'target-arrow-color': '#FFD700',
                    'opacity': 1
                }
            },
            {
                selector: '.dimmed',
                style: {
                    'opacity': 0.2
                }
            },
            {
                selector: 'node.orphan',
                style: {
                    'border-color': '#ef4444',
                    'border-width': 3
                }
            }
        ],

        layout: {
            name: 'preset'
        },

        minZoom: 0.1,
        maxZoom: 3
    });

    // Event handlers
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        if (node.data('virtual')) return;
        
        showDetails(node.data());
        highlightPaths(node);
    });

    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            hideDetails();
            clearHighlights();
        }
    });
}

function renderGraph() {
    if (!cy) {
        console.error("Cytoscape not initialized");
        return;
    }

    try {
        // Clear existing elements
        cy.elements().remove();
        
        const nodes = [];
        const edges = [];
        const categoryGroups = new Map();
        
        let filteredQuests = allQuests;

        //console.log(`Rendering ${filteredQuests.length} quests`);

        // Group quests by category and sort by sort_order
        filteredQuests.forEach(quest => {
            const cat = quest.category || 'Uncategorized';
            if (!categoryGroups.has(cat)) {
                categoryGroups.set(cat, []);
            }
            categoryGroups.get(cat).push(quest);
        });

        // Sort each category by sort_order
        categoryGroups.forEach((quests, cat) => {
            quests.sort((a, b) => {
                const aSort = a.sort_order ?? 999999;
                const bSort = b.sort_order ?? 999999;
                return aSort - bSort;
            });
        });

        // Find the absolute root quest
        const rootQuest = filteredQuests.find(q => 
            q.quest_name === 'First Steps into the World' || 
            q.quest_key === 'first-steps-into-the-world' ||
            (q.category === 'The First Steps: Beginner\'s Guide' && q.sort_order === 1)
        );
        
        if (rootQuest) {
            //console.log(`✓ ROOT QUEST FOUND: "${rootQuest.quest_name}" (id: ${rootQuest.id})`);
        }

        // Create virtual root (invisible)
        nodes.push({
            data: {
                id: 'VIRTUAL_ROOT',
                label: '',
                virtual: 'true',
                color: '#000000'
            }
        });

        // Create nodes for each quest
        filteredQuests.forEach(quest => {
            const isMainPath = quest.category === "The First Steps: Beginner's Guide";
            const nodeColor = getNodeColor(quest);
            
            nodes.push({
                data: {
                    id: quest.id,
                    label: truncateLabel(quest.quest_name, 20),
                    fullName: quest.quest_name,
                    color: nodeColor,
                    category: quest.category,
                    count: quest.unlock_required_count || 0,
                    prereqCategory: quest.unlock_prerequisite_category,
                    prereqIds: quest.prerequisite_quest_ids || [],
                    isMainPath: isMainPath
                },
                classes: isMainPath ? 'main-path' : ''
            });
        });

        // Build hard edges (category-based chain)
        const questIdMap = new Map(filteredQuests.map(q => [q.id, q]));
        const hardEdgeTargets = new Set();
        
        filteredQuests.forEach(quest => {
            let parentId = null;
            let isMainPathEdge = false;

            // Special case: If this is the root quest, skip (no parent)
            if (rootQuest && quest.id === rootQuest.id) {
                return;
            }
            // Case 1: Quest has a prerequisite category different from its own
            else if (quest.unlock_prerequisite_category && 
                quest.unlock_prerequisite_category !== quest.category) {
                
                const prereqCategoryQuests = categoryGroups.get(quest.unlock_prerequisite_category);
                
                if (prereqCategoryQuests && prereqCategoryQuests.length > 0) {
                    const matchingQuest = prereqCategoryQuests.find(q => 
                        q.unlock_required_count === quest.unlock_required_count
                    );
                    
                    if (matchingQuest) {
                        parentId = matchingQuest.id;
                    } else {
                        parentId = prereqCategoryQuests[prereqCategoryQuests.length - 1].id;
                    }
                }
            } 
            // Case 2: Link to previous quest in same category
            else {
                const sameCategoryQuests = categoryGroups.get(quest.category);
                if (sameCategoryQuests) {
                    const idx = sameCategoryQuests.findIndex(q => q.id === quest.id);
                    if (idx > 0) {
                        parentId = sameCategoryQuests[idx - 1].id;
                        // Check if this edge is part of the main path
                        isMainPathEdge = quest.category === "The First Steps: Beginner's Guide";
                    }
                }
            }

            // Add hard edge if parent found
            if (parentId && questIdMap.has(parentId)) {
                edges.push({
                    data: {
                        source: parentId,
                        target: quest.id,
                        id: `hard-${parentId}-${quest.id}`
                    },
                    classes: isMainPathEdge ? 'hard main-path' : 'hard'
                });
                hardEdgeTargets.add(quest.id);
            } else if (!parentId && !rootQuest) {
                edges.push({
                    data: {
                        source: 'VIRTUAL_ROOT',
                        target: quest.id,
                        id: `hard-root-${quest.id}`
                    },
                    classes: 'hard'
                });
            }
        });

        //console.log(`Adding ${nodes.length} nodes and ${edges.length} edges`);

        // Add hard lock edges (quest-level dependencies)
        filteredQuests.forEach(quest => {
            const hardLocks = quest.hard_lock_quest_ids || [];
            hardLocks.forEach(hardLockId => {
                if (questIdMap.has(hardLockId)) {
                    edges.push({
                        data: {
                            source: hardLockId,
                            target: quest.id,
                            id: `hard-lock-${hardLockId}-${quest.id}`
                        },
                        classes: 'hard-lock'
                    });
                }
            });
        });

        // Add soft lock edges (prerequisite dependencies)
        filteredQuests.forEach(quest => {
            const softLocks = quest.prerequisite_quest_ids || [];
            softLocks.forEach(softLockId => {
                if (questIdMap.has(softLockId)) {
                    edges.push({
                        data: {
                            source: softLockId,
                            target: quest.id,
                            id: `soft-lock-${softLockId}-${quest.id}`
                        },
                        classes: 'soft-lock'
                    });
                }
            });
        });

        // Add all elements to graph
        cy.add([...nodes, ...edges]);

        // Apply layout
        applyLayout();
        
    } catch (error) {
        console.error("Error rendering graph:", error);
    }
}

function applyLayout() {
    try {
        const mainPathNodes = cy.nodes().filter(n => n.data('isMainPath'));
        
        // Run dagre layout
        const layout = cy.layout({
            name: 'dagre',
            rankDir: 'LR',
            nodeSep: 120,
            rankSep: 250,
            edgeSep: 30,
            ranker: 'network-simplex',
            align: undefined,
            animate: false,
            fit: true,
            padding: 50
        });

        const promise = layout.promiseOn('layoutstop');
        layout.run();
        
        // Use promise instead of event listener
        promise.then(() => {
            straightenMainPath();
            cy.fit(50);
        }).catch((err) => {
            console.error('Layout promise error:', err);
            straightenMainPath();
        });
        
        // Fallback timeout
        setTimeout(() => {
            straightenMainPath();
            cy.fit(50);
        }, 500);
        
    } catch (error) {
        console.error("Layout error:", error);
    }
}

function straightenMainPath() {
    try {
        const mainPathNodes = cy.nodes('.main-path').sort((a, b) => {
            return a.position('x') - b.position('x');
        });
        
        if (mainPathNodes.length === 0) {
            console.warn('No main path nodes found!');
            return;
        }
        
        // Calculate the center Y position of all main path nodes
        let totalY = 0;
        mainPathNodes.forEach(node => {
            totalY += node.position('y');
        });
        const centerY = totalY / mainPathNodes.length;
        
        // Force all main path nodes to the center Y position
        mainPathNodes.forEach((node, index) => {
            const oldPos = node.position();
            node.position({
                x: oldPos.x,
                y: centerY
            });
        });
        
        // Resolve overlapping nodes
        resolveOverlaps();
        
    } catch (error) {
        console.error("Error straightening main path:", error);
    }
}

function resolveOverlaps() {
    const MIN_DISTANCE = 100;
    const allNodes = cy.nodes().not('[virtual="true"]');
    
    // Check all pairs of nodes for overlaps
    allNodes.forEach((node1, i) => {
        allNodes.slice(i + 1).forEach(node2 => {
            const pos1 = node1.position();
            const pos2 = node2.position();
            
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If nodes are too close, push them apart
            if (distance < MIN_DISTANCE && distance > 0) {
                const angle = Math.atan2(dy, dx);
                const pushDistance = (MIN_DISTANCE - distance) / 2;
                
                const isNode1MainPath = node1.hasClass('main-path');
                const isNode2MainPath = node2.hasClass('main-path');
                
                if (isNode1MainPath && !isNode2MainPath) {
                    // Only push node2 away from main path
                    const newX2 = pos2.x + Math.cos(angle) * (MIN_DISTANCE - distance);
                    const newY2 = pos2.y + Math.sin(angle) * (MIN_DISTANCE - distance);
                    node2.position({ x: newX2, y: newY2 });
                } else if (isNode2MainPath && !isNode1MainPath) {
                    // Only push node1 away from main path
                    const newX1 = pos1.x - Math.cos(angle) * (MIN_DISTANCE - distance);
                    const newY1 = pos1.y - Math.sin(angle) * (MIN_DISTANCE - distance);
                    node1.position({ x: newX1, y: newY1 });
                } else if (!isNode1MainPath && !isNode2MainPath) {
                    // Push both nodes apart equally
                    const newX1 = pos1.x - Math.cos(angle) * pushDistance;
                    const newY1 = pos1.y - Math.sin(angle) * pushDistance;
                    const newX2 = pos2.x + Math.cos(angle) * pushDistance;
                    const newY2 = pos2.y + Math.sin(angle) * pushDistance;
                    
                    node1.position({ x: newX1, y: newY1 });
                    node2.position({ x: newX2, y: newY2 });
                }
            }
        });
    });
}

function highlightPaths(node) {
    try {
        clearHighlights();
        
        // Highlight the selected node
        node.addClass('highlighted');
        
        // Highlight predecessors with depth limit to prevent infinite loops
        const predecessors = node.predecessors().filter((ele, i) => i < 50);
        predecessors.nodes().addClass('highlighted');
        predecessors.edges().addClass('highlighted');
        
        // Dim everything else
        cy.elements().difference(predecessors.union(node)).addClass('dimmed');
    } catch (error) {
        console.error("Error highlighting paths:", error);
        clearHighlights();
    }
}

function clearHighlights() {
    if (cy) {
        cy.elements().removeClass('highlighted dimmed category-filter');
    }
}

function truncateLabel(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function showDetails(data) {
    const panel = document.getElementById('details-panel');
    if (!panel) return;
    
    // Get the full quest data
    const quest = allQuests.find(q => q.id === data.id);
    
    document.getElementById('detail-name').textContent = data.fullName || data.label;
    document.getElementById('detail-pre').textContent = data.prereqCategory || 'None';
    document.getElementById('detail-count').textContent = data.count || 0;
    document.getElementById('detail-id').textContent = data.id || '';
    
    // Build soft prerequisites list
    const prereqContainer = document.getElementById('detail-soft-prereqs');
    if (prereqContainer && quest) {
        let prereqIds = [];
        try {
            prereqIds = Array.isArray(quest.prerequisite_quest_ids)
                ? quest.prerequisite_quest_ids
                : (quest.prerequisite_quest_ids ? JSON.parse(quest.prerequisite_quest_ids) : []);
        } catch (e) {
            prereqIds = [];
        }
        
        if (prereqIds.length > 0) {
            const prereqQuests = prereqIds
                .map(id => allQuests.find(q => q.id === id))
                .filter(q => q); // Remove nulls
            
            if (prereqQuests.length > 0) {
                const prereqList = prereqQuests
                    .map(q => `<div class="text-sm px-2 py-1 bg-amber-500/20 rounded hover:bg-amber-500/30 cursor-pointer" onclick="window.highlightQuest('${q.id}')">
                        <i class="fas fa-arrow-right mr-1"></i>${q.quest_name}
                    </div>`)
                    .join('');
                
                prereqContainer.innerHTML = `
                    <p class="text-sm uppercase tracking-wider text-gray-500 mb-1">Soft Prerequisites (Required to Complete):</p>
                    <div class="space-y-1">${prereqList}</div>
                `;
                prereqContainer.style.display = 'block';
            } else {
                prereqContainer.style.display = 'none';
            }
        } else {
            prereqContainer.style.display = 'none';
        }
    }

    // Build hard lock prerequisites list
    const hardLockContainer = document.getElementById('detail-hard-locks');
    if (hardLockContainer && quest) {
        let hardLockIds = [];
        try {
            hardLockIds = Array.isArray(quest.hard_lock_quest_ids)
                ? quest.hard_lock_quest_ids
                : (quest.hard_lock_quest_ids ? JSON.parse(quest.hard_lock_quest_ids) : []);
        } catch (e) {
            hardLockIds = [];
        }
        
        if (hardLockIds.length > 0) {
            const hardLockQuests = hardLockIds
                .map(id => allQuests.find(q => q.id === id))
                .filter(q => q); // Remove nulls
            
            if (hardLockQuests.length > 0) {
                const hardLockList = hardLockQuests
                    .map(q => `<div class="text-sm px-2 py-1 bg-red-500/20 rounded hover:bg-red-500/30 cursor-pointer" onclick="window.highlightQuest('${q.id}')">
                        <i class="fas fa-arrow-right mr-1"></i>${q.quest_name}
                    </div>`)
                    .join('');
                
                hardLockContainer.innerHTML = `
                    <p class="text-sm uppercase tracking-wider text-gray-500 mb-1">Hard Locks (Required to Unlock):</p>
                    <div class="space-y-1">${hardLockList}</div>
                `;
                hardLockContainer.style.display = 'block';
            } else {
                hardLockContainer.style.display = 'none';
            }
        } else {
            hardLockContainer.style.display = 'none';
        }
    }
    
    panel.style.display = 'block';
}

function hideDetails() {
    const panel = document.getElementById('details-panel');
    if (panel) panel.style.display = 'none';
}

function populateFilter() {
    const filterContainer = document.getElementById('toggle-container');
    if (!filterContainer) return;
    
    // Get unique categories
    const categories = [...new Set(allQuests.map(q => q.category).filter(Boolean))];
    
    // Create dropdown options
    const categoryOptions = categories.map(cat => 
        `<option value="${cat}">${cat}</option>`
    ).join('');
    
    filterContainer.innerHTML = `
        <div class="flex items-center gap-3">
            <label class="text-lg font-medium text-gray-400">Filter by Category:</label>
            <select id="category-filter" class="bg-[#2a2a2a] text-white border border-[#444] px-3 py-2 rounded-lg text-sm">
                <option value="all">All Categories</option>
                ${categoryOptions}
            </select>
        </div>
    `;
    
    // Add change handler
    const dropdown = document.getElementById('category-filter');
    if (dropdown) {
        dropdown.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            applyCategoryFilter(selectedCategory);
        });
    }
}

function applyCategoryFilter(category) {
    if (category === 'all') {
        // No filter - show everything normally
        cy.elements().removeClass('dimmed category-filter');
    } else {
        // Dim everything except selected category
        cy.nodes().forEach(node => {
            if (node.data('virtual')) return;
            
            if (node.data('category') === category) {
                node.removeClass('dimmed');
                node.addClass('category-filter');
            } else {
                node.addClass('dimmed');
                node.removeClass('category-filter');
            }
        });
        
        // Handle edges - show if either source or target is in selected category
        cy.edges().forEach(edge => {
            const source = edge.source();
            const target = edge.target();
            
            if (source.data('category') === category || target.data('category') === category) {
                edge.removeClass('dimmed');
            } else {
                edge.addClass('dimmed');
            }
        });
    }
}

function setupMainPathToggle() {
    const resetBtn = document.getElementById('reset-view');
    if (!resetBtn) return;
    
    // Add "Trace Main Path" button next to reset
    const traceBtn = document.createElement('button');
    traceBtn.id = 'trace-main-path';
    traceBtn.className = 'btn-reset';
    traceBtn.innerHTML = '<i class="fas fa-route mr-1"></i> Trace Main Path';
    resetBtn.parentElement.insertBefore(traceBtn, resetBtn.nextSibling);
    
    let mainPathActive = false;
    
    traceBtn.addEventListener('click', () => {
        if (mainPathActive) {
            // Clear trace
            clearHighlights();
            traceBtn.innerHTML = '<i class="fas fa-route mr-1"></i> Trace Main Path';
            traceBtn.style.background = '#333';
            mainPathActive = false;
        } else {
            // Highlight main path
            clearHighlights();
            
            const mainPathNodes = cy.nodes('.main-path');
            const mainPathEdges = cy.edges('.main-path');
            
            mainPathNodes.addClass('highlighted');
            mainPathEdges.addClass('highlighted');
            
            // Dim everything else
            cy.elements().not('.main-path').addClass('dimmed');
            
            traceBtn.innerHTML = '<i class="fas fa-times mr-1"></i> Clear Trace';
            traceBtn.style.background = '#FFD700';
            traceBtn.style.color = '#000';
            mainPathActive = true;
        }
    });
}

function setupCategoryFilters() {
    // Category filtering is now handled by populateFilter()
}

function setupResetButton() {
    const resetBtn = document.getElementById('reset-view');
    if (resetBtn) {
        resetBtn.onclick = () => {
            hideDetails();
            clearHighlights();
            activeFilters.clear();
            
            // Reset category filter dropdown
            const dropdown = document.getElementById('category-filter');
            if (dropdown) {
                dropdown.value = 'all';
            }
            
            // Reset main path toggle if it exists
            const traceBtn = document.getElementById('trace-main-path');
            if (traceBtn) {
                traceBtn.innerHTML = '<i class="fas fa-route mr-1"></i> Trace Main Path';
                traceBtn.style.background = '#333';
                traceBtn.style.color = '#ccc';
            }
            
            // Reset zoom
            cy.fit(50);
        };
    }
}

function setupTraceCollapsible() {
    const panel = document.querySelector('.inspector-panel');
    const wrapper = document.getElementById('layout-wrapper');
    if (!panel || !wrapper) return;
    
    const header = panel.querySelector('h2');
    const chevron = document.getElementById('trace-chevron');
    
    if (header && chevron) {
        header.onclick = () => {
            panel.classList.toggle('collapsed');
            wrapper.classList.toggle('collapsed-state');
            
            if (panel.classList.contains('collapsed')) {
                chevron.className = 'fas fa-chevron-left text-gray-500';
            } else {
                chevron.className = 'fas fa-chevron-right ml-auto text-gray-500';
            }
            
            setTimeout(() => {
                if (cy) cy.resize();
            }, 310);
        };
    }
}

function runValidation() {
    const validationContainer = document.getElementById('validation-container');
    if (!validationContainer) return;
    
    try {
        validationContainer.innerHTML = '<p class="text-gray-500 text-sm">Running validation checks...</p>';
        
        const issues = [];
        const warnings = [];
        
        // 1. Check for orphaned quests
        const orphans = findOrphanQuests();
        if (orphans.length > 0) {
            warnings.push({
                type: 'warning',
                icon: 'fa-unlink',
                title: 'Orphaned Quests Detected',
                message: `${orphans.length} quest(s) have no prerequisites or dependents`,
                quests: orphans
            });
        }
        
        // 2. Check for missing prerequisite quest IDs
        const missingPrereqs = [];
        allQuests.forEach(quest => {
            let prereqIds = [];
            try {
                prereqIds = Array.isArray(quest.prerequisite_quest_ids)
                    ? quest.prerequisite_quest_ids
                    : (quest.prerequisite_quest_ids ? JSON.parse(quest.prerequisite_quest_ids) : []);
            } catch (e) {
                prereqIds = [];
            }
            
            prereqIds.forEach(prereqId => {
                const exists = allQuests.find(q => q.id === prereqId);
                if (!exists) {
                    missingPrereqs.push({ quest: quest, missingId: prereqId });
                }
            });
        });
        
        if (missingPrereqs.length > 0) {
            issues.push({
                type: 'error',
                icon: 'fa-exclamation-triangle',
                title: 'Missing Prerequisites',
                message: `${missingPrereqs.length} quest(s) reference non-existent prerequisite IDs`,
                items: missingPrereqs
            });
        }
        
        // Render results
        validationContainer.innerHTML = '';
        
        if (issues.length === 0 && warnings.length === 0) {
            validationContainer.innerHTML = `
                <div class="validation-item validation-success">
                    <i class="fas fa-check-circle mr-2"></i>
                    <strong>All validations passed!</strong>
                    <p class="text-sm mt-1">No issues detected in quest flow structure.</p>
                </div>
            `;
        } else {
            issues.forEach(issue => {
                validationContainer.innerHTML += createValidationItem(issue);
            });
            warnings.forEach(warning => {
                validationContainer.innerHTML += createValidationItem(warning);
            });
        }
    } catch (error) {
        console.error("Validation error:", error);
        validationContainer.innerHTML = '<p class="text-red-500 text-sm">Error running validation</p>';
    }
}

function createValidationItem(item) {
    const className = item.type === 'error' ? 'validation-error' : 'validation-warning';
    let detailsHtml = '';
    
    if (item.quests && item.quests.length > 0) {
        detailsHtml = '<div class="mt-2 space-y-1 max-h-32 overflow-y-auto">';
        item.quests.slice(0, 10).forEach(quest => {
            detailsHtml += `
                <div class="text-xs opacity-90 hover:opacity-100 cursor-pointer px-2 py-1 bg-black/20 rounded" 
                     onclick="window.highlightQuest('${quest.id}')">
                    <i class="fas fa-arrow-right mr-1"></i> ${quest.quest_name}
                </div>
            `;
        });
        if (item.quests.length > 10) {
            detailsHtml += `<div class="text-xs opacity-75 px-2">... and ${item.quests.length - 10} more</div>`;
        }
        detailsHtml += '</div>';
    } else if (item.items && item.items.length > 0) {
        detailsHtml = '<div class="mt-2 space-y-1 max-h-32 overflow-y-auto">';
        item.items.slice(0, 10).forEach(({ quest, missingId }) => {
            detailsHtml += `
                <div class="text-xs opacity-90 hover:opacity-100 cursor-pointer px-2 py-1 bg-black/20 rounded" 
                     onclick="window.highlightQuest('${quest.id}')">
                    <i class="fas fa-arrow-right mr-1"></i> ${quest.quest_name}
                    <br><span class="font-mono text-[10px] ml-4">Missing: ${missingId.substring(0, 20)}...</span>
                </div>
            `;
        });
        if (item.items.length > 10) {
            detailsHtml += `<div class="text-xs opacity-75 px-2">... and ${item.items.length - 10} more</div>`;
        }
        detailsHtml += '</div>';
    }
    
    return `
        <div class="validation-item ${className}">
            <div class="flex items-start">
                <i class="fas ${item.icon} mr-2 mt-1"></i>
                <div class="flex-1">
                    <strong>${item.title}</strong>
                    <p class="text-sm mt-1">${item.message}</p>
                    ${detailsHtml}
                </div>
            </div>
        </div>
    `;
}

window.highlightQuest = function(questId) {
    if (!cy) return;
    
    try {
        const node = cy.getElementById(questId);
        if (node.length > 0) {
            clearHighlights();
            node.addClass('highlighted');
            
            cy.animate({
                center: { eles: node },
                zoom: 1.5,
                duration: 500
            });
            
            showDetails(node.data());
            
            setTimeout(() => {
                highlightPaths(node);
            }, 600);
        }
    } catch (error) {
        console.error("Error highlighting quest:", error);
    }
};

function findOrphanQuests() {
    const orphans = [];
    
    try {
        allQuests.forEach(quest => {
            // Skip entry-level categories
            if (quest.category === 'The First Steps: Beginner\'s Guide' || 
                quest.category === 'Uncategorized') {
                return;
            }
            
            // Check if quest has category prerequisite
            const hasCategory = quest.unlock_prerequisite_category && 
                               quest.unlock_prerequisite_category !== quest.category;
            
            // Check explicit prerequisites
            let prereqIds = [];
            try {
                prereqIds = Array.isArray(quest.prerequisite_quest_ids)
                    ? quest.prerequisite_quest_ids
                    : (quest.prerequisite_quest_ids ? JSON.parse(quest.prerequisite_quest_ids) : []);
            } catch (e) {
                prereqIds = [];
            }
            
            const hasExplicitPrereqs = prereqIds.length > 0;
            
            // Check if quest is a prerequisite for others
            const isDependency = allQuests.some(q => {
                let otherPrereqs = [];
                try {
                    otherPrereqs = Array.isArray(q.prerequisite_quest_ids)
                        ? q.prerequisite_quest_ids
                        : (q.prerequisite_quest_ids ? JSON.parse(q.prerequisite_quest_ids) : []);
                } catch (e) {
                    otherPrereqs = [];
                }
                return otherPrereqs.includes(quest.id);
            });
            
            if (!hasCategory && !hasExplicitPrereqs && !isDependency) {
                orphans.push(quest);
            }
        });
    } catch (error) {
        console.error("Error finding orphans:", error);
    }
    
    return orphans;
}

function calculateMetrics() {
    const metricsContainer = document.getElementById('metrics-container');
    if (!metricsContainer) return;
    
    try {
        const visibleQuests = allQuests;
        
        const totalQuests = visibleQuests.length;
        const totalCategories = new Set(visibleQuests.map(q => q.category).filter(Boolean)).size;
        
        // Count main path quests
        const mainPathQuests = visibleQuests.filter(q => q.category === "The First Steps: Beginner's Guide");
        
        // Count branch points (quests that have archetype quests depending on them)
        const branchPoints = mainPathQuests.filter(quest => {
            return visibleQuests.some(q => 
                q.unlock_prerequisite_category === "The First Steps: Beginner's Guide" &&
                q.category !== "The First Steps: Beginner's Guide"
            );
        });
        
        // Calculate actual max depth using proper algorithm
        let maxDepth = 0;
        if (cy && cy.nodes().length > 1) {
            // Use BFS to find actual longest path from root
            const depths = new Map();
            const queue = [];
            
            // Find root nodes (nodes with no incoming edges)
            cy.nodes().forEach(node => {
                if (!node.data('virtual') && node.indegree() === 0) {
                    depths.set(node.id(), 0);
                    queue.push(node);
                }
            });
            
            // BFS to calculate depths
            while (queue.length > 0) {
                const node = queue.shift();
                const currentDepth = depths.get(node.id());
                
                // Process only hard edges for true dependency depth
                const successors = node.outgoers('node').filter(n => {
                    const edge = node.edgesTo(n);
                    return edge.hasClass('hard');
                });
                
                successors.forEach(successor => {
                    if (!successor.data('virtual')) {
                        const newDepth = currentDepth + 1;
                        const existingDepth = depths.get(successor.id());
                        
                        if (existingDepth === undefined || newDepth > existingDepth) {
                            depths.set(successor.id(), newDepth);
                            maxDepth = Math.max(maxDepth, newDepth);
                            queue.push(successor);
                        }
                    }
                });
            }
        }
        
        metricsContainer.innerHTML = `
            <div class="metric-card">
                <div class="metric-label">Total Quests</div>
                <div class="metric-value">${totalQuests}</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Main Path Length</div>
                <div class="metric-value">${mainPathQuests.length}</div>
                <p class="text-xs text-gray-500 mt-1">Beginner's Guide quests</p>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Total Categories</div>
                <div class="metric-value">${totalCategories}</div>
                <p class="text-xs text-gray-500 mt-1">Including archetypes</p>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Max Chain Depth</div>
                <div class="metric-value">${maxDepth}</div>
                <p class="text-xs text-gray-500 mt-1">Longest dependency chain</p>
            </div>
        `;
    } catch (error) {
        console.error("Metrics error:", error);
        metricsContainer.innerHTML = '<p class="text-red-500 text-sm">Error calculating metrics</p>';
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    //console.log("Initializing Quest Flow Architect...");
    initDiagram();
});
