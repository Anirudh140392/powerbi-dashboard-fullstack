"""Production issue/feedback classifier — in-house SetFit (37 aspects).

Runs in the Temporal ML-jobs loop (jobName 'SetFit Issues') as a spawned python
process on the worker. Classifies ONLY reviews that still lack a sub-category
(new/unclassified rows), so it's incremental and cheap on CPU. Replaces the old
DeBERTa taxonomy job. The polarity-correction rule is baked in (a positive-star
review can't land in a negative-only aspect), so the confusion can't recur.

Env: DB_*, COMPANY_ID, HF_TOKEN. Self-installs setfit/sentence-transformers.
"""
import os, sys, re, subprocess, io
try: sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
except Exception: pass

def _pip(*pkgs):
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', *pkgs], check=True)
try:
    from setfit import SetFitModel
except Exception:
    print('[setfit] installing deps...', flush=True)
    _pip('setfit==1.1.0', 'sentence-transformers==3.3.1', 'transformers==4.45.2')
    from setfit import SetFitModel

import numpy as np, psycopg2
from psycopg2.extras import execute_values
from huggingface_hub import login

REPO = os.environ.get('ISSUE_MODEL_REPO', 'Saurabh-jain/prestige-issue-setfit')
COMPANY = os.environ['COMPANY_ID']
HF_TOKEN = os.environ.get('HF_TOKEN', '')
READ_BATCH = int(os.environ.get('SETFIT_READ_BATCH', '1000'))
GPU_BATCH = int(os.environ.get('SETFIT_GPU_BATCH', '128'))
THRESH = float(os.environ.get('SETFIT_THRESH', '0.35'))
MAX_ROWS = int(os.environ.get('SETFIT_MAX_ROWS', '400000'))  # safety cap per run

LABELS = ["Accessories","Auto_Ignition","Build_Quality","Cheap_Quality","Cleaning","Coating_Issues","Cooking_Performance","Customer_Service","Delivery_Issues","Electrical_Safety","Flame_Gas","Gas_Leakage","Gasket_Issues","General_Feedback","Grinding_Blending","Handle_Issues","Heating_Performance","Induction_Compatible","Knob_Issues","Lid_Issues","Manufacturing_Defects","Material_Quality","Missing_Parts","Motor_Performance","Overpriced","Packaging","Physical_Safety","Pressure_Cooking","Recommendation","Return_Refund","Size_Fit","Steam_Leakage","Stopped_Working","Valve_Issues","Warranty_Issues","Whistle_Issues","Worth_Money"]
A2C = {"Coating_Issues":"Quality","Build_Quality":"Quality","Material_Quality":"Quality","Cheap_Quality":"Quality","Manufacturing_Defects":"Quality","Gasket_Issues":"Quality","Handle_Issues":"Quality","Knob_Issues":"Quality","Lid_Issues":"Quality","Valve_Issues":"Quality","Whistle_Issues":"Quality","Steam_Leakage":"Quality","Stopped_Working":"Quality","Cooking_Performance":"Performance","Heating_Performance":"Performance","Motor_Performance":"Performance","Grinding_Blending":"Performance","Flame_Gas":"Performance","Worth_Money":"Value","Overpriced":"Value","Size_Fit":"Usability","Cleaning":"Usability","Induction_Compatible":"Usability","Accessories":"Usability","Delivery_Issues":"Delivery","Packaging":"Delivery","Customer_Service":"Customer Service","Return_Refund":"Customer Service","Warranty_Issues":"Customer Service","Electrical_Safety":"Safety","Physical_Safety":"Safety","Recommendation":"Brand","Missing_Parts":"Delivery","Gas_Leakage":"Safety","Pressure_Cooking":"Performance","Auto_Ignition":"Performance","General_Feedback":"General"}

# Polarity guard: a positive-star review must not land in a negative-only aspect.
NEG_ASPECTS = {"Stopped_Working","Manufacturing_Defects","Cheap_Quality","Coating_Issues","Handle_Issues","Lid_Issues","Valve_Issues","Whistle_Issues","Gasket_Issues","Knob_Issues","Steam_Leakage","Electrical_Safety","Physical_Safety","Gas_Leakage","Overpriced","Customer_Service","Return_Refund","Packaging"}
POS_PAT = re.compile(r"(still working|working (good|well|fine|properly|great|nicely)|works (good|well|fine|great|perfectly)|good (product|quality|condition)|nice product|value for money|worth|excellent|awesome|superb|satisfied|happy with)", re.I)
NEG_PAT = re.compile(r"(not working|stop|stopped|dead|does ?n.t work|did ?n.t work|won.t|broke|broken|defect|worst|waste|leak|damaged|cracked|poor|useless|return|refund)", re.I)

def sentiment_of(rating):
    if rating is None: return None
    if rating <= 2: return 'Negative'
    if rating == 3: return 'Neutral'
    return 'Positive'

def correct(aspect, conf, rating, text):
    if conf < THRESH: return 'General_Feedback'
    if aspect in NEG_ASPECTS and rating is not None and rating >= 4 and POS_PAT.search(text or '') and not NEG_PAT.search(text or ''):
        return 'Worth_Money' if aspect == 'Overpriced' else 'General_Feedback'
    return aspect

def main():
    if HF_TOKEN:
        try: login(HF_TOKEN)
        except Exception: pass
    model = SetFitModel.from_pretrained(REPO, token=HF_TOKEN or None)
    print(f'[setfit] model loaded ({len(LABELS)} labels)', flush=True)
    conn = psycopg2.connect(host=os.environ['DB_HOST'], dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'],
                            password=os.environ['DB_PASSWORD'], port=int(os.environ.get('DB_PORT', '5432')), sslmode='require',
                            keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5)
    read = conn.cursor(); total = 0; last = '00000000-0000-0000-0000-000000000000'
    while total < MAX_ROWS:
        read.execute("""SELECT id::text, review_text, rating FROM ratings.reviews
                        WHERE company_id=%s AND id>%s::uuid AND sentiment_subcategory IS NULL
                          AND review_text IS NOT NULL AND length(review_text) >= 10
                        ORDER BY id LIMIT %s""", (COMPANY, last, READ_BATCH))
        rows = read.fetchall()
        if not rows: break
        last = rows[-1][0]
        ids = [r[0] for r in rows]; texts = [(r[1] or '')[:400] for r in rows]; ratings = [r[2] for r in rows]
        updates = []
        for i in range(0, len(texts), GPU_BATCH):
            chunk = texts[i:i+GPU_BATCH]
            probs = np.array(model.predict_proba(chunk))
            top = probs.argmax(axis=1); conf = probs.max(axis=1)
            for j, (_id, ti, ci) in enumerate(zip(ids[i:i+GPU_BATCH], top.tolist(), conf.tolist())):
                rt = float(ratings[i+j]) if ratings[i+j] is not None else None
                asp = correct(LABELS[ti], ci, rt, chunk[j])
                updates.append((_id, asp, A2C.get(asp, 'General'), sentiment_of(rt)))
        with conn.cursor() as w:
            execute_values(w,
                """UPDATE ratings.reviews r SET sentiment_subcategory=v.sub, sentiment_category=v.cat,
                          sentiment=COALESCE(v.sent, r.sentiment)
                   FROM (VALUES %s) AS v(id, sub, cat, sent)
                   WHERE r.id = v.id::uuid""",
                updates, template='(%s,%s,%s,%s)')
        conn.commit()
        total += len(rows)
        print(f'[setfit] classified {total}', flush=True)
    print(f'[setfit] DONE classified {total} new reviews', flush=True)
    conn.close()

if __name__ == '__main__':
    main()
