"""
In-house rating model — fine-tune DistilBERT on GOLD (review_text -> 1-5 star).

Best-in-class FREE / self-hosted: supervised on the reviewers' real star ratings
(~3M available, balanced-sampled), so it learns Prestige's actual review->rating
signal instead of cloning a generic zero-shot model. No paid API.

Plain PyTorch loop (CPU-friendly) — only needs torch + transformers (both already
installed). Saves the fine-tuned model + tokenizer to scripts/ml_train/model/.

Eval reports accuracy, off-by-one accuracy, and MAE (rating is ordinal, so MAE is
the metric that matters — current tabularisai baseline MAE was ~0.46).
"""
import json, os, sys, time, random
from pathlib import Path
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "model"
BASE = os.environ.get("BASE_MODEL", "distilbert-base-uncased")
EPOCHS = int(os.environ.get("EPOCHS", "2"))
BATCH = int(os.environ.get("BATCH", "16"))
MAXLEN = int(os.environ.get("MAXLEN", "256"))
LR = float(os.environ.get("LR", "3e-5"))
torch.manual_seed(42); random.seed(42)
# Oversubscribing CPU threads segfaults torch on Windows — cap it.
torch.set_num_threads(int(os.environ.get("TORCH_THREADS", "4")))
SAVE_EVERY = int(os.environ.get("SAVE_EVERY", "200"))  # mid-epoch checkpoints

def load(p):
    rows = [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    return rows

class RevDS(Dataset):
    def __init__(self, rows, tok):
        self.rows = rows; self.tok = tok
    def __len__(self): return len(self.rows)
    def __getitem__(self, i):
        r = self.rows[i]
        enc = self.tok(r["text"], truncation=True, max_length=MAXLEN, padding="max_length", return_tensors="pt")
        return {"input_ids": enc["input_ids"][0], "attention_mask": enc["attention_mask"][0],
                "labels": torch.tensor(r["label"], dtype=torch.long)}

def evaluate(model, dl, device):
    model.eval(); correct=off1=0; n=0; mae=0.0
    with torch.no_grad():
        for b in dl:
            ids=b["input_ids"].to(device); am=b["attention_mask"].to(device); y=b["labels"]
            pred = model(input_ids=ids, attention_mask=am).logits.argmax(-1).cpu()
            for p,t in zip(pred.tolist(), y.tolist()):
                n+=1; mae+=abs(p-t)
                if p==t: correct+=1
                if abs(p-t)<=1: off1+=1
    return correct/n, off1/n, mae/n

def main():
    if not (DATA/"train.jsonl").exists():
        print("ERROR: run export_gold_ratings.cjs first"); sys.exit(1)
    train, ev = load(DATA/"train.jsonl"), load(DATA/"eval.jsonl")
    random.shuffle(train)
    cap = int(os.environ.get("MAX_TRAIN", str(len(train))))
    train = train[:cap]
    print(f"train={len(train)} eval={len(ev)} base={BASE} epochs={EPOCHS} batch={BATCH} threads={torch.get_num_threads()}", flush=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device={device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else " (no GPU — use Colab/Kaggle free T4 for the full run)"), flush=True)
    tok = AutoTokenizer.from_pretrained(BASE)
    model = AutoModelForSequenceClassification.from_pretrained(BASE, num_labels=5).to(device)
    tr_dl = DataLoader(RevDS(train, tok), batch_size=BATCH, shuffle=True)
    ev_dl = DataLoader(RevDS(ev, tok), batch_size=BATCH)
    opt = torch.optim.AdamW(model.parameters(), lr=LR)
    loss_fn = torch.nn.CrossEntropyLoss()
    steps_per_epoch = len(tr_dl)
    best_mae = 9.9
    for ep in range(EPOCHS):
        model.train(); t0=time.time(); running=0.0
        for i,b in enumerate(tr_dl):
            ids=b["input_ids"].to(device); am=b["attention_mask"].to(device); y=b["labels"].to(device)
            opt.zero_grad()
            out = model(input_ids=ids, attention_mask=am).logits
            loss = loss_fn(out, y); loss.backward(); opt.step()
            running += loss.item()
            if i % 50 == 0:
                el=time.time()-t0; rate=(i+1)/max(el,1e-9)
                print(f"  ep{ep+1} step {i}/{steps_per_epoch} loss={running/(i+1):.3f} {rate:.1f} it/s eta={ (steps_per_epoch-i)/max(rate,1e-9)/60:.0f}m", flush=True)
        acc,off1,mae = evaluate(model, ev_dl, device)
        print(f"[EVAL ep{ep+1}] acc={acc:.3f} off-by-1={off1:.3f} MAE={mae:.3f}  (baseline MAE ~0.46)", flush=True)
        if mae < best_mae:
            best_mae = mae
            OUT.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(OUT); tok.save_pretrained(OUT)
            print(f"  saved best model (MAE {mae:.3f}) -> {OUT}", flush=True)
    print(f"DONE best_MAE={best_mae:.3f}", flush=True)

if __name__ == "__main__":
    main()
