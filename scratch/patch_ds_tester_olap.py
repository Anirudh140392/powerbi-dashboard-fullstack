with open('ds_tester/backend/modules/content_analysis.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        except Exception as e:
            print(f"[DS Tester] Error in step2_logic for rb_product_verify: {e}")

    return {
        "title_score": None,
        "image_score": None,
        "si_score": None,
        "desc_score": None,
        "rating_score": None,
        "overall_score": None,
    }"""

replacement = """        except Exception as e:
            print(f"[DS Tester] Error in step2_logic for rb_product_verify: {e}")

    elif table == "rb_content_olap":
        col_plat = resolve_table_column(db_name, "rb_content_olap", "platform") or "platform"
        plat_cond = ""
        if plat and plat != "all":
            plat_cond = f"AND lower({col_plat}) = '{plat.strip().lower()}'"

        query = f\"\"\"
        SELECT 
            ROUND(AVG(title_score) * 5.0, 2) AS title_score,
            ROUND(AVG(thumbnail_image_score) * 5.0, 2) AS image_score,
            ROUND(AVG(bullet_score) * 5.0, 2) AS si_score,
            ROUND(AVG(description_score) * 5.0, 2) AS desc_score,
            ROUND(AVG(total_score), 2) AS overall_score
        FROM {db_name}.rb_content_olap
        WHERE toDate(created_on) BETWEEN '{start_date}' AND '{end_date}'
          {plat_cond}
        \"\"\"
        try:
            rows = execute_select_query(query, database=db_name)
            if rows and rows[0]:
                r = rows[0]
                import math
                title = float(r[0]) if r[0] is not None and not math.isnan(float(r[0])) else 0.0
                image = float(r[1]) if r[1] is not None and not math.isnan(float(r[1])) else 0.0
                si = float(r[2]) if r[2] is not None and not math.isnan(float(r[2])) else 0.0
                desc = float(r[3]) if r[3] is not None and not math.isnan(float(r[3])) else 0.0
                overall = float(r[4]) if r[4] is not None and not math.isnan(float(r[4])) else 0.0
                return {
                    "title_score": round(title, 2),
                    "image_score": round(image, 2),
                    "si_score": round(si, 2),
                    "desc_score": round(desc, 2),
                    "rating_score": None,
                    "overall_score": round(overall, 2),
                }
        except Exception as e:
            print(f"[DS Tester] Error in step2_logic for rb_content_olap: {e}")

    return {
        "title_score": None,
        "image_score": None,
        "si_score": None,
        "desc_score": None,
        "rating_score": None,
        "overall_score": None,
    }"""

def norm(s): return s.replace('\r\n', '\n')
text_norm = norm(text)

if norm(target) in text_norm:
    text_norm = text_norm.replace(norm(target), norm(replacement))
    with open('ds_tester/backend/modules/content_analysis.py', 'w', encoding='utf-8') as f:
        f.write(text_norm)
    print("SUCCESS: patched step2_logic for rb_content_olap")
else:
    print("FAILED target")

