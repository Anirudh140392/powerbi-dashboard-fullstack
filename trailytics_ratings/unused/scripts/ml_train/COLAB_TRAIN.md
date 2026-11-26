# Train the in-house rating model on a FREE GPU (Colab / Kaggle)

Best-in-class, free, no paid API. Trains DistilBERT on ~3M **gold** (review_text → real 1–5★)
pairs. CPU takes ~10 h and segfaults; a free Colab/Kaggle **T4 GPU does it in ~20–30 min**.

## Why not the laptop / Railway?
Both are **CPU-only** (no GPU). Railway is also the production box — training there starves the
live pipeline. The only thing that makes this fast is a GPU, and Colab/Kaggle give one for free.

## Steps
1. Open https://colab.research.google.com → new notebook.
2. **Runtime → Change runtime type → T4 GPU.**
3. Paste the cell below, fill the 4 DB values + your free Hugging Face token
   (https://huggingface.co/settings/tokens → "write"), run it.
4. When done it prints the eval **MAE** (beat the 0.46 baseline) and pushes the model to
   `your-hf-user/prestige-rating-distilbert`.
5. Deploy: set `RATING_PRIMARY_MODEL=your-hf-user/prestige-rating-distilbert` on the Railway
   worker — the existing `bert_rating_inference.py` auto-downloads + uses it, and you can drop
   the Gemini fallback. No other code change.

## The one Colab cell
```python
!pip -q install "transformers>=4.40" "huggingface_hub>=0.23" psycopg2-binary
import json, random, time, torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from huggingface_hub import login
import psycopg2

# ---- fill these ----
DB   = dict(host="3.7.138.75", dbname="adsauto", user="REPLACE", password="REPLACE", port=5432)
COMPANY = "297e37ea-a5ac-47df-bebd-ac44e52b7979"
HF_TOKEN = "hf_REPLACE"
HF_REPO  = "your-hf-user/prestige-rating-distilbert"
PER_CLASS, EVAL_PER_CLASS, EPOCHS, BATCH, MAXLEN = 40000, 1500, 3, 32, 160
# --------------------

login(HF_TOKEN)
conn = psycopg2.connect(host=DB["host"], dbname=DB["dbname"], user=DB["user"],
                        password=DB["password"], port=DB["port"], sslmode="require")
tr, ev = [], []
for star in range(1, 6):
    cur = conn.cursor()
    cur.execute("""SELECT regexp_replace(review_text,'\\s+',' ','g'), %s-1
                   FROM ratings.reviews WHERE company_id=%s AND rating=%s
                     AND review_text IS NOT NULL AND length(review_text) BETWEEN 15 AND 1200
                   ORDER BY md5(id::text) LIMIT %s""",
                (star, COMPANY, star, PER_CLASS + EVAL_PER_CLASS))
    rows = [(t.strip(), l) for t, l in cur.fetchall()]
    ev += rows[:EVAL_PER_CLASS]; tr += rows[EVAL_PER_CLASS:]
random.seed(42); random.shuffle(tr)
print("train", len(tr), "eval", len(ev), "gpu", torch.cuda.get_device_name(0))

tok = AutoTokenizer.from_pretrained("distilbert-base-uncased")
class DS(Dataset):
    def __init__(s, d): s.d = d
    def __len__(s): return len(s.d)
    def __getitem__(s, i):
        t, l = s.d[i]; e = tok(t, truncation=True, max_length=MAXLEN, padding="max_length", return_tensors="pt")
        return {"input_ids": e["input_ids"][0], "attention_mask": e["attention_mask"][0], "labels": torch.tensor(l)}
dev = "cuda"
m = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=5).to(dev)
tl = DataLoader(DS(tr), batch_size=BATCH, shuffle=True)
el = DataLoader(DS(ev), batch_size=64)
opt = torch.optim.AdamW(m.parameters(), lr=3e-5); lf = torch.nn.CrossEntropyLoss()
for ep in range(EPOCHS):
    m.train(); t0 = time.time()
    for i, b in enumerate(tl):
        opt.zero_grad()
        out = m(input_ids=b["input_ids"].to(dev), attention_mask=b["attention_mask"].to(dev)).logits
        loss = lf(out, b["labels"].to(dev)); loss.backward(); opt.step()
        if i % 200 == 0: print(f"ep{ep+1} {i}/{len(tl)} loss {loss.item():.3f} {(i+1)/(time.time()-t0):.1f} it/s")
    m.eval(); n = c = o = 0; mae = 0.0
    with torch.no_grad():
        for b in el:
            p = m(input_ids=b["input_ids"].to(dev), attention_mask=b["attention_mask"].to(dev)).logits.argmax(-1).cpu()
            for pi, ti in zip(p.tolist(), b["labels"].tolist()):
                n += 1; mae += abs(pi - ti); c += pi == ti; o += abs(pi - ti) <= 1
    print(f"[EVAL ep{ep+1}] acc={c/n:.3f} off1={o/n:.3f} MAE={mae/n:.3f} (baseline 0.46)")
m.push_to_hub(HF_REPO); tok.push_to_hub(HF_REPO)
print("pushed ->", HF_REPO)
```

## After deploy
- Drop the paid Gemini fallback in `bert_rating_inference.py` (or set `GEMINI_API_KEY` empty).
- Optional: ONNX-quantize for 2–4× CPU inference (`optimum[onnxruntime]`), free.
- Same recipe retrains anytime new reviews accumulate — fully free, fully self-hosted.
