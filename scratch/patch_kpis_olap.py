with open('ds_tester/backend/modules/content_analysis.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    info = _get_segment_info(segment_id, client=client)
    plat = (info.get("platform") or "").lower()
    
    # If the segment is for a platform that does NOT have rating data (e.g. blinkit, instamart, zepto),
    # dynamically exclude rating_score so only metrics that actually exist are verified and displayed.
    if plat and plat != "all" and plat not in PLATFORMS_SUPPORTING_RATINGS:
        return [k for k in KPIS_BY_SECTION["overview"] if k["key"] != "rating_score"]
        
    return KPIS_BY_SECTION["overview"]"""

replacement = """def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    db_name = client or "mars"
    table = get_content_table(db_name)
    if table == "rb_content_olap":
        # rb_content_olap only tracks title, image, bullet/secondary, description, and total score (no star ratings)
        return [k for k in KPIS_BY_SECTION["overview"] if k["key"] != "rating_score"]

    info = _get_segment_info(segment_id, client=client)
    plat = (info.get("platform") or "").lower()
    
    # If the segment is for a platform that does NOT have rating data (e.g. blinkit, instamart, zepto),
    # dynamically exclude rating_score so only metrics that actually exist are verified and displayed.
    if plat and plat != "all" and plat not in PLATFORMS_SUPPORTING_RATINGS:
        return [k for k in KPIS_BY_SECTION["overview"] if k["key"] != "rating_score"]
        
    return KPIS_BY_SECTION["overview"]"""

def norm(s): return s.replace('\r\n', '\n')
text_norm = norm(text)

if norm(target) in text_norm:
    text_norm = text_norm.replace(norm(target), norm(replacement))
    with open('ds_tester/backend/modules/content_analysis.py', 'w', encoding='utf-8') as f:
        f.write(text_norm)
    print("SUCCESS")
else:
    print("FAILED")

