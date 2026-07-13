// migrate_tab_permissions_structure.js
import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const ADMIN_DB = process.env.ADMIN_DB || 'admin_master';
const CH_URL = process.env.CLICKHOUSE_URL || 'http://13.203.251.97:8123';
const CH_USER = process.env.CLICKHOUSE_USER || 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || '';

const client = createClient({
    url: CH_URL,
    username: CH_USER,
    password: CH_PASS,
    database: ADMIN_DB,
    request_timeout: 60000,
});

async function queryAdmin(query) {
    const result = await client.query({ query, format: 'JSONEachRow' });
    return await result.json();
}

const defaultKpisMap = {
    "Business Overview": {
        "offtake": true,
        "availability": true,
        "share_of_search": true,
        "market_share": true,
        "promo": true,
        "inorganic_sales": true,
        "conversion": true,
        "roas": true,
        "orders": true,
        "spend": true,
        "category_size": true,
        "sponsored_sos": true,
        "organic_sos": true,
        "cpm": true,
        "cpc": true,
        "impressions": true,
        "clicks": true,
        "ctr": true
    },
    "India Overview": {
        "wt_osa": true,
        "listing_pct": true,
        "market_share": true,
        "sales": true,
        "orders": true
    },
    "Availability Analysis": {
        "stock_availability": true,
        "doi": true,
        "metro_city_stock_availability": true,
        "psl": true,
        "soh": true,
        "wt_osa_pct": true,
        "offtake_share": true
    },
    "Market Coverage": {
        "stock_availability": true,
        "metro_city_stock_availability": true,
        "osa": true,
        "market_share": true,
        "overall_share_of_visibility": true,
        "paid_share_of_visibility": true
    },
    "Visibility Analysis": {
        "overall_sos": true,
        "sponsored_sos": true,
        "organic_sos": true
    },
    "Market Share": {
        "category_size": true,
        "market_leader_sales": true,
        "brand_estimated_sales": true,
        "market_share": true,
        "overall_share_of_visibility": true,
        "paid_share_of_visibility": true
    },
    "Sales Data": {
        "sales_revenue": true,
        "orders_count": true,
        "average_order_value": true
    },
    "Pricing Analysis": {
        "discount_pct": true,
        "weighted_discount": true,
        "average_selling_price": true,
        "price_drop_my_skus": true,
        "price_increase_my_skus": true,
        "price_drop_comp_skus": true,
        "price_increase_comp_skus": true,
        "price_unit_1g_1piece": true
    },
    "Performance Marketing": {
        "impressions": true,
        "conversion": true,
        "spend": true,
        "roas": true,
        "cpm": true,
        "sales": true
    },
    "Portfolio Analysis": {
        "active_skus": true,
        "new_sku_contribution": true
    },
    "Content Analysis": {
        "title_score": true,
        "image_score": true,
        "si_score": true,
        "description_score": true,
        "rating_score": true,
        "overall_score": true
    },
    "Inventory Analysis": {
        "doh": true,
        "drr": true,
        "total_boxes_required": true,
        "drr_qty": true,
        "current_doh": true,
        "req_po_qty": true,
        "req_boxes": true,
        "threshold_doh": true
    },
    "Play it Yourself": {
        "custom_reports": true
    },
    "Category RCA": {
        "root_causes_identified": true
    },
    "Scheduled Reports": {
        "reports_delivered": true,
        "offtake": true,
        "units_sold": true,
        "orders": true,
        "stock_availability": true,
        "listing_pct": true,
        "inorganic_sales": true,
        "roas": true,
        "conversion_rate": true,
        "cpm": true,
        "cpc": true,
        "bmi_sales_ratio": true,
        "promo_pct": true,
        "osa_pct": true,
        "stock_out_pct": true,
        "doi": true,
        "sos_pct": true,
        "psl": true,
        "assortment": true,
        "metro_city_stock_availability": true,
        "overall_sos_pct": true,
        "sponsored_sos_pct": true,
        "organic_sos_pct": true,
        "ad_position": true,
        "org_position": true,
        "ecp": true,
        "mrp": true,
        "discount_pct": true,
        "rpi": true,
        "impressions": true,
        "clicks": true,
        "spend": true,
        "current_inventory": true,
        "target_inventory": true,
        "inventory_health_pct": true,
        "days_on_hand": true,
        "overall_content_score": true,
        "title_score": true,
        "image_score": true,
        "description_score": true,
        "title_length": true,
        "word_count": true,
        "sales_value": true,
        "market_share_pct": true,
        "category_size": true
    },
    "Download Report": {
        "total_downloads": true
    },
    "Ad Auto": {
        "auto_campaigns": true
    },
    "Rating": {
        "overall_rating": true
    },
    "Supply": {
        "Prioritize PO": {
            "access": true,
            "kpi": {
                "po_number": true,
                "priority": true,
                "projected_sales_at_risk": true,
                "platform_warehouse": true,
                "status": true,
                "billed_value": true,
                "order_value": true,
                "raised_on": true,
                "appt_date": true,
                "expiry": true,
                "avg_doi": true,
                "lt_days": true,
                "fill_c_p_b_g": true,
                "consumption_day": true
            }
        },
        "Fix Stock Transfer": {
            "access": true,
            "kpi": {
                "sku_name": true,
                "from_cfa_surplus": true,
                "to_cfa_deficit": true,
                "distance_km": true,
                "doi_deficit": true,
                "doi_surplus": true,
                "soh_deficit": true,
                "soh_surplus": true,
                "cpd_deficit": true,
                "transfer_qty": true
            }
        },
        "Manage Surplus": {
            "access": true,
            "kpi": {
                "sku_sap_code": true,
                "severity": true,
                "surplus_ea": true,
                "net_doi": true,
                "cfas_count": true,
                "dead_cfas": true,
                "min_expiry": true,
                "value_at_risk": true,
                "team_action_recommendation": true
            }
        }
    },
    "PDS Score": {
        "pds_overall_score": true,
        "dmmh_lever": true,
        "dmmh_sub_lever": true,
        "target": true,
        "weight": true,
        "score": true,
        "wt_score": true,
        "wt_target": true
    },
    "Insights": {
        "share_headroom_hotspots": true,
        "price_parity_radar": true,
        "ds_listing_summary": true,
        "competitor_osa_weak_spots": true,
        "remove_ad_low_osa": true,
        "surplus_stock": true,
        "prioritise_po": true,
        "transfer_issue": true,
        "new_market_entry": true,
        "dark_store_coverage_gaps": true,
        "new_dark_store_expansion": true,
        "co_relations": true
    }
};

(async () => {
    try {
        console.log("Fetching users from ClickHouse...");
        const users = await queryAdmin(`
            SELECT id, user_email, tab_permissions, last_login 
            FROM tb_user
        `);
        console.log(`Found ${users.length} rows in tb_user.`);

        let count = 0;
        for (const user of users) {
            let originalPerms = {};
            if (user.tab_permissions && user.tab_permissions.trim()) {
                try {
                    originalPerms = JSON.parse(user.tab_permissions);
                } catch (e) {
                    console.log(`Skipping invalid JSON for user ${user.user_email}: ${user.tab_permissions}`);
                    continue;
                }
            }

            const restructuredPerms = {};
            
            // Re-map all tab keys to the object structure
            Object.keys(originalPerms).forEach(key => {
                if (key === 'platform') {
                    restructuredPerms[key] = originalPerms[key];
                } else {
                    const originalVal = originalPerms[key];
                    let access = true;
                    let existingKpi = {};
                    
                    if (typeof originalVal === 'boolean') {
                        access = originalVal;
                    } else if (originalVal && typeof originalVal === 'object') {
                        access = originalVal.access !== undefined ? originalVal.access : true;
                        existingKpi = originalVal.kpi || {};
                    }
                    
                    // Merge existing KPI config with defaults
                    const defaultKpis = defaultKpisMap[key] || {};
                    let mergedKpis = {};
                    
                    if (key === "India Overview" || key === "Availability Analysis" || key === "Visibility Analysis" || key === "Market Share" || key === "Performance Marketing" || key === "Market Coverage" || key === "Pricing Analysis" || key === "Content Analysis" || key === "Inventory Analysis") {
                        // Restrict specifically to default KPI list
                        Object.keys(defaultKpis).forEach(k => {
                            let oldVal = existingKpi[k];
                            // Translate legacy keys if they existed
                            if (k === 'overall_sos' && existingKpi['overall_weighted_sos'] !== undefined) {
                                oldVal = existingKpi['overall_weighted_sos'];
                            }
                            if (k === 'sponsored_sos' && existingKpi['sponsored_weighted_sos'] !== undefined) {
                                oldVal = existingKpi['sponsored_weighted_sos'];
                            }
                            if (k === 'organic_sos' && existingKpi['organic_weighted_sos'] !== undefined) {
                                oldVal = existingKpi['organic_weighted_sos'];
                            }
                            if (k === 'stock_availability' && existingKpi['osa'] !== undefined) {
                                oldVal = existingKpi['osa'];
                            }
                            if (k === 'brand_estimated_sales' && existingKpi['estimated_sales'] !== undefined) {
                                oldVal = existingKpi['estimated_sales'];
                            }
                            if (k === 'sales' && key === "Performance Marketing" && existingKpi['inorganic_sales'] !== undefined) {
                                oldVal = existingKpi['inorganic_sales'];
                            }
                            if (k === 'discount_pct' && existingKpi['discount'] !== undefined) {
                                oldVal = existingKpi['discount'];
                            }
                            if (k === 'doh' && existingKpi['days_of_inventory'] !== undefined) {
                                oldVal = existingKpi['days_of_inventory'];
                            }
                            mergedKpis[k] = oldVal !== undefined ? oldVal : defaultKpis[k];
                        });
                    } else {
                        mergedKpis = { ...defaultKpis, ...existingKpi };
                    }
                    
                    restructuredPerms[key] = {
                        access: access,
                        kpi: mergedKpis
                    };
                }
            });

            // Ensure any missing tabs are initialized with true access and default KPIs
            Object.keys(defaultKpisMap).forEach(key => {
                if (restructuredPerms[key] === undefined) {
                    restructuredPerms[key] = {
                        access: true,
                        kpi: defaultKpisMap[key]
                    };
                }
            });

            const jsonStr = JSON.stringify(restructuredPerms).replace(/'/g, "\\'");
            
            console.log(`Migrating permissions for: ${user.user_email} (ID: ${user.id})`);
            await client.command({
                query: `
                    ALTER TABLE tb_user 
                    UPDATE tab_permissions = '${jsonStr}' 
                    WHERE toString(id) = '${user.id}'
                `
            });
            count++;
        }

        console.log(`Successfully queued mutations for ${count} users.`);
        
        // Wait for mutations to finish
        console.log("Checking mutation status...");
        let attempts = 0;
        while (attempts < 10) {
            const mutations = await queryAdmin(`
                SELECT * FROM system.mutations 
                WHERE is_done = 0 AND table = 'tb_user'
            `);
            if (mutations.length === 0) {
                console.log("All ClickHouse mutations completed successfully!");
                break;
            }
            console.log(`Pending mutations: ${mutations.length}. Waiting 1s...`);
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }

        await client.close();
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
})();
