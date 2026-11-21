"""
Enhanced Category Classifier v8 - Production-Grade Review Intelligence
=====================================================================
Key improvements over v7:
1. MULTI-LABEL: Returns ALL matching categories per review, not just first match
2. NEGATION DETECTION: "not bad" → positive, "no problem" → positive
3. INDIRECT SENTIMENT: "could have been better" → negative, "nothing special" → negative
4. IMPACT SCORING: Safety issues score highest, cosmetic issues lowest
5. CONFIDENCE CALIBRATION: Weighted by keyword length, position, and context
6. ENRICHED TAXONOMY: Merged with learned keywords from 70K real reviews
"""

import os
import json
import re
import math
from typing import Dict, List, Optional, Tuple
from pathlib import Path

# Load learned keywords from training
SCRIPT_DIR = Path(__file__).parent
KEYWORDS_FILE = SCRIPT_DIR / "learned_keywords.json"
ENRICHED_FILE = SCRIPT_DIR / "enriched_keywords.json"

try:
    with open(KEYWORDS_FILE, 'r', encoding='utf-8') as f:
        LEARNED_DATA = json.load(f)
        LEARNED_KEYWORDS = LEARNED_DATA.get('LEARNED_KEYWORDS', {})
        GOOD_INDICATORS = set(LEARNED_DATA.get('GOOD_INDICATORS', []))
        BAD_INDICATORS = set(LEARNED_DATA.get('BAD_INDICATORS', []))
except FileNotFoundError:
    LEARNED_KEYWORDS = {}
    GOOD_INDICATORS = set()
    BAD_INDICATORS = set()

# Load enriched keywords from Phase 2
ENRICHED_KEYWORDS = {}
try:
    if ENRICHED_FILE.exists():
        with open(ENRICHED_FILE, 'r', encoding='utf-8') as f:
            ENRICHED_KEYWORDS = json.load(f)
except Exception:
    pass

# ============================================================
# NEGATION PATTERNS — detect when sentiment is inverted
# ============================================================
NEGATION_WORDS = {
    "not", "no", "never", "neither", "nor", "nothing", "nobody",
    "nowhere", "none", "don't", "doesn't", "didn't", "won't",
    "wouldn't", "can't", "couldn't", "shouldn't", "isn't", "aren't",
    "wasn't", "weren't", "hasn't", "haven't", "hadn't", "without",
}

# Within this many words after a negation, sentiment is inverted
NEGATION_WINDOW = 3

# ============================================================
# INDIRECT SENTIMENT PATTERNS
# ============================================================
INDIRECT_NEGATIVE_PATTERNS = [
    r"could\s+(have\s+)?been?\s+better",
    r"nothing\s+special",
    r"not\s+(that\s+)?great",
    r"not\s+(really\s+)?worth",
    r"expected\s+(much\s+)?more",
    r"expected\s+better",
    r"not\s+as\s+(good|great|nice)",
    r"not\s+impressed",
    r"leaves?\s+(much|a lot)\s+to\s+be\s+desired",
    r"left\s+(much|a lot)\s+to\s+be\s+desired",
    r"so\s+so",
    r"just\s+okay",
    r"just\s+ok\b",
    r"barely\s+(works|acceptable|usable|decent)",
    r"wouldn'?t\s+recommend",
    r"wouldn'?t\s+buy\s+again",
    r"won'?t\s+(be\s+)?buy(ing)?\s+again",
    r"not\s+satisfied",
    r"(waste|loss)\s+of\s+money",
    r"(regret|regretting)\s+(buying|purchase)",
    r"don'?t\s+waste",
    r"better\s+options?\s+(available|exist|out there)",
    r"there\s+are\s+better",
    r"not\s+up\s+to\s+(the\s+)?mark",
    r"below\s+(expectation|average|standard)",
    r"(really|very|quite)\s+disappointed",
    r"not\s+happy",
    r"not\s+good",
    r"not\s+great",
    r"not\s+nice",
    r"not\s+fine",
    r"not\s+okay",
    r"not\s+ok\b",
    r"poor\s+quality",
    r"poor\s+performance",
    r"low\s+quality",
    r"cheap\s+quality",
    r"bad\s+quality",
]

INDIRECT_POSITIVE_PATTERNS = [
    r"not\s+bad",
    r"no\s+(complaint|issue|problem)(s)?",
    r"no\s+regret",
    r"can'?t\s+complain",
    r"worth\s+(every\s+)?penny",
    r"worth\s+(every\s+)?rupee",
    r"bang\s+for\s+(the\s+)?buck",
    r"exceeded?\s+(my\s+)?expectation",
    r"better\s+than\s+expected",
    r"pleasantly\s+surprised",
    r"no\s+(complaints?|issues?|problems?)\s+(so\s+far|at all|whatsoever|till\s+(now|date))",
    r"couldn'?t\s+(have\s+)?ask(ed)?\s+for\s+(more|better)",
    r"does\s+the\s+job\s+(perfectly|well|great)",
    r"does\s+what\s+it\s+(says|promises|claims)",
    r"(must|definite(ly)?)\s+(buy|have|get|purchase)",
    r"highly\s+recommend",
    r"(love|loving)\s+(it|this)",
]

# ============================================================
# IMPACT SCORES — How critical is this subcategory?
# ============================================================
# 1.0 = Safety-critical (physical harm risk)
# 0.8 = Product failure (stops working, defective)
# 0.6 = Quality degradation (part issues)
# 0.4 = Usability/experience
# 0.2 = Cosmetic/packaging/delivery
IMPACT_SCORES = {
    # Safety (highest impact)
    "Gas_Leakage": 1.0,
    "Steam_Leakage": 1.0,
    "Electrical_Safety": 1.0,
    "Physical_Safety": 1.0,
    
    # Product failure
    "Stopped_Working": 0.9,
    "Manufacturing_Defects": 0.9,
    "Motor_Performance": 0.85,
    
    # Part-specific quality
    "Lid_Issues": 0.75,
    "Handle_Issues": 0.75,
    "Gasket_Issues": 0.75,
    "Valve_Issues": 0.8,
    "Whistle_Issues": 0.7,
    "Knob_Issues": 0.65,
    "Coating_Issues": 0.7,
    
    # Performance
    "Heating_Performance": 0.7,
    "Cooking_Performance": 0.65,
    "Grinding_Blending": 0.65,
    "Pressure_Cooking": 0.7,
    "Flame_Gas": 0.7,
    "Efficiency": 0.6,
    
    # Quality general
    "Build_Quality": 0.7,
    "Durability": 0.7,
    "Material_Quality": 0.65,
    "Overall_Quality": 0.5,
    
    # Usability
    "Ease_of_Use": 0.5,
    "Cleaning": 0.45,
    "Size_Fit": 0.45,
    "Capacity": 0.45,
    "Weight_Portable": 0.4,
    "Design_Look": 0.35,
    "Cord_Length": 0.3,
    
    # Value
    "Worth_Money": 0.5,
    "Price_Perception": 0.45,
    "Overpriced": 0.5,
    "Cheap_Quality": 0.6,
    "Budget_Friendly": 0.4,
    
    # Delivery
    "Fast_Delivery": 0.2,
    "Delivery_Issues": 0.3,
    "Packaging_Issues": 0.3,
    "Good_Packaging": 0.15,
    "Damaged_In_Transit": 0.5,
    "Missing_Parts": 0.6,
    
    # Customer Service
    "Poor_Service": 0.55,
    "Warranty_Issues": 0.6,
    "Return_Refund": 0.5,
    "Good_Service": 0.3,
    
    # Features
    "Auto_Ignition": 0.5,
    "Induction_Compatible": 0.5,
    "Temperature_Control": 0.4,
    "Timer_Function": 0.3,
    "Safety_Features": 0.7,
    "Accessories": 0.3,
    
    # Brand
    "Brand_Trust": 0.4,
    "Brand_Disappointment": 0.5,
    "Upgrade_Switch": 0.35,
    
    # Competitor
    "Hawkins_Comparison": 0.35,
    "Pigeon_Comparison": 0.35,
    "Butterfly_Comparison": 0.35,
    "Philips_Comparison": 0.35,
    "Preethi_Comparison": 0.35,
    "Bajaj_Comparison": 0.35,
    "Other_Competitors": 0.3,
    
    # General
    "Recommendation": 0.4,
    "Satisfaction": 0.35,
    "General_Feedback": 0.2,
}


# ============================================================
# v8 TAXONOMY - Based on v7 + Bigram Enrichment
# ============================================================
FULL_TAXONOMY = {
    # 1. QUALITY - Specific product parts and issues
    "Quality": {
        "Lid_Issues": ["lid broken", "lid cracked", "lid doesn't fit", "lid gap", "glass lid", "lid design", 
                      "broken lid", "cracked lid", "lid missing", "outer lid", "lid quality", "lid"],
        "Handle_Issues": ["handle broken", "broken handle", "handle quality", "handle gets hot", "handle loose",
                         "plastic handle", "side handle", "handle damaged", "handle problem", "handle"],
        "Gasket_Issues": ["gasket", "rubber gasket", "gasket cracked", "gasket missing", "sealing ring", "rubber ring"],
        "Whistle_Issues": ["whistle not working", "whistle missing", "whistle problem", "whistle sound", 
                          "no whistle", "cooker whistle", "weight valve", "whistle"],
        "Knob_Issues": ["knob broken", "knob missing", "knob loose", "knob problem", "lid knob", "gas knob", "knob"],
        "Valve_Issues": ["safety valve", "valve gone", "valve missing", "pressure valve", "valve problem", "valve"],
        "Coating_Issues": ["coating peeling", "coating coming off", "non-stick peeling", "nonstick peeling", 
                          "coating started", "teflon coating", "coating quality", "paint peeling", "coating", "non-stick", "nonstick"],
        "Build_Quality": ["build quality", "well built", "poorly built", "sturdy", "flimsy", "solid", "cheap material", "premium",
                        "broken", "damaged", "cracked", "rusted", "bent", "dent"],
        "Durability": ["lasted years", "still working", "durable", "durability", "long lasting", "wear and tear", "lasted"],
        "Material_Quality": ["stainless steel", "steel quality", "thick material", "thin material", "plastic quality",
                            "steel", "plastic", "aluminium", "aluminum", "thick", "thin"],
        "Manufacturing_Defects": ["defective piece", "manufacturing defect", "faulty", "received damaged", "received broken",
                                 "defective", "defect"],
        # Multi-word phrases only — single bare adjectives ("amazing", "terrible",
        # "quality") used to dominate ~25% of all labels because every glowing or
        # angry review contains one. Restricting to "<adj> product / quality /
        # build" lets specific subcategories win when they're present and only
        # fires this catch-all when the review really is a generic quality blurb.
        "Overall_Quality": ["good product", "nice product", "excellent product", "best product",
                           "bad product", "worst product", "poor quality", "low quality", "high quality",
                           "good quality", "quality product", "best quality", "bad quality",
                           "perfect product", "terrific product", "fabulous product", "mind blowing",
                           "amazing product", "fantastic product", "wonderful product", "awesome product",
                           "terrible product", "pathetic product", "useless product", "brilliant product",
                           "superb product", "superb quality", "amazing quality", "fantastic quality"]
    },
    
    # 2. PERFORMANCE - How well it works
    "Performance": {
        "Stopped_Working": ["stopped working", "not working", "doesn't work", "stopped functioning",
                           "working fine", "works properly", "working properly", "works", "working"],
        "Heating_Performance": ["heat distribution", "heats evenly", "uneven heating", "heating problem",
                               "heats quickly", "fast heating", "slow heating", "heating issue",
                               "heating", "heats", "heat"],
        "Cooking_Performance": ["cooks well", "cooking experience", "rice cooking", "fast cooking",
                               "even cooking", "cooking time", "cooks perfectly",
                               "cooking", "cooks", "cook", "boiling", "boils", "frying"],
        "Motor_Performance": ["motor powerful", "motor quality", "motor problem", "motor noise", "weak motor", "motor"],
        "Grinding_Blending": ["grind properly", "grinding performance", "blend smoothly", "chutney grinding",
                              "batter grinding", "wet grinding", "dry grinding",
                              "grinding", "grind", "blend", "blending", "mixer", "grinder"],
        "Pressure_Cooking": ["pressure cooking", "whistle count", "pressure release", "cooker pressure", "pressure"],
        "Flame_Gas": ["flame distribution", "gas consumption", "flame quality", "burner flame", "low flame", "high flame",
                     "burner", "flame", "gas stove"],
        "Efficiency": ["time saving", "saves time", "efficient", "power consumption", "electricity", "fast", "quick", "slow"]
    },
    
    # 3. USABILITY
    "Usability": {
        "Ease_of_Use": ["easy to use", "user friendly", "simple", "complicated", "difficult to use", "convenient"],
        "Cleaning": ["easy to clean", "cleaning easy", "hard to clean", "dishwasher safe", "wash easily"],
        "Size_Fit": ["size perfect", "size small", "big size", "small size", "perfect size", "fits perfectly"],
        "Capacity": ["capacity good", "litre capacity", "liter capacity", "sufficient capacity"],
        "Weight_Portable": ["lightweight", "light weight", "heavy weight", "easy to carry", "portable"],
        "Design_Look": ["design good", "looks attractive", "stylish look", "colour nice", "color good",
                        "design", "look", "beautiful", "stylish", "modern", "colour", "color", "shape"],
        "Cord_Length": ["cord length", "short cord", "power cord", "wire length"]
    },
    
    # 4. VALUE
    "Value": {
        "Worth_Money": ["worth every penny", "value for money", "worth buying", "worth it", "worth the price",
                        "worth penny", "worth rupee", "paisa vasool"],
        "Price_Perception": ["price reasonable", "good price", "affordable price", "best price", "reasonable price"],
        "Overpriced": ["expensive", "overpriced", "bit expensive", "too expensive", "high price", "costly"],
        "Cheap_Quality": ["cheap quality", "cheap plastic", "cheap material", "low quality material"],
        "Budget_Friendly": ["budget friendly", "affordable", "economical", "budget product", "best buy"]
    },
    
    # 5. DELIVERY
    "Delivery": {
        "Fast_Delivery": ["fast delivery", "quick delivery", "delivery on time", "same day delivery", "delivered early"],
        "Delivery_Issues": ["late delivery", "delayed delivery", "delivery boy", "delivery person", "wrong delivery"],
        "Packaging_Issues": ["poor packaging", "packaging bad", "packing issue", "bad packing", "packaging damaged",
                            "packaging was", "badly packed", "poor packing", "packaging not good", "loose packaging",
                            "packaging terrible", "no packaging", "packaging poor", "packing was poor", "packaging"],
        "Good_Packaging": ["good packing", "nice packaging", "well packed", "safe packaging", "proper packaging",
                          "packaging excellent", "perfectly packed", "packaging good", "packing good", "packing"],
        "Damaged_In_Transit": ["arrived damaged", "received damaged", "received broken", "broken in transit",
                               "received defective", "product damaged", "came damaged", "came broken"],
        "Missing_Parts": ["parts missing", "missing parts", "lid missing", "whistle missing", "warranty card missing",
                          "accessories missing", "incomplete delivery"]
    },
    
    # 6. CUSTOMER SERVICE
    "Customer Service": {
        "Poor_Service": ["customer service poor", "no response", "bad support", "unhelpful", "service hopeless",
                         "customer care", "helpline", "customer support"],
        "Warranty_Issues": ["warranty claim", "warranty not honored", "service center", "repair cost",
                            "warranty void", "warranty expired"],
        "Return_Refund": ["return process", "refund issue", "exchange problem", "replacement delayed",
                          "refund", "return", "exchange", "replacement"],
        "Good_Service": ["helpful support", "good response", "service excellent", "quick replacement"]
    },
    
    # 7. SAFETY
    "Safety": {
        "Gas_Leakage": ["gas leaking", "gas leak", "leaking gas", "gas smell", "fire hazard"],
        "Steam_Leakage": ["steam leaking", "steam coming", "pressure leaking", "vapor leak"],
        "Electrical_Safety": ["electric shock", "sparking", "short circuit", "fire risk"],
        "Physical_Safety": ["burns hand", "handle hot", "safety valve gone", "dangerous", "burn", "injury", "accident"]
    },
    
    # 8. FEATURES
    "Features": {
        "Auto_Ignition": ["auto ignition", "automatic ignition", "ignition works", "auto cut off"],
        "Induction_Compatible": ["induction compatible", "induction base", "induction friendly", "works on induction"],
        "Temperature_Control": ["temperature control", "heat settings", "adjustable temperature"],
        "Timer_Function": ["timer function", "auto timer"],
        "Safety_Features": ["safety features", "safety valve", "auto shut off", "thermal cutoff"],
        "Accessories": ["accessories included", "comes with", "jar included", "lid included"]
    },
    
    # 9. BRAND
    "Brand": {
        "Brand_Trust": ["trust prestige", "prestige brand", "trusted brand", "brand quality", "prestige quality",
                        "trust", "trusted", "reliable", "reputation", "original", "genuine", "authentic"],
        "Brand_Disappointment": ["expected from prestige", "disappointed prestige", "prestige has", "brand reputation",
                                 "expected better from", "not expected"],
        "Upgrade_Switch": ["upgraded from", "switched to", "replaced my old", "switched from"]
    },
    
    # 10. COMPETITOR
    "Competitor": {
        "Hawkins_Comparison": ["hawkins", "compared to hawkins", "better than hawkins", "prefer hawkins", "hawkins better"],
        "Pigeon_Comparison": ["pigeon", "compared to pigeon", "better than pigeon", "pigeon is better"],
        "Butterfly_Comparison": ["butterfly", "compared to butterfly", "butterfly better"],
        "Philips_Comparison": ["philips", "go for philips", "philips always", "philips better"],
        "Preethi_Comparison": ["preethi", "preethi zodiac", "preethi better", "compared to preethi"],
        "Bajaj_Comparison": ["bajaj", "bajaj better", "compared to bajaj"],
        "Other_Competitors": ["morphy richards", "wonderchef", "bosch", "panasonic", "sujata", "maharaja", "usha",
                              "crompton", "havells", "orient", "vinod", "inalsa", "glen", "kenstar"]
    },
    
    # 11. GENERAL
    "General": {
        "Recommendation": ["recommend", "must buy", "don't buy", "avoid", "go for it", "worth buying",
                           "highly recommend", "strongly recommend"],
        "Satisfaction": ["satisfied", "happy", "pleased", "love it", "disappointed", "regret"],
        # Reserved for genuinely generic reviews — single-word "good"/"bad"/"nice"
        # used to swallow ~30% of all labels because every short review has them.
        # Keep only the phrases that signal "the reviewer wrote nothing specific"
        # ("as expected", "okay only", "average product").
        "General_Feedback": ["as expected", "as described", "as advertised",
                             "okay only", "ok only", "average product",
                             "decent product", "normal product", "fine product",
                             "nothing to say", "no comment"]
    }
}


# Merge enriched keywords into taxonomy
def _merge_enriched():
    """Merge enriched keywords from Phase 2 n-gram analysis."""
    if not ENRICHED_KEYWORDS:
        return
    count = 0
    for cat, subcats in ENRICHED_KEYWORDS.items():
        if cat not in FULL_TAXONOMY:
            continue
        for subcat, keywords in subcats.items():
            if subcat not in FULL_TAXONOMY[cat]:
                continue
            existing = set(FULL_TAXONOMY[cat][subcat])
            for kw in keywords:
                if isinstance(kw, str) and kw not in existing and len(kw) > 2:
                    FULL_TAXONOMY[cat][subcat].append(kw)
                    existing.add(kw)
                    count += 1
    if count > 0:
        print(f"[Classifier v8] Merged {count} enriched keywords from real review corpus")

_merge_enriched()


# Competitor brands for detection
COMPETITOR_BRANDS = [
    "hawkins", "pigeon", "butterfly", "philips", "preethi", "bajaj", "vinod",
    "morphy", "wonderchef", "bosch", "panasonic", "sujata", "maharaja", "usha",
    "crompton", "havells", "orient", "inalsa", "glen", "kenstar"
]


def detect_competitor_mentions(text: str) -> List[str]:
    """Detect competitor brand mentions in text."""
    text_lower = text.lower()
    return [brand for brand in COMPETITOR_BRANDS if brand in text_lower]


# ============================================================
# LANGUAGE DETECTION (lightweight, no extra deps)
# ============================================================
# Indic + East-Asian script blocks. If a review is mostly written in one of
# these scripts the English keyword taxonomy will silently match nothing
# meaningful, so we short-circuit to a rating-only classification.
_NON_LATIN_RANGES = [
    (0x0900, 0x097F),  # Devanagari (Hindi/Marathi)
    (0x0980, 0x09FF),  # Bengali
    (0x0A00, 0x0A7F),  # Gurmukhi (Punjabi)
    (0x0A80, 0x0AFF),  # Gujarati
    (0x0B00, 0x0B7F),  # Oriya
    (0x0B80, 0x0BFF),  # Tamil
    (0x0C00, 0x0C7F),  # Telugu
    (0x0C80, 0x0CFF),  # Kannada
    (0x0D00, 0x0D7F),  # Malayalam
    (0x3040, 0x309F),  # Hiragana
    (0x30A0, 0x30FF),  # Katakana
    (0x4E00, 0x9FFF),  # CJK
    (0xAC00, 0xD7AF),  # Hangul
    (0x0600, 0x06FF),  # Arabic
]


def is_non_english(text: str) -> bool:
    """Heuristic: returns True when the majority of letter-chars are in a
    non-Latin script we don't have a keyword taxonomy for."""
    if not text:
        return False
    non_latin = 0
    latin = 0
    for ch in text:
        cp = ord(ch)
        if 0x41 <= cp <= 0x5A or 0x61 <= cp <= 0x7A:
            latin += 1
            continue
        for lo, hi in _NON_LATIN_RANGES:
            if lo <= cp <= hi:
                non_latin += 1
                break
    if non_latin == 0:
        return False
    # Treat as non-English when non-Latin letters outnumber Latin ones —
    # short transliterated English bleeding into a Hindi review still gets
    # routed through the rating path.
    return non_latin > latin


# ============================================================
# NEGATION DETECTION
# ============================================================
def _find_negation_spans(text_lower: str) -> List[Tuple[int, int]]:
    """Find spans of text affected by negation words.
    Returns list of (start, end) character positions where sentiment is inverted.

    Previously used text_lower.find(word), which always returns the FIRST global
    occurrence — so multiple "not"s in one review collapsed into the same span
    and later negations were missed. Walk an explicit cursor through the text
    so each negation's span starts at its own character offset.
    """
    spans = []
    cursor = 0
    n = len(text_lower)
    for match in re.finditer(r"\S+", text_lower):
        word = match.group(0)
        word_start = match.start()
        clean_word = re.sub(r'[^a-z\']', '', word)
        if clean_word not in NEGATION_WORDS:
            continue
        # Span ends NEGATION_WINDOW words later. Use a forward regex pass from
        # this negation onward to count words without re-splitting the whole text.
        end_pos = word_start + len(word)
        words_left = NEGATION_WINDOW
        for follower in re.finditer(r"\S+", text_lower[end_pos:]):
            if words_left <= 0:
                break
            end_pos = end_pos + follower.end()
            words_left -= 1
        spans.append((word_start, min(end_pos, n)))
        cursor = end_pos
    return spans


def _is_in_negation(text_lower: str, keyword_pos: int, negation_spans: List[Tuple[int, int]]) -> bool:
    """Check if a keyword position falls within a negation window."""
    for start, end in negation_spans:
        if start <= keyword_pos <= end:
            return True
    return False


# ============================================================
# INDIRECT SENTIMENT DETECTION
# ============================================================
def detect_indirect_sentiment(text: str) -> Optional[str]:
    """Detect indirect positive/negative sentiment from patterns.
    Returns 'NEGATIVE', 'POSITIVE', or None."""
    text_lower = text.lower()
    
    for pattern in INDIRECT_NEGATIVE_PATTERNS:
        if re.search(pattern, text_lower):
            return "NEGATIVE"
    
    for pattern in INDIRECT_POSITIVE_PATTERNS:
        if re.search(pattern, text_lower):
            return "POSITIVE"
    
    return None


# ============================================================
# MULTI-LABEL CLASSIFICATION (v8 core)
# ============================================================
def classify_all_labels(text: str, rating: int = 3, product_name: str = "") -> List[Dict]:
    """
    Multi-label classification: returns ALL matching categories with scores.
    
    Each label has:
    - category: Main category
    - subcategory: Specific subcategory
    - confidence: 0-1 confidence score
    - impact: 0-1 impact score (how critical is this finding)
    - keywords_matched: Which keywords triggered this classification
    - is_negated: Whether the keyword was found in a negation context
    - sentiment_direction: 'positive', 'negative', 'neutral' for this specific aspect
    """
    def _rating_only(r_in, conf_bump=0.0, label="General_Feedback"):
        try:
            r = int(r_in)
        except (TypeError, ValueError):
            r = 3
        if r >= 4:
            sentiment, conf = "positive", 0.7 + conf_bump
        elif r <= 2:
            sentiment, conf = "negative", 0.7 + conf_bump
        else:
            sentiment, conf = "neutral", 0.4
        return [{"category": "General", "subcategory": label,
                 "confidence": min(0.95, conf), "impact": 0.2,
                 "keywords_matched": [], "is_negated": False,
                 "sentiment_direction": sentiment}]

    if not text or len(text.strip()) < 3:
        # Empty/very-short text: the rating star is the only signal we have.
        return _rating_only(rating)

    if is_non_english(text):
        # English keyword taxonomy can't classify Hindi/Tamil/Telugu reviews —
        # match the rating star and skip the keyword pass so we don't ship
        # noise labels.
        return _rating_only(rating)
    
    text_lower = text.lower()
    negation_spans = _find_negation_spans(text_lower)
    indirect = detect_indirect_sentiment(text)
    
    all_matches = []
    seen_subcats = set()  # Avoid duplicate subcategories
    
    # Score every subcategory in the taxonomy
    for category, subcats in FULL_TAXONOMY.items():
        for subcategory, keywords in subcats.items():
            matched_keywords = []
            negated_count = 0
            total_keyword_weight = 0
            
            # Sort keywords longest first for greedy matching
            sorted_keywords = sorted(keywords, key=len, reverse=True)
            
            for kw in sorted_keywords:
                kw_lower = kw.lower()
                # Find all occurrences of this keyword
                start = 0
                while True:
                    pos = text_lower.find(kw_lower, start)
                    if pos == -1:
                        break
                    
                    # Check if this is a word boundary match (not partial)
                    before_ok = pos == 0 or not text_lower[pos-1].isalpha()
                    after_pos = pos + len(kw_lower)
                    after_ok = after_pos >= len(text_lower) or not text_lower[after_pos].isalpha()
                    
                    if before_ok and after_ok:
                        is_negated = _is_in_negation(text_lower, pos, negation_spans)
                        matched_keywords.append(kw)
                        if is_negated:
                            negated_count += 1
                        # Longer keywords = higher weight
                        weight = len(kw.split())
                        total_keyword_weight += weight
                    
                    start = pos + 1
            
            if matched_keywords:
                # Calculate confidence
                # More keywords matched = higher confidence
                # Longer keywords = higher confidence
                unique_keywords = list(set(matched_keywords))
                base_confidence = min(0.95, 0.5 + (total_keyword_weight * 0.1))
                
                # Boost for multi-word keyword matches
                multi_word_count = sum(1 for kw in unique_keywords if len(kw.split()) >= 2)
                if multi_word_count > 0:
                    base_confidence = min(0.95, base_confidence + 0.05 * multi_word_count)
                
                # Get impact score
                impact = IMPACT_SCORES.get(subcategory, 0.3)
                
                # Determine sentiment direction for this specific aspect
                is_negated = negated_count > len(matched_keywords) / 2
                
                # Sentiment direction based on context
                if category in ("Safety", "Customer Service"):
                    # Safety/service issues: negation = "no problem" = positive
                    sentiment_dir = "positive" if is_negated else "negative"
                elif subcategory in ("Stopped_Working", "Manufacturing_Defects"):
                    sentiment_dir = "positive" if is_negated else "negative"
                elif subcategory in ("Good_Packaging", "Good_Service", "Fast_Delivery"):
                    sentiment_dir = "negative" if is_negated else "positive"
                elif subcategory in ("Overall_Quality", "Build_Quality", "Durability"):
                    # These can be positive or negative based on rating context
                    if rating >= 4:
                        sentiment_dir = "positive"
                    elif rating <= 2:
                        sentiment_dir = "negative"
                    else:
                        sentiment_dir = "neutral"
                else:
                    # Default: use rating as signal
                    if rating >= 4:
                        sentiment_dir = "positive"
                    elif rating <= 2:
                        sentiment_dir = "negative"
                    else:
                        sentiment_dir = "neutral"
                
                if subcategory not in seen_subcats:
                    seen_subcats.add(subcategory)
                    all_matches.append({
                        "category": category,
                        "subcategory": subcategory,
                        "confidence": round(base_confidence, 3),
                        "impact": impact,
                        "keywords_matched": unique_keywords[:5],  # Top 5 for readability
                        "is_negated": is_negated,
                        "sentiment_direction": sentiment_dir,
                    })
    
    # Sort by priority: impact * confidence (highest priority first)
    all_matches.sort(key=lambda m: m["impact"] * m["confidence"], reverse=True)
    
    # If no matches found, return General
    if not all_matches:
        sentiment_dir = "neutral"
        if indirect == "NEGATIVE" or rating <= 2:
            sentiment_dir = "negative"
        elif indirect == "POSITIVE" or rating >= 4:
            sentiment_dir = "positive"
        
        return [{"category": "General", "subcategory": "General_Feedback",
                 "confidence": 0.3, "impact": 0.2, "keywords_matched": [],
                 "is_negated": False, "sentiment_direction": sentiment_dir}]
    
    return all_matches


def classify_with_rules_v7(text: str, rating: int, product_name: str = "") -> Tuple[str, str, float, str]:
    """
    v7-compatible interface: returns PRIMARY category (highest impact * confidence).
    Also stores all labels for the multi-label enrichment.
    """
    labels = classify_all_labels(text, rating, product_name)
    
    if not labels:
        return "General", "General_Feedback", 0.3, "[v8] No match"
    
    primary = labels[0]
    
    # Build reasoning
    other_labels = [f"{l['category']}/{l['subcategory']}" for l in labels[1:3]]
    reasoning = f"[v8] Primary: {primary['keywords_matched'][:3]}"
    if other_labels:
        reasoning += f" | Also: {', '.join(other_labels)}"
    if primary["is_negated"]:
        reasoning += " [NEGATED]"
    
    return primary["category"], primary["subcategory"], primary["confidence"], reasoning


# Alias for compatibility
def classify_with_rules_v6(text: str, rating: int, product_name: str = "") -> Tuple[str, str, float, str]:
    return classify_with_rules_v7(text, rating, product_name)


def get_sentiment(text: str, rating: float) -> str:
    """Determine sentiment from rating and text, with indirect detection."""
    try:
        rating = float(rating) if rating else 3.0
    except (ValueError, TypeError):
        rating = 3.0
    
    # Check indirect sentiment first
    indirect = detect_indirect_sentiment(text)
    
    if rating >= 4:
        return "POSITIVE"
    elif rating <= 2:
        return "NEGATIVE"
    else:
        # For 3-star, use indirect sentiment or text analysis
        if indirect:
            return indirect
        
        text_lower = text.lower()
        positive_words = ['good', 'nice', 'excellent', 'great', 'love', 'best', 'awesome', 
                         'fantastic', 'recommend', 'perfect', 'superb', 'amazing', 'brilliant',
                         'wonderful', 'happy', 'satisfied', 'worth']
        negative_words = ['bad', 'worst', 'terrible', 'poor', 'hate', 'avoid', 'useless', 
                         'waste', 'disappointed', 'regret', 'pathetic', 'defective', 'broken',
                         'leaking', 'dangerous']
        
        pos_count = sum(1 for w in positive_words if w in text_lower)
        neg_count = sum(1 for w in negative_words if w in text_lower)
        
        if pos_count > neg_count:
            return "POSITIVE"
        elif neg_count > pos_count:
            return "NEGATIVE"
        return "NEUTRAL"


# Main classification function
def classify_review(text: str, product_name: str = "", rating: float = 3.0, 
                    provider: str = "rules", api_key: str = "") -> Tuple[str, str, float, str]:
    """Classify a review and return (category, subcategory, confidence, reasoning)."""
    return classify_with_rules_v7(text, int(rating) if rating else 3, product_name)


# Export for taxonomy file
def save_taxonomy():
    """Save taxonomy to JSON file."""
    taxonomy_file = SCRIPT_DIR / "taxonomy_v8.json"
    with open(taxonomy_file, 'w', encoding='utf-8') as f:
        json.dump(FULL_TAXONOMY, f, indent=2)
    print(f"Saved taxonomy to {taxonomy_file}")


if __name__ == "__main__":
    save_taxonomy()
    
    # Test multi-label classification
    test_reviews = [
        ("lid broke, handle is cheap, and delivery was late", 1),
        ("Not bad. Could have been better quality but does the job", 3),
        ("No complaints! Working perfectly. Worth every penny", 5),
        ("Gasket leaked causing steam burns on my hand. Dangerous!", 1),
        ("Good product but delivery was damaged. Had to return.", 3),
        ("Nothing special. Just okay.", 3),
        ("Excellent build quality, easy to clean, value for money", 5),
    ]
    
    print("\n🧪 Testing v8 Multi-Label Classification:")
    print("=" * 70)
    for text, rating in test_reviews:
        labels = classify_all_labels(text, rating)
        print(f"\n📝 \"{text[:60]}...\" (★{rating})")
        for i, label in enumerate(labels[:4]):
            neg = " [NEGATED]" if label["is_negated"] else ""
            print(f"   {'→' if i==0 else '  '} {label['category']}/{label['subcategory']} "
                  f"(conf={label['confidence']}, impact={label['impact']}, "
                  f"dir={label['sentiment_direction']}{neg})")
            print(f"     Keywords: {label['keywords_matched']}")
        
        indirect = detect_indirect_sentiment(text)
        if indirect:
            print(f"   🔍 Indirect sentiment: {indirect}")
