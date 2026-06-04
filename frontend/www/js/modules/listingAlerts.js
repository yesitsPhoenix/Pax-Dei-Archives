import { supabase } from '../supabaseClient.js';
import { currentCharacterId, getCurrentCharacter } from './characters.js';
import {
    getZoneListingsForItemByQuality,
    loadZoneDataForCharacter,
} from '../services/gamingToolsService.js';

export const LISTING_ALERT_BANDS = {
    aging: {
        minDays: 30,
        label: 'Aging',
        severity: 1,
        icon: 'fa-hourglass-half',
        badgeClass: 'bg-emerald-900/40 border-emerald-500/40 text-emerald-200',
        rowClass: 'border-emerald-500/30 bg-emerald-900/10',
        textClass: 'text-emerald-300',
    },
    warning: {
        minDays: 60,
        label: 'Warning',
        severity: 2,
        icon: 'fa-clock',
        badgeClass: 'bg-amber-900/40 border-amber-500/40 text-amber-200',
        rowClass: 'border-amber-500/30 bg-amber-900/10',
        textClass: 'text-amber-300',
    },
    critical: {
        minDays: 90,
        label: 'Critical',
        severity: 3,
        icon: 'fa-triangle-exclamation',
        badgeClass: 'bg-rose-900/40 border-rose-500/40 text-rose-200',
        rowClass: 'border-rose-500/30 bg-rose-900/10',
        textClass: 'text-rose-300',
    },
};

const DEFAULT_MIN_DAYS = LISTING_ALERT_BANDS.aging.minDays;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeEnchantmentTier(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(3, numeric)) : 0;
}

function getQualityLabel(isMastercrafted, enchantmentTier) {
    const parts = [];
    if (isMastercrafted) parts.push('Mastercrafted');
    if (enchantmentTier > 0) parts.push(`+${enchantmentTier}`);
    return parts.join(' ') || '';
}

function classifyListingAge(daysOld) {
    if (daysOld >= LISTING_ALERT_BANDS.critical.minDays) return LISTING_ALERT_BANDS.critical;
    if (daysOld >= LISTING_ALERT_BANDS.warning.minDays) return LISTING_ALERT_BANDS.warning;
    if (daysOld >= LISTING_ALERT_BANDS.aging.minDays) return LISTING_ALERT_BANDS.aging;
    return null;
}

function getBandKey(band) {
    if (band === LISTING_ALERT_BANDS.critical) return 'critical';
    if (band === LISTING_ALERT_BANDS.warning) return 'warning';
    if (band === LISTING_ALERT_BANDS.aging) return 'aging';
    return '';
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatGold(value) {
    const numeric = Number(value || 0);
    return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}g`;
}

function summarizeMarketListings(listings = []) {
    if (!listings.length) {
        return {
            totalListings: 0,
            marketLow: null,
            examples: [],
        };
    }

    const normalized = listings
        .map((listing) => {
            const quantity = Math.max(Number(listing.quantity) || 1, 1);
            const totalPrice = Number(listing.price) || 0;
            return {
                quantity,
                totalPrice,
                unitPrice: totalPrice / quantity,
            };
        })
        .sort((a, b) => a.unitPrice - b.unitPrice || a.totalPrice - b.totalPrice);

    return {
        totalListings: normalized.length,
        marketLow: normalized[0]?.unitPrice ?? null,
        examples: normalized.slice(0, 4),
    };
}

function getMarketPosition(alert) {
    const marketLow = alert.marketSummary.marketLow;
    if (marketLow === null) {
        return {
            label: 'No active listings',
            icon: 'fa-circle-question',
            className: 'bg-slate-700/50 border-slate-500/50 text-gray-200',
            note: 'You may be the only active listing in this home valley.',
        };
    }

    const tolerance = Math.max(0.01, marketLow * 0.01);
    const gap = alert.unitPrice - marketLow;
    if (gap < -tolerance) {
        return {
            label: 'Below Market',
            icon: 'fa-arrow-trend-down',
            className: 'bg-blue-900/40 border-blue-500/40 text-blue-200',
            note: `${formatGold(Math.abs(gap))}/ea below the current low.`,
        };
    }
    if (gap > tolerance) {
        return {
            label: 'Above Market',
            icon: 'fa-arrow-trend-up',
            className: 'bg-rose-900/40 border-rose-500/40 text-rose-200',
            note: `${formatGold(gap)}/ea above the current low.`,
        };
    }
    return {
        label: 'Competitive',
        icon: 'fa-handshake',
        className: 'bg-emerald-900/40 border-emerald-500/40 text-emerald-100',
        note: 'Matches the current low.',
    };
}

async function getStallNameMap(stallIds = []) {
    const uniqueIds = [...new Set(stallIds.filter(Boolean))];
    if (!uniqueIds.length) return new Map();

    const { data, error } = await supabase
        .from('market_stalls')
        .select('id, stall_name')
        .in('id', uniqueIds);

    if (error) {
        console.warn('[ListingAlerts] Unable to fetch stall names:', error);
        return new Map();
    }

    return new Map((data || []).map((stall) => [stall.id, stall.stall_name]));
}

export async function getListingAlertCount(minDays = DEFAULT_MIN_DAYS) {
    if (!currentCharacterId) return 0;

    const cutoff = new Date(Date.now() - minDays * MS_PER_DAY).toISOString();
    const { count, error } = await supabase
        .from('market_listings')
        .select('listing_id', { count: 'exact', head: true })
        .eq('character_id', currentCharacterId)
        .is('is_fully_sold', false)
        .is('is_cancelled', false)
        .lt('listing_date', cutoff);

    if (error) throw error;
    return count || 0;
}

export async function buildListingAlerts({ minDays = DEFAULT_MIN_DAYS } = {}) {
    if (!currentCharacterId) {
        return {
            character: null,
            alerts: [],
            summary: { total: 0, aging: 0, warning: 0, critical: 0 },
        };
    }

    const character = await getCurrentCharacter();
    if (character?.shard && character?.province && character?.home_valley) {
        await loadZoneDataForCharacter(character);
    }

    const { data, error } = await supabase
        .from('market_listings')
        .select('listing_id, item_id, listing_date, listed_price_per_unit, total_listed_price, quantity_listed, is_mastercrafted, enchantment_tier, market_stall_id, items(item_name, pax_dei_slug)')
        .eq('character_id', currentCharacterId)
        .is('is_fully_sold', false)
        .is('is_cancelled', false)
        .order('listing_date', { ascending: true });

    if (error) throw error;

    const stallNameMap = await getStallNameMap((data || []).map((listing) => listing.market_stall_id));
    const now = Date.now();
    const summary = { total: 0, aging: 0, warning: 0, critical: 0 };

    const alerts = (data || [])
        .map((listing) => {
            const listedAt = new Date(listing.listing_date);
            const listedAtMs = listedAt.getTime();
            const daysOld = Number.isNaN(listedAtMs)
                ? 0
                : Math.floor((now - listedAtMs) / MS_PER_DAY);
            const band = classifyListingAge(daysOld);
            if (!band || daysOld < minDays) return null;

            const itemName = listing.items?.item_name || `Item #${listing.item_id}`;
            const isMastercrafted = listing.is_mastercrafted === true;
            const enchantmentTier = normalizeEnchantmentTier(listing.enchantment_tier);
            const marketListings = getZoneListingsForItemByQuality(
                listing.items?.pax_dei_slug || null,
                itemName,
                isMastercrafted,
                enchantmentTier
            );
            const marketSummary = summarizeMarketListings(marketListings);

            return {
                listingId: listing.listing_id,
                itemId: listing.item_id,
                itemName,
                qualityLabel: getQualityLabel(isMastercrafted, enchantmentTier),
                listedAt,
                listingDate: listing.listing_date,
                daysOld,
                band,
                quantity: Math.max(Number(listing.quantity_listed) || 1, 1),
                totalPrice: Number(listing.total_listed_price) || 0,
                unitPrice: Number(listing.listed_price_per_unit) || 0,
                stallId: listing.market_stall_id || null,
                stallName: stallNameMap.get(listing.market_stall_id) || 'Unknown Stall',
                marketSummary,
            };
        })
        .filter(Boolean);

    alerts.forEach((alert) => {
        summary.total += 1;
        const key = getBandKey(alert.band);
        summary[key] += 1;
    });

    alerts.sort((a, b) => (
        b.band.severity - a.band.severity ||
        b.daysOld - a.daysOld ||
        a.itemName.localeCompare(b.itemName)
    ));

    return { character, alerts, summary, minDays };
}

export function renderListingAlertsModalHtml(result, filters = {}) {
    const { character, alerts, summary, minDays } = result;
    const location = [
        character?.shard,
        character?.province,
        character?.home_valley,
    ].filter(Boolean).join(' / ') || 'Home valley unavailable';

    const stallOptions = [...new Map(alerts.map((alert) => [alert.stallName, alert])).keys()].sort();
    const filteredAlerts = alerts.filter((alert) => {
        if (filters.band && getBandKey(alert.band) !== filters.band) return false;
        if (filters.stallName && alert.stallName !== filters.stallName) return false;
        return true;
    });
    const hasActiveFilter = Boolean(filters.band || filters.stallName);

    const chip = (label, count, className, icon, attributes = '') => `
        <button type="button" ${attributes} class="inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-sm transition-colors hover:border-amber-300/70 hover:bg-slate-700/70 ${className}">
            <i class="fas ${icon} text-xs"></i>
            <span class="text-white">${label}</span>
            <span class="font-bold">${count}</span>
        </button>
    `;

    const rows = filteredAlerts.map((alert) => {
        const position = getMarketPosition(alert);
        const marketLow = alert.marketSummary.marketLow === null
            ? 'No active listings'
            : `${formatGold(alert.marketSummary.marketLow)}/ea`;

        return `
            <tr class="border-b border-slate-700/60 hover:bg-slate-700/30 ${alert.band.rowClass}">
                <td class="py-3 px-3 align-top">
                    <div class="flex items-start gap-2">
                        <i class="fas ${alert.band.icon} ${alert.band.textClass} mt-1"></i>
                        <div>
                            <div class="text-white text-sm font-semibold">${escapeHtml(alert.itemName)}</div>
                            ${alert.qualityLabel ? `<div class="text-xs text-amber-200">${escapeHtml(alert.qualityLabel)}</div>` : ''}
                            ${stallOptions.length > 1 ? `<div class="text-xs text-gray-400">${escapeHtml(alert.stallName)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3 align-top text-right">
                    <div class="${alert.band.textClass} text-sm font-bold">${alert.daysOld} days</div>
                    <div class="text-gray-500 text-xs">${alert.band.label}</div>
                </td>
                <td class="py-3 px-3 align-top text-right">
                    <div class="text-white text-sm font-semibold">${alert.quantity.toLocaleString()} @ ${formatGold(alert.totalPrice)}</div>
                    <div class="text-gray-400 text-xs">${formatGold(alert.unitPrice)}/ea</div>
                </td>
                <td class="py-3 px-3 align-top">
                    <div class="flex flex-col gap-1.5">
                        <span class="inline-flex w-fit items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold ${position.className}">
                            <i class="fas ${position.icon} text-xs"></i>
                            ${position.label}
                        </span>
                        <div class="text-gray-300 text-xs">
                            Market low: <span class="text-white font-semibold">${marketLow}</span>
                            <span class="text-gray-500">(${alert.marketSummary.totalListings} active)</span>
                        </div>
                        <div class="text-gray-500 text-xs">${position.note}</div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const stallFilterHtml = stallOptions.length > 1 ? `
        <div class="flex flex-wrap gap-2 mb-4">
            ${stallOptions.map((stallName) => {
                const count = alerts.filter((alert) => alert.stallName === stallName).length;
                const active = filters.stallName === stallName
                    ? 'bg-blue-700/60 border-blue-300/80 text-white'
                    : 'bg-blue-900/40 border-blue-500/40 text-blue-100';
                return `
                    <button type="button" data-alert-stall-filter="${escapeHtml(stallName)}" class="inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-sm transition-colors hover:border-blue-300/80 ${active}">
                        <i class="fas fa-store text-xs"></i>
                        <span>${escapeHtml(stallName)}</span>
                        <span class="font-bold">${count}</span>
                    </button>
                `;
            }).join('')}
        </div>
    ` : '';

    return `
        <div class="flex flex-wrap gap-2 mb-4">
            ${chip(`${minDays}+ day listings`, summary.total, `bg-slate-700/40 border-slate-500/40 text-slate-200 ${!filters.band ? 'ring-1 ring-slate-300/40' : ''}`, 'fa-list', 'data-alert-band-filter=""')}
            ${chip('Aging 30+', summary.aging, `${LISTING_ALERT_BANDS.aging.badgeClass} ${filters.band === 'aging' ? 'ring-1 ring-emerald-200/70' : ''}`, LISTING_ALERT_BANDS.aging.icon, 'data-alert-band-filter="aging"')}
            ${chip('Warning 60+', summary.warning, `${LISTING_ALERT_BANDS.warning.badgeClass} ${filters.band === 'warning' ? 'ring-1 ring-amber-200/70' : ''}`, LISTING_ALERT_BANDS.warning.icon, 'data-alert-band-filter="warning"')}
            ${chip('Critical 90+', summary.critical, `${LISTING_ALERT_BANDS.critical.badgeClass} ${filters.band === 'critical' ? 'ring-1 ring-rose-200/70' : ''}`, LISTING_ALERT_BANDS.critical.icon, 'data-alert-band-filter="critical"')}
            <span class="inline-flex items-center gap-1.5 bg-blue-900/40 border border-blue-500/40 rounded-full px-3 py-1 text-sm text-blue-100">
                <i class="fas fa-map-location-dot text-xs"></i>
                <span>${escapeHtml(location)}</span>
            </span>
            ${hasActiveFilter ? `
                <button type="button" data-alert-clear-filters class="inline-flex items-center gap-1.5 bg-slate-700/50 hover:bg-slate-600/70 border border-slate-500/50 rounded-full px-3 py-1 text-sm text-gray-200 transition-colors">
                    <i class="fas fa-filter-circle-xmark text-xs"></i>
                    <span>Clear filter</span>
                </button>
            ` : ''}
        </div>

        ${stallFilterHtml}

        ${filteredAlerts.length ? `
            <h4 class="flex items-center gap-2 text-amber-300 text-sm font-bold uppercase tracking-wide mb-3">
                <i class="fas fa-bell text-amber-400"></i> Listing Age Alerts
            </h4>
            <div class="overflow-x-auto rounded-lg border border-slate-700/60">
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-slate-600 bg-slate-900/60">
                            <th class="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Listing</th>
                            <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Age</th>
                            <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Amount</th>
                            <th class="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Market Position</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        ` : `
            <div class="text-center py-12">
                <i class="fas fa-check-circle text-green-400 text-5xl mb-4"></i>
                <p class="text-gray-300 text-lg font-semibold mb-2">No matching listings found.</p>
                <p class="text-gray-400 text-md">Adjust or clear the active filters to see more listings.</p>
            </div>
        `}
    `;
}
