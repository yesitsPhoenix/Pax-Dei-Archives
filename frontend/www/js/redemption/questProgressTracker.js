import { questState } from './questStateManager.js';

// Inject slider styles once into the document
(function injectTrackerStyles() {
    if (document.getElementById('quest-tracker-styles')) return;
    const style = document.createElement('style');
    style.id = 'quest-tracker-styles';
    style.textContent = `
        /* Transparent track — fill is a separate div underneath */
        .tracker-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 20px;         /* tall hit area */
            background: transparent;
            cursor: pointer;
            outline: none;
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            margin: 0;
            padding: 0;
        }
        .tracker-slider:disabled { cursor: not-allowed; opacity: 0.6; }

        /* Webkit — make the track itself invisible */
        .tracker-slider::-webkit-slider-runnable-track {
            height: 8px;
            background: transparent;
            border-radius: 9999px;
        }
        /* Webkit thumb */
        .tracker-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background: #ffffff;
            border: 3px solid #FFD700;
            box-shadow: 0 0 0 2px #FFD70055, 0 2px 6px rgba(0,0,0,0.6);
            cursor: grab;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
            margin-top: -6px;      /* vertically centre on 8px track */
        }
        .tracker-slider:not(:disabled)::-webkit-slider-thumb:hover {
            box-shadow: 0 0 0 5px #FFD70044, 0 2px 8px rgba(0,0,0,0.7);
            transform: scale(1.15);
        }
        .tracker-slider:not(:disabled):active::-webkit-slider-thumb {
            cursor: grabbing;
            transform: scale(1.25);
            box-shadow: 0 0 0 7px #FFD70033, 0 2px 10px rgba(0,0,0,0.7);
        }
        .tracker-slider.tracker-slider--done::-webkit-slider-thumb {
            border-color: #22c55e;
            box-shadow: 0 0 0 2px #22c55e55, 0 2px 6px rgba(0,0,0,0.6);
        }

        /* Firefox — invisible track */
        .tracker-slider::-moz-range-track {
            height: 8px;
            background: transparent;
            border-radius: 9999px;
        }
        /* Firefox thumb */
        .tracker-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background: #ffffff;
            border: 3px solid #FFD700;
            box-shadow: 0 0 0 2px #FFD70055, 0 2px 6px rgba(0,0,0,0.6);
            cursor: grab;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .tracker-slider.tracker-slider--done::-moz-range-thumb {
            border-color: #22c55e;
        }

        /* Suppress Firefox's own fill overlay */
        .tracker-slider::-moz-range-progress { background: transparent; }
    `;
    document.head.appendChild(style);
})();

/**
 * Renders an interactive goal progress tracker into the given container.
 *
 * @param {object} quest          - The quest object (needs .id, .tracking_goals, .goals_gate_completion)
 * @param {HTMLElement} container - DOM element to render into. Cleared if no goals.
 * @param {object} [options]
 * @param {function} [options.onGoalsComplete] - Called with (allComplete: boolean) on every change and on initial render.
 */
export function renderQuestTracker(quest, container, options = {}) {
    if (!container) return;

    const goals = quest.tracking_goals;

    if (!goals || !Array.isArray(goals) || goals.length === 0) {
        container.innerHTML = '';
        return;
    }

    const questId = quest.id;
    const gated   = quest.goals_gate_completion === true;
    const { onGoalsComplete } = options;

    // Load initial values from state-manager cache
    const rows = questState.getProgressForQuest(questId);
    const localValues = goals.map((_, i) => {
        const row = rows.find(r => r.goal_index === i);
        return row ? Number(row.value) : 0;
    });

    // Per-goal debounce timers — only used for slider drags
    const debounceTimers = {};

    function saveImmediate(goalIndex, value) {
        questState.saveGoalProgress(questId, goalIndex, value);
    }
    function saveDebounced(goalIndex, value) {
        clearTimeout(debounceTimers[goalIndex]);
        debounceTimers[goalIndex] = setTimeout(() => {
            questState.saveGoalProgress(questId, goalIndex, value);
        }, 400);
    }

    function checkAllComplete() {
        return goals.every((goal, i) => {
            if (goal.type === 'counter')  return localValues[i] >= (goal.target || 1);
            if (goal.type === 'checkbox') return localValues[i] >= 1;
            return true;
        });
    }

    function buildGoalHTML(goal, i) {
        const v = localValues[i];

        if (goal.type === 'counter') {
            const target = goal.target || 1;
            const cur    = Math.min(v, target);
            const pct    = target > 0 ? (cur / target) * 100 : 0;
            const done   = cur >= target;

            const borderColor = done ? 'border-green-500/30' : 'border-gray-700/50';
            const labelColor  = done ? 'text-green-400'       : 'text-gray-400';
            const numColor    = done ? 'text-green-400'       : 'text-[#FFD700]';
            const fillColor   = done ? 'bg-green-500'         : 'bg-[#FFD700]';
            const doneClass   = done ? 'tracker-slider--done' : '';

            return `
                <div class="bg-black/20 border ${borderColor} rounded-lg p-2.5 mb-2">
                    <!-- Label + count -->
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] uppercase tracking-widest font-bold ${labelColor}">
                            ${goal.label}${goal.unit ? ' (' + goal.unit + ')' : ''}
                        </span>
                        <span class="tracker-count text-sm font-bold ${numColor}">${cur} / ${target}</span>
                    </div>

                    <!--
                        Slider track wrapper
                        - bg-gray-700 = unfilled rail
                        - fill div    = coloured portion (width driven by JS)
                        - range input = sits on top, transparent track, only thumb shows
                    -->
                    <div class="relative w-full rounded-full bg-gray-700 mb-3" style="height:8px;">
                        <div class="tracker-fill ${fillColor} h-full rounded-full transition-none pointer-events-none" style="width:${pct}%;"></div>
                        <input
                            type="range"
                            min="0" max="${target}" value="${cur}" step="1"
                            data-tracker-action="slider" data-tracker-goal="${i}"
                            ${done ? 'disabled' : ''}
                            class="tracker-slider ${doneClass}"
                            title="Drag to set progress"
                        >
                    </div>

                    <!-- −  /  +  /  ✓ buttons -->
                    <div class="flex gap-1.5">
                        <button data-tracker-action="minus" data-tracker-goal="${i}"
                                class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-1 rounded transition-colors"
                                ${cur <= 0 ? 'disabled' : ''} title="Decrease by 1">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <button data-tracker-action="plus" data-tracker-goal="${i}"
                                class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-1 rounded transition-colors"
                                ${done ? 'disabled' : ''} title="Increase by 1">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                        <button data-tracker-action="max" data-tracker-goal="${i}"
                                class="flex-1 bg-[#FFD700]/80 hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold py-1 rounded transition-colors"
                                ${done ? 'disabled' : ''} title="Mark complete">
                            <i class="fa-solid fa-check text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        if (goal.type === 'checkbox') {
            const checked     = v >= 1;
            const borderColor = checked ? 'border-green-500/30' : 'border-gray-700/50';
            const textColor   = checked ? 'text-green-400 line-through' : 'text-gray-300';
            return `
                <div class="flex items-center gap-3 p-2 mb-1 bg-black/20 border ${borderColor} rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input type="checkbox" data-tracker-action="checkbox" data-tracker-goal="${i}"
                           ${checked ? 'checked' : ''}
                           class="w-4 h-4 accent-[#FFD700] cursor-pointer shrink-0">
                    <span class="text-sm ${textColor} select-none">${goal.label}</span>
                </div>
            `;
        }

        return '';
    }

    function attachListeners() {
        container.querySelectorAll('[data-tracker-action]').forEach(el => {
            const action = el.dataset.trackerAction;
            const idx    = parseInt(el.dataset.trackerGoal, 10);
            const goal   = goals[idx];
            const target = goal.target || 1;

            if (action === 'slider') {
                el.addEventListener('input', () => {
                    const newVal = parseInt(el.value, 10);
                    localValues[idx] = newVal;
                    const pct  = target > 0 ? (newVal / target) * 100 : 0;
                    const done = newVal >= target;

                    // Update fill bar width in place — no re-render needed
                    const fill = el.closest('.relative')?.querySelector('.tracker-fill');
                    if (fill) fill.style.width = `${pct}%`;

                    // Update n / target label
                    const lbl = el.closest('.bg-black\\/20')?.querySelector('.tracker-count');
                    if (lbl) lbl.textContent = `${newVal} / ${target}`;

                    // Swap fill colour live
                    if (fill) {
                        fill.classList.toggle('bg-green-500', done);
                        fill.classList.toggle('bg-[#FFD700]', !done);
                    }

                    saveDebounced(idx, newVal);
                });

                // Full re-render on release so buttons and borders update
                el.addEventListener('change', () => renderToContainer());
                return;
            }

            if (action === 'checkbox') {
                el.addEventListener('change', () => {
                    localValues[idx] = el.checked ? 1 : 0;
                    saveImmediate(idx, localValues[idx]);
                    renderToContainer();
                });
                el.closest('div')?.addEventListener('click', (e) => {
                    if (e.target !== el) {
                        el.checked = !el.checked;
                        el.dispatchEvent(new Event('change'));
                    }
                });
                return;
            }

            // minus / plus / max — discrete clicks, write immediately
            el.addEventListener('click', () => {
                let newVal = localValues[idx];
                if (action === 'minus') newVal = Math.max(0, newVal - 1);
                else if (action === 'plus') newVal = Math.min(target, newVal + 1);
                else if (action === 'max')  newVal = target;

                localValues[idx] = newVal;
                saveImmediate(idx, newVal);
                renderToContainer();
            });
        });
    }

    function renderToContainer() {
        const allComplete = checkAllComplete();
        const borderClass = allComplete ? 'border-green-500/30' : 'border-gray-700';

        container.innerHTML = `
            <div class="bg-black/40 border ${borderClass} rounded-xl p-3 mt-1">
                <h5 class="text-[11px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-list-check"></i>
                    Quest Progress Tracker
                    ${gated ? '<span class="text-[#FFD700] ml-auto text-[10px]">Required to complete</span>' : ''}
                </h5>
                ${goals.map((goal, i) => buildGoalHTML(goal, i)).join('')}
            </div>
        `;

        attachListeners();

        if (onGoalsComplete) onGoalsComplete(allComplete);
    }

    renderToContainer();
}
