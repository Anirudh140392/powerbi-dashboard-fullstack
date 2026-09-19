/** Generates a paste-and-run Colab cell with the Postgres creds pre-filled.
 *  Writes to data/ (gitignored) so the password is never committed. */
require('dotenv').config();
const fs = require('fs'); const path = require('path');
const cell = `# === Colab: Runtime > Change runtime type > T4 GPU, then Run ===
!pip -q install "transformers>=4.40" "huggingface_hub>=0.23" psycopg2-binary
import random, time, torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from huggingface_hub import login
import psycopg2

HF_TOKEN = ${JSON.stringify(process.env.HF_TOKEN || 'hf_REPLACE')}
HF_REPO  = ${JSON.stringify(process.env.HF_REPO || 'Saurabh-jain/prestige-rating-distilbert')}
DB = dict(host=${JSON.stringify(process.env.DB_HOST)}, dbname=${JSON.stringify(process.env.DB_NAME)},
          user=${JSON.stringify(process.env.DB_USER)}, password=${JSON.stringify(process.env.DB_PASSWORD)},
          port=${parseInt(process.env.DB_PORT||'5432',10)})
COMPANY = "297e37ea-a5ac-47df-bebd-ac44e52b7979"
PER_CLASS, EVAL_PER_CLASS, EPOCHS, BATCH, MAXLEN = 40000, 1500, 3, 32, 160

login(HF_TOKEN)
conn = psycopg2.connect(host=DB["host"], dbname=DB["dbname"], user=DB["user"],
                        password=DB["password"], port=DB["port"], sslmode="require")
tr, ev = [], []
for star in range(1, 6):
    cur = conn.cursor()
    cur.execute("""SELECT regexp_replace(review_text,'\\\\s+',' ','g'), %s-1
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
tl = DataLoader(DS(tr), batch_size=BATCH, shuffle=True); el = DataLoader(DS(ev), batch_size=64)
opt = torch.optim.AdamW(m.parameters(), lr=3e-5); lf = torch.nn.CrossEntropyLoss()
for ep in range(EPOCHS):
    m.train(); t0 = time.time()
    for i, b in enumerate(tl):
        opt.zero_grad()
        out = m(input_ids=b["input_ids"].to(dev), attention_mask=b["attention_mask"].to(dev)).logits
        loss = lf(out, b["labels"].to(dev)); loss.backward(); opt.step()
        if i % 200 == 0: print(f"ep{ep+1} {i}/{len(tl)} loss {loss.item():.3f} {(i+1)/(time.time()-t0):.1f} it/s")
    m.eval(); n=c=o=0; mae=0.0
    with torch.no_grad():
        for b in el:
            p = m(input_ids=b["input_ids"].to(dev), attention_mask=b["attention_mask"].to(dev)).logits.argmax(-1).cpu()
            for pi, ti in zip(p.tolist(), b["labels"].tolist()):
                n+=1; mae+=abs(pi-ti); c+=pi==ti; o+=abs(pi-ti)<=1
    print(f"[EVAL ep{ep+1}] acc={c/n:.3f} off1={o/n:.3f} MAE={mae/n:.3f} (baseline 0.46)")
m.push_to_hub(HF_REPO, private=True); tok.push_to_hub(HF_REPO, private=True); print("pushed (private) ->", HF_REPO)
`;
const out = path.join(__dirname, 'data', 'colab_cell_FILLED.py');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, cell);
console.log('wrote', out, '(' + cell.length + ' chars, DB creds filled, gitignored)');
