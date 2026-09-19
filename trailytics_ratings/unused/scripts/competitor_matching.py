import os
import re
from difflib import SequenceMatcher

import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    # TCP keepalives — prevent AWS/Postgres from dropping the idle socket
    # during long fuzzy-match batches.
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=os.getenv("DB_PORT", 5432),
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def get_company_id():
    return os.environ["COMPANY_ID"]


def similar(a, b):
    if not isinstance(a, str) or not isinstance(b, str):
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def parse_num(val):
    if not val:
        return None
    matches = re.findall(r"[-+]?\d*\.?\d+", str(val))
    if not matches:
        return None
    try:
        return float(matches[0])
    except ValueError:
        return None


def is_within_tolerance(v1, v2, tol=0.15):
    if v1 is None or v2 is None:
        return False
    max_v = max(abs(v1), abs(v2))
    if max_v == 0:
        return False
    return (abs(v1 - v2) / max_v) <= tol


def is_electric_product(category):
    if not category:
        return False
    electric_keywords = ["induction", "mixer", "grinder", "kettle", "juicer", "air fryer", "rice cooker", "toaster", "otg", "cooktop"]
    return any(keyword in category.lower() for keyword in electric_keywords)


def build_competitor_matrix():
    company_id = get_company_id()
    print("[System] Building strict Prestige-to-Competitor mapping pairs...", flush=True)
    print(f"[System] Company ID: {company_id}", flush=True)

    conn = get_db_connection()
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT COALESCE(sku_code, product_external_id) AS our_sku,
                   product_name, category, material, wattage, capacity, platform
            FROM masters.products
            WHERE company_id = %s AND is_competitor = false AND product_name IS NOT NULL
        """, (company_id,))
        prestige_skus = cur.fetchall()

        cur.execute("""
            SELECT product_external_id AS competitor_sku,
                   product_name, brand_name, category, material, wattage, capacity, platform
            FROM masters.products
            WHERE company_id = %s AND is_competitor = true AND product_name IS NOT NULL
        """, (company_id,))
        competitor_skus = cur.fetchall()

        cur.execute("DELETE FROM ratings.competitor_mapping_pairs WHERE company_id = %s", (company_id,))

        insert_rows = []
        for our_sku, our_name, our_category, our_material, our_wattage, our_capacity, our_platform in prestige_skus:
            if not our_category:
                continue

            our_is_electric = is_electric_product(our_category)
            our_wattage_num = parse_num(our_wattage)
            our_capacity_num = parse_num(our_capacity)
            normalized_material = (our_material or "").strip().lower() or None

            matches = []
            for comp_sku, comp_name, comp_brand, comp_category, comp_material, comp_wattage, comp_capacity, comp_platform in competitor_skus:
                if comp_category != our_category:
                    continue

                comp_is_electric = is_electric_product(comp_category)
                if our_is_electric != comp_is_electric:
                    continue

                match_type = None
                notes = []

                if our_is_electric:
                    if is_within_tolerance(our_wattage_num, parse_num(comp_wattage), 0.15):
                        match_type = "WATTAGE_PEER"
                        notes.append("matched on wattage +/-15%")
                    elif is_within_tolerance(our_capacity_num, parse_num(comp_capacity), 0.15):
                        match_type = "CAPACITY_PEER"
                        notes.append("matched on capacity +/-15%")
                    else:
                        continue
                else:
                    competitor_material = (comp_material or "").strip().lower() or None
                    if not normalized_material or not competitor_material or normalized_material != competitor_material:
                        continue
                    match_type = "MATERIAL_PEER"
                    notes.append("matched on exact material")

                matches.append((
                    similar(our_name, comp_name),
                    company_id,
                    our_sku,
                    our_name,
                    our_category,
                    our_material,
                    our_wattage if our_is_electric else our_capacity,
                    our_platform,
                    comp_brand or "Unknown",
                    comp_sku,
                    comp_name,
                    comp_category,
                    comp_material,
                    comp_wattage if our_is_electric else comp_capacity,
                    comp_platform,
                    match_type,
                    "; ".join(notes),
                ))

            matches.sort(key=lambda row: row[0], reverse=True)
            for _, *payload in matches[:5]:
                insert_rows.append(tuple(payload))

        if insert_rows:
            args_str = b",".join(cur.mogrify("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", row) for row in insert_rows)
            cur.execute(
                b"""
                INSERT INTO ratings.competitor_mapping_pairs (
                    company_id, our_sku, our_product_name, our_category, our_material, our_wattage, our_platform,
                    comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform,
                    match_type, notes
                ) VALUES """ + args_str
            )

        conn.commit()
        print(f"[Success] Saved {len(insert_rows)} competitor mapping pairs.", flush=True)
    except Exception as error:
        print(f"[FATAL ERROR] {error}", flush=True)
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    build_competitor_matrix()
