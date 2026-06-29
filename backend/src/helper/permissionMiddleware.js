// src/helper/permissionMiddleware.js
import { queryAdminDB } from '../config/adminClickhouse.js';
import { getAdminPlatforms, toFlatPermissions } from '../services/adminService.js';

// In-memory cache for tab permissions per user (TTL: 60 seconds)
const permissionsCache = new Map();
const PERM_CACHE_TTL = 60 * 1000;

export function clearPermissionsCache(email) {
    if (email) {
        permissionsCache.delete(email);
        permissionsCache.delete(email.toLowerCase().trim());
    }
    permissionsCache.clear();
    console.log("🧹 [Cache Clear] Cleared permissionsCache completely");
}

/**
 * Fetch fresh tabPermissions from admin_master.tb_user for a given email.
 * Uses a short-lived in-memory cache to avoid hitting DB on every request.
 */
async function getFreshTabPermissions(email) {
    const cached = permissionsCache.get(email);
    if (cached && (Date.now() - cached.timestamp) < PERM_CACHE_TTL) {
        return cached.data;
    }

    try {
        const rows = await queryAdminDB(
            `SELECT
                ifNull(argMaxIf(tab_permissions, last_login, tab_permissions != ''), '') as tab_permissions
             FROM tb_user
             WHERE user_email = '${email.replace(/'/g, "\\'")}'
             GROUP BY user_email`
        );
        if (rows.length === 0) {
            return null; // Not found in DB, fallback to JWT permissions
        }
        let tabPerms = {};
        if (rows[0].tab_permissions && rows[0].tab_permissions.trim()) {
            try {
                tabPerms = toFlatPermissions(JSON.parse(rows[0].tab_permissions));
            } catch (e) { /* ignore parse errors */ }
        }
        permissionsCache.set(email, { data: tabPerms, timestamp: Date.now() });
        return tabPerms;
    } catch (err) {
        console.warn('[PermissionMiddleware] Failed to fetch fresh tab permissions:', err.message);
        // Fall back to JWT-embedded permissions
        return null;
    }
}

export function filterPlatformsResponse(user, data) {
    if (!user) return data;

    const tabPerms = user.tabPermissions || {};
    const disabledPlatforms = [];
    const enabledPlatforms = [];
    Object.keys(tabPerms).forEach(key => {
        if (key.startsWith('platform_')) {
            const platName = key.replace('platform_', '').toLowerCase();
            if (tabPerms[key] === false) {
                disabledPlatforms.push(platName);
            } else {
                enabledPlatforms.push(platName);
            }
        }
    });

    if (disabledPlatforms.length === 0) return data;

    // When not all platforms are enabled, "All" aggregate rows must be hidden
    const hasRestrictedPlatforms = disabledPlatforms.length > 0;
    const ALL_IDENTIFIERS = ['all', 'overall', 'odd_overall'];

    const filterItem = (item) => {
        if (!item) return item;

        // 1. Array handling
        if (Array.isArray(item)) {
            // Check if it's an array of strings
            if (item.length > 0 && typeof item[0] === 'string') {
                return item.filter(p => !disabledPlatforms.includes(p.toLowerCase()));
            }
            // Check if it's an array of objects
            if (item.length > 0 && typeof item[0] === 'object') {
                // First filter out objects that represent a disabled platform OR the "All" aggregate row
                const filteredList = item.filter(subItem => {
                    if (subItem && typeof subItem === 'object') {
                        const name = subItem.pf_name || subItem.platform || subItem.Platform || subItem.platform_name || subItem.name || subItem.key || subItem.label;
                        if (name && typeof name === 'string') {
                            const nameLower = name.toLowerCase();
                            // Remove disabled platforms
                            if (disabledPlatforms.includes(nameLower)) return false;
                            // Remove "All" aggregate row when some platforms are restricted
                            if (hasRestrictedPlatforms && ALL_IDENTIFIERS.includes(nameLower)) return false;
                        }
                    }
                    return true;
                });
                // Then recursively filter inside the remaining objects
                return filteredList.map(subItem => filterItem(subItem));
            }
            // Fallback for other array types
            return item.map(subItem => filterItem(subItem));
        }

        // 2. Object handling
        if (typeof item === 'object') {
            const result = { ...item };

            Object.keys(result).forEach(key => {
                if (disabledPlatforms.includes(key.toLowerCase())) {
                    delete result[key];
                } else {
                    // Recursively filter the values of other keys
                    const originalVal = result[key];
                    const filteredVal = filterItem(originalVal);
                    if (originalVal !== filteredVal) {
                        result[key] = filteredVal;
                    }
                }
            });
            return result;
        }

        // 3. Primitive value handling
        return item;
    };

    return filterItem(data);
}

/**
 * Express middleware to enforce platform-level access permissions.
 * Fetches the latest tabPermissions from the database (with caching)
 * so admin changes take effect without requiring user re-login.
 */
export const platformPermissionMiddleware = async (req, res, next) => {
    if (!req.user) return next();

    // Bypass admin management endpoints so they always see all database platforms
    if (req.originalUrl && (req.originalUrl.startsWith('/api/admin') || req.originalUrl.startsWith('/admin'))) {
        return next();
    }

    // Fetch fresh permissions from DB (cached for 60 seconds)
    const freshPerms = await getFreshTabPermissions(req.user.email);
    if (freshPerms !== null) {
        req.user.tabPermissions = freshPerms;
    }

    const tabPerms = req.user.tabPermissions || {};
    const disabledPlatforms = [];
    Object.keys(tabPerms).forEach(key => {
        if (key.startsWith('platform_') && tabPerms[key] === false) {
            disabledPlatforms.push(key.replace('platform_', '').toLowerCase());
        }
    });

    if (disabledPlatforms.length > 0) {
        // Fetch all platforms for the user's database name
        const allDbPlatforms = await getAdminPlatforms(req.user.dbName);

        // Helper to filter a platform parameter
        const filterAllowedPlatforms = (requestedPlatform) => {
            let reqPlats = [];
            if (!requestedPlatform || requestedPlatform === 'All' || requestedPlatform === '' || requestedPlatform === 'all' || requestedPlatform === 'All platforms') {
                // If "All" or empty is requested, return the list of allowed platforms from their DB
                reqPlats = allDbPlatforms;
            } else {
                reqPlats = (Array.isArray(requestedPlatform) ? requestedPlatform : String(requestedPlatform).split(','))
                    .map(p => p.trim());
            }

            const allowed = reqPlats.filter(p => !disabledPlatforms.includes(p.toLowerCase()));
            if (allowed.length === 0) return "none";
            return allowed.join(',');
        };

        // Intercept query/body filter parameters
        const keysToFilter = ['platform', 'platforms', 'platform[]', 'platforms[]', 'localPlatform'];
        let hasPlatKey = false;
        keysToFilter.forEach(key => {
            if (req.query && req.query[key] !== undefined) {
                req.query[key] = filterAllowedPlatforms(req.query[key]);
                hasPlatKey = true;
            }
            if (req.body && req.body[key] !== undefined) {
                req.body[key] = filterAllowedPlatforms(req.body[key]);
                hasPlatKey = true;
            }
        });

        // If no platform parameter was specified, force-inject the allowed platforms
        // so that ClickHouse queries are correctly scoped and exclude disabled platforms.
        if (!hasPlatKey) {
            if (req.query) {
                req.query.platform = filterAllowedPlatforms('All');
            } else if (req.body) {
                req.body.platform = filterAllowedPlatforms('All');
            }
        }
    }

    // Intercept res.json to filter returned list of platforms
    const originalJson = res.json;
    res.json = function (data) {
        if (data && data.success !== false) {
            if (data.data) {
                data.data = filterPlatformsResponse(req.user, data.data);
            } else {
                data = filterPlatformsResponse(req.user, data);
            }
        }
        return originalJson.call(this, data);
    };

    next();
};
