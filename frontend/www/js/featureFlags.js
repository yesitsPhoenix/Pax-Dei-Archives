/**
 * Feature Flags System
 * 
 * Controls gradual rollout of state manager across pages.
 * Can be enabled/disabled via URL parameters for testing.
 * 
 * Usage:
 *   - Page-specific: ?features=listings.useStateManager,listings.enabled
 *   - Global: ?features=useStateManager
 * 
 * @version 1.0.1
 */

export const features = {
  // Global kill switch
  useStateManager: true,
  
  // Per-page flags
  pages: {
    listings: {
      useStateManager: true,
      enabled: true
    },
    dashboard: {
      useStateManager: true,
      enabled: true
    },
    trends: {
      useStateManager: true,
      enabled: true
    },
    profile: {
      useStateManager: true,
      enabled: true
    },
    ledger: {
      useStateManager: false,
      enabled: false
    }
  }
};

/**
 * Initialize feature flags from URL parameters
 * Call this on page load
 */
export function initFeatureFlags() {
  const params = new URLSearchParams(window.location.search);
  const flagsParam = params.get('features');
  
  if (!flagsParam) {
    //console.log('[FeatureFlags] No flags set, using defaults');
    return;
  }
  
  flagsParam.split(',').forEach(flag => {
    const parts = flag.trim().split('.');
    
    if (parts.length === 1) {
      // Global flag: ?features=useStateManager
      if (parts[0] === 'useStateManager') {
        features.useStateManager = true;
        //console.log('[FeatureFlags] Global useStateManager enabled');
      }
    } else if (parts.length === 2) {
      // Page-specific flag: ?features=listings.useStateManager
      const [pageName, flagName] = parts;
      if (features.pages[pageName]) {
        features.pages[pageName][flagName] = true;
        //console.log(`[FeatureFlags] Set ${pageName}.${flagName} = true`);
      }
    }
  });
  
  //console.log('[FeatureFlags] Initialized:', features);
}

/**
 * Check if a page should use state manager
 * @param {string} pageName - Name of the page (listings, dashboard, etc.)
 * @returns {boolean}
 */
export function shouldUseStateManager(pageName) {
  // Page must have both useStateManager AND enabled set to true
  const pageFlags = features.pages[pageName];
  
  if (!pageFlags) {
    return false;
  }
  
  const shouldUse = pageFlags.useStateManager && pageFlags.enabled;
  
  // //console.log(`[FeatureFlags] shouldUseStateManager('${pageName}'):`, {
  //   useStateManager: pageFlags.useStateManager,
  //   enabled: pageFlags.enabled,
  //   result: shouldUse
  // });
  
  return shouldUse;
}

/**
 * Enable state manager for a page programmatically
 * @param {string} pageName - Name of the page
 */
export function enableStateManager(pageName) {
  if (features.pages[pageName]) {
    features.pages[pageName].useStateManager = true;
    features.pages[pageName].enabled = true;
    //console.log(`[FeatureFlags] Enabled state manager for ${pageName}`);
  }
}

/**
 * Disable state manager for a page programmatically
 * @param {string} pageName - Name of the page
 */
export function disableStateManager(pageName) {
  if (features.pages[pageName]) {
    features.pages[pageName].useStateManager = false;
    features.pages[pageName].enabled = false;
    //console.log(`[FeatureFlags] Disabled state manager for ${pageName}`);
  }
}
