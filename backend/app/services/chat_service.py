"""
Vastra AI Style Advisor.

Modes:
  • OpenAI  — real OpenAI API (e.g. gpt-4o-mini) when OPENAI_API_KEY is provided
  • Claude  — real Anthropic API when ANTHROPIC_API_KEY starts with "sk-ant-"
  • Mock    — scripted fashion intelligence fallback when keys are absent
"""
import json
import logging
import os
import httpx

from anthropic import Anthropic

logger = logging.getLogger(__name__)


def _get_anthropic_client() -> Anthropic:
    return Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


# ── Profile extraction ────────────────────────────────────────────────────────

def _extract_profile(messages: list) -> dict:
    text = " ".join(m["content"].lower() for m in messages if m["role"] == "user")
    profile: dict = {}

    if any(w in text for w in ["petite", "short", "under 5", "5'1", "5'0", "4'"]):
        profile["height"] = "petite"
    elif any(w in text for w in ["tall", "5'6", "5'7", "5'8", "5'9", "6'"]):
        profile["height"] = "tall"
    elif any(w in text for w in ["regular", "average", "medium height", "5'2", "5'3", "5'4", "5'5"]):
        profile["height"] = "regular"

    if any(w in text for w in ["fair", "light skin", "pale", "fair skin"]):
        profile["skinTone"] = "fair"
    elif any(w in text for w in ["wheatish", "wheat", "medium complexion", "medium skin", "golden"]):
        profile["skinTone"] = "wheatish"
    elif any(w in text for w in ["dusky", "dark", "deep skin", "brown skin", "dark complexion"]):
        profile["skinTone"] = "dusky"

    if any(w in text for w in ["wedding", "ceremony", "bride", "shaadi"]):
        profile["occasion"] = "wedding"
    elif any(w in text for w in ["office", "work", "professional", "corporate", "meeting"]):
        profile["occasion"] = "office"
    elif any(w in text for w in ["party", "night out", "club", "celebration", "birthday"]):
        profile["occasion"] = "party"
    elif any(w in text for w in ["festive", "festival", "diwali", "puja", "navratri"]):
        profile["occasion"] = "festive"
    elif any(w in text for w in ["casual", "everyday", "daily", "weekend", "relaxed", "comfortable"]):
        profile["occasion"] = "casual"

    if any(w in text for w in ["hourglass", "curvy", "balanced"]):
        profile["bodyShape"] = "hourglass"
    elif any(w in text for w in ["pear", "wider hips", "hip heavy"]):
        profile["bodyShape"] = "pear"
    elif any(w in text for w in ["apple", "midsection", "tummy"]):
        profile["bodyShape"] = "apple"
    elif any(w in text for w in ["rectangle", "straight", "athletic build"]):
        profile["bodyShape"] = "rectangle"

    return profile


# ── Recommendation matrix ─────────────────────────────────────────────────────

_RECS: dict = {
    ("petite", "fair", "wedding"): (["vtx-frock-floral", "vtx-top-slimfit"], "The Aditi Floral A-Line frock is a dream for petite frames — the A-line silhouette creates beautiful length, and the French blue floral is absolutely gorgeous against fair skin. The Blush Pink slim-fit top is a great second option if you prefer separates for a more flexible look."),
    ("petite", "fair", "casual"): (["vtx-top-slimfit", "vtx-pants-beige"], "The Blush Pink slim-fit top with the Linen Wide-Leg Trousers is a chic casual pairing. The high waist on the trousers adds lovely length to your frame — perfect for your height!"),
    ("petite", "fair", "office"): (["vtx-top-vneck", "vtx-pants-beige"], "The navy V-neck collared knit top is structured and polished — great for office. Pair it with the high-waisted linen trousers; the vertical stripe detail elongates your silhouette beautifully."),
    ("petite", "fair", "party"): (["vtx-frock-floral"], "A floral A-line frock for a party? Absolutely yes! The French blue will make you stand out, and the A-line cut gives you that elegant flowy movement while flattering your petite frame perfectly."),
    ("petite", "wheatish", "wedding"): (["vtx-frock-floral", "vtx-top-checked"], "For your warm wheatish skin tone, the French blue floral frock creates a beautiful contrast — you'll absolutely glow! If you'd prefer separates, the Caramel Checked top is a stunning match for wheatish skin."),
    ("petite", "wheatish", "casual"): (["vtx-top-tieup", "vtx-pants-beige"], "The Olive Green tie-up top is *perfect* for your skin tone — earthy greens bring out the warmth in wheatish complexions beautifully. Pair it with the high-waisted linen trousers for a chic everyday look."),
    ("petite", "wheatish", "office"): (["vtx-top-checked", "vtx-pants-beige"], "The Caramel Checked collared top is a wonderful office pick — that warm brown checks complement wheatish skin tone gorgeously, and it has a polished collar that reads professional."),
    ("petite", "dusky", "wedding"): (["vtx-frock-textured", "vtx-top-vneck"], "For your gorgeous dusky complexion and a wedding, the Powder Blue Textured Midi Frock is *chef's kiss* — jewel-adjacent blues and bold structure make dusky skin tones radiate. The Navy V-neck is a stunning alternative if you prefer a two-piece look."),
    ("petite", "dusky", "casual"): (["vtx-top-tieup", "vtx-top-vneck"], "Olive green and navy are both brilliant for dusky skin tones — they make your complexion glow. The Tie-Up Halter Top is a playful summer pick, and the Navy V-neck is more structured if you want something versatile."),
    ("petite", "dusky", "office"): (["vtx-top-vneck", "vtx-pants-beige"], "The Navy V-neck knit top is a powerhouse for dusky skin — the deep navy creates a stunning contrast and the structured collar looks incredibly polished at the office."),
    ("regular", "fair", "wedding"): (["vtx-frock-textured", "vtx-frock-floral"], "You have the most versatile frame — both our frocks will look beautiful on you! The Powder Blue Textured Midi with puff sleeves is perfect for an elevated wedding look. The Aditi Floral is a lighter, breezier option if the ceremony is outdoors."),
    ("regular", "fair", "casual"): (["vtx-top-wrap", "vtx-pants-beige"], "The Sky Blue Wrap Top with bishop cuffs is elegant yet relaxed — perfect for your fair skin. Pair it with the linen wide-leg trousers and you have a polished casual look that works for brunch, errands, or a day out."),
    ("regular", "fair", "office"): (["vtx-top-vneck", "vtx-pants-flared"], "The structured Navy V-neck with the High-Waisted Flared Trousers is a sleek, professional combination. The flared silhouette balances beautifully with your regular height — very editorial."),
    ("regular", "fair", "party"): (["vtx-frock-textured"], "The Puff-Sleeve Textured Midi Frock is made for a party! The structured puff sleeves and embossed jacquard texture read 'statement piece' — you'll absolutely own the room."),
    ("regular", "wheatish", "wedding"): (["vtx-frock-floral", "vtx-top-checked"], "The French Blue Floral Frock is a classic choice — the blue against wheatish skin is timeless and elegant for a wedding. If you prefer separates, the Caramel Checked top paired with wide-leg trousers creates a chic, coordinated look."),
    ("regular", "wheatish", "casual"): (["vtx-top-tieup", "vtx-top-checked"], "Olive green and caramel are your best friends — both these shades complement wheatish skin tones beautifully. The Tie-Up Halter Top is perfect for warm days; the Caramel Checked Top for cooler ones."),
    ("regular", "wheatish", "office"): (["vtx-top-checked", "vtx-pants-flared"], "The Caramel Checked Collared Top is a brilliant office piece — structured, warm-toned, and polished. Pair it with the Flared Tailored Trousers for a complete professional look."),
    ("regular", "dusky", "wedding"): (["vtx-frock-floral", "vtx-top-vneck"], "The French Blue Aditi Frock is stunning on dusky skin tones — the bold blue creates a jewel-tone effect that makes your complexion absolutely glow at a wedding. The Navy V-neck top is a strong alternative for a more modern look."),
    ("regular", "dusky", "casual"): (["vtx-top-tieup", "vtx-top-wrap"], "Olive green and sky blue stripes are brilliant colour choices for your complexion. The Tie-Up Halter is vibrant and playful; the Wrap Top is more elevated. Both will look gorgeous on you!"),
    ("regular", "dusky", "office"): (["vtx-top-vneck", "vtx-pants-flared"], "The Navy V-neck Knit Top is a showstopper for dusky skin in an office setting — the deep navy reads authoritative and chic. Pair it with the flared trousers for a complete professional look."),
    ("tall", "fair", "wedding"): (["vtx-frock-textured", "vtx-pants-beige"], "Oh, tall frames can truly rock structured midi dresses — the Puff-Sleeve Textured Midi Frock will look *incredible* on you. The powder blue and bold silhouette are made for tall figures at weddings! As an alternative, the wide-leg linen trousers with a wrap top make a very elegant ensemble."),
    ("tall", "fair", "casual"): (["vtx-pants-beige", "vtx-top-wrap"], "Wide-leg trousers are absolutely your thing — tall frames carry them effortlessly. The Linen Striped Wide-Legs with the Sky Blue Wrap Top is a chic, fashion-forward casual look. That sky blue is gorgeous against fair skin!"),
    ("tall", "fair", "office"): (["vtx-pants-flared", "vtx-top-vneck"], "The Flared Tailored Trousers look especially striking on tall frames — the dramatic flare is something only you can truly pull off. Pair with the Navy V-neck for a polished, editorial office look."),
    ("tall", "wheatish", "wedding"): (["vtx-frock-floral", "vtx-pants-flared"], "The Aditi Floral Frock on a tall frame at a wedding — absolutely stunning! The flowy A-line will move beautifully at your height. Alternatively, the Flared Trousers with the Olive Green or Caramel top creates a very chic modern wedding guest look."),
    ("tall", "wheatish", "casual"): (["vtx-pants-beige", "vtx-top-tieup"], "Wide-leg linen trousers are *made* for tall figures — and paired with the Olive Green Tie-Up Top, that earthy colour palette will complement your wheatish skin beautifully for a relaxed, stylish day."),
    ("tall", "wheatish", "office"): (["vtx-pants-flared", "vtx-top-checked"], "The Flared Trousers + Caramel Checked Top is a power combination for tall frames at the office — the warm caramel tones are perfect for wheatish skin, and the structured silhouette looks very polished."),
    ("tall", "dusky", "wedding"): (["vtx-frock-textured", "vtx-pants-flared"], "A tall frame with dusky skin in the Textured Midi Frock — honestly one of the most striking combinations possible! The powder blue against deep skin tones creates a jewel-toned contrast that will have every eye in the room on you. If you prefer separates, the flared trousers + navy top is equally commanding."),
    ("tall", "dusky", "casual"): (["vtx-pants-flared", "vtx-top-tieup"], "Wide-leg flared trousers look *incredible* on tall frames, and the Olive Green Tie-Up Top is a gorgeous earthy complement to dusky skin. This is a very fashion-forward casual look!"),
    ("tall", "dusky", "office"): (["vtx-pants-flared", "vtx-top-vneck"], "This is one of my favourite combinations — Flared Tailored Trousers + Navy V-neck on a tall frame with dusky skin. The navy creates a striking contrast, the silhouette is powerful, and the whole look reads very senior and stylish."),
    ("tall", "dusky", "party"): (["vtx-frock-floral", "vtx-frock-textured"], "Two words: show-stopper. The French Blue Floral Frock on a tall frame with dusky skin is exactly the kind of look people remember. The blue creates a jewel-tone effect against your complexion. The Textured Midi is a great alternative if you want something more structured."),
}

_FALLBACK_RECS: dict = {
    "fair": (["vtx-frock-floral", "vtx-top-slimfit", "vtx-top-wrap"], "Based on your fair complexion, I'm drawn to our cooler, softer tones — the French Blue Floral Frock, the Blush Pink Top, and the Sky Blue Wrap Top will all complement you beautifully."),
    "wheatish": (["vtx-top-tieup", "vtx-top-checked", "vtx-pants-beige"], "Earthy, warm tones look stunning on wheatish skin! The Olive Green Tie-Up Top, the Caramel Checked Top, and the Oatmeal Linen Trousers are all made for your complexion."),
    "dusky": (["vtx-top-vneck", "vtx-frock-floral", "vtx-top-tieup"], "Jewel tones and bold colours are your superpower! Navy, French Blue, and Olive Green all make dusky skin tones absolutely radiate. These three pieces are a great starting point."),
    "petite": (["vtx-frock-floral", "vtx-pants-beige", "vtx-top-slimfit"], "For petite frames, A-line silhouettes and high-waisted cuts are your best friend — they create beautiful length. Here are three pieces that'll look especially lovely on you."),
    "regular": (["vtx-frock-textured", "vtx-top-wrap", "vtx-pants-flared"], "You have a wonderfully versatile frame — most of our collection will look great on you! Here are three of my current favourites that I think you'll love."),
    "tall": (["vtx-pants-flared", "vtx-frock-textured", "vtx-pants-beige"], "Tall frames can wear wide-leg trousers and bold silhouettes like nobody else! Here are three pieces that'll look especially striking at your height."),
}


def _product_tags(ids: list) -> str:
    return " ".join(f"[PRODUCT:{i}]" for i in ids)


def _profile_tag(profile: dict) -> str:
    if not profile:
        return ""
    return f" [PROFILE:{json.dumps(profile, separators=(',', ':'))}]"


# ── Mock chat ─────────────────────────────────────────────────────────────────

def mock_chat(messages: list, profile: dict) -> str:
    extracted = _extract_profile(messages)
    merged = {**profile, **extracted}

    user_turn_count = sum(1 for m in messages if m["role"] == "user")
    last_user = messages[-1]["content"].lower() if messages else ""

    h = merged.get("height")
    s = merged.get("skinTone")
    o = merged.get("occasion")

    profile_tag = _profile_tag(merged) if merged != profile else ""

    # Priority Action Checks
    if any(w in last_user for w in ["start over", "reset", "again", "new"]):
        return (
            "Of course! Let's start fresh. What brings you in today — are you shopping for a specific occasion, or would you like some general style advice? "
            "[CHIPS:Wedding / Festive|Office / Work|Casual / Everyday|Party / Night out|Style advice]"
        )

    if any(w in last_user for w in ["try on", "tryon", "virtual"]):
        return (
            "Absolutely! Our AI Virtual Try-On lets you see exactly how any garment looks on *you* — just upload a photo and the AI drapes the outfit on your image. "
            "Head to any product page and tap the ✨ Try On button, or click the Try On link on any product card above!"
        )

    if any(w in last_user for w in ["sizing", "size", "what size", "fit"]):
        return (
            "All our garments come in S, M, L, and XL. Here's a quick guide:\n"
            "• S — Bust 34\", Waist 28\"\n• M — Bust 36\", Waist 30\"\n"
            "• L — Bust 38\", Waist 32\"\n• XL — Bust 40\", Waist 34\"\n\n"
            "When in doubt, size up — our fabrics are designed to drape beautifully with a little extra room. "
            "The Virtual Try-On is also a great way to visualise fit before ordering!"
        )

    if any(w in last_user for w in ["more", "other", "different", "show more", "options"]):
        if s:
            fallback = _FALLBACK_RECS.get(s)
            if fallback:
                ids, _ = fallback
                return (
                    "Here are a few more pieces I think you'll love based on your complexion — each one is a strong match for your skin tone: "
                    + _product_tags(ids)
                    + " [CHIPS:Tell me why these suit me|How to try on|Start over]"
                    + _profile_tag(merged)
                )

    if any(w in last_user for w in ["offer", "offers", "discount", "sale", "current offers"]):
        return (
            "We have some amazing offers running right now! 🎊\n\n"
            "• ✨ **WELCOME10** for 10% off your first purchase\n"
            "• 🛍️ **Buy 2, Get 15% Off** on all tops\n"
            "• 🚚 **Free Shipping** on orders over ₹2,999\n\n"
            "Would you like me to suggest some pieces to help you make the most of these offers?"
            " [CHIPS:Yes, show me|How to try on|Start over]"
            + profile_tag
        )

    if any(w in last_user for w in ["why", "tell me why", "suit me", "explain"]):
        ids = ["vtx-frock-floral", "vtx-pants-beige"]
        if s and _FALLBACK_RECS.get(s):
            ids = _FALLBACK_RECS.get(s)[0][:2]
        return (
            "Absolutely! I look at three things: your height, your skin tone, and the occasion. "
            "For instance, based on your profile, I selected these pieces because their colours "
            "complement your complexion beautifully, and the silhouettes are tailored to flatter your frame. "
            "Here they are again so you can see the details and Try them on! "
            + _product_tags(ids)
            + " [CHIPS:How to try on|Tell me about sizing|Show more options]"
            + _profile_tag(merged)
        )

    if any(w in last_user for w in ["stripe", "stripes"]):
        return (
            "Great question! Vertical stripes are a petite person's best friend — they draw the eye up and down, creating the illusion of height. "
            "For tall frames, horizontal or bold diagonal stripes add wonderful presence and width. "
            "Our Linen Striped Wide-Leg Trousers have a subtle vertical stripe that looks chic on almost every frame! "
            "[PRODUCT:vtx-pants-beige]" + profile_tag
        )

    if any(w in last_user for w in ["colour", "color", "colour suit", "what colour"]):
        if s == "dusky":
            return (
                "For dusky skin tones, jewel tones are absolutely magical — navy, emerald, royal blue, deep purple. "
                "Bold brights like olive green and sky blue also make your complexion radiate. "
                "What to avoid: muted, greyed-out, or dusty tones — they can look flat against rich skin. "
                "Here are two pieces from our collection that'll look stunning on you: "
                "[PRODUCT:vtx-top-vneck] [PRODUCT:vtx-frock-floral]" + profile_tag
            )
        elif s == "wheatish":
            return (
                "Wheatish skin tones are so beautifully warm — earth tones, coral, mustard, olive green, and teal all complement them perfectly. "
                "The caramel and olive pieces in our collection were practically made for you! "
                "[PRODUCT:vtx-top-tieup] [PRODUCT:vtx-top-checked]" + profile_tag
            )
        elif s == "fair":
            return (
                "Fair skin tones glow beautifully in cool pastels and soft tones — powder blue, blush pink, lavender, and French blue are all wonderful. "
                "Here are two of our pieces that'll look especially lovely: "
                "[PRODUCT:vtx-frock-floral] [PRODUCT:vtx-top-slimfit]" + profile_tag
            )
        return "Colour choice depends a lot on your skin tone! Could you tell me — is your skin tone fair, wheatish, or dusky? [CHIPS:Fair|Wheatish|Dusky]"

    if any(w in last_user for w in ["body shape", "body type", "figure", "pear", "hourglass", "apple", "rectangle"]):
        bs = merged.get("bodyShape", "")
        if "pear" in last_user or bs == "pear":
            return (
                "For pear-shaped frames (wider hips), the goal is to balance the silhouette by drawing attention upward. "
                "A-line frocks work beautifully — they skim the hips without clinging. "
                "Structured shoulders and wide-neck tops also help balance proportions. "
                "The Aditi Floral Frock is a brilliant pick for you! [PRODUCT:vtx-frock-floral]"
                + _profile_tag({**merged, "bodyShape": "pear"})
            )
        elif "hourglass" in last_user or bs == "hourglass":
            return (
                "Hourglass frames are all about showing off that beautiful waist! Wrap styles, fitted tops, and belted dresses are your best look. "
                "The Wrap Style Top with a tucked-in or belted finish would be gorgeous — and the slim-fit top too! "
                "[PRODUCT:vtx-top-wrap] [PRODUCT:vtx-top-slimfit]"
                + _profile_tag({**merged, "bodyShape": "hourglass"})
            )
        elif "apple" in last_user or bs == "apple":
            return (
                "For apple-shaped frames, the key is creating a defined silhouette with V-necks, flowy fabrics, and empire-waist cuts. "
                "The V-neck Knit Top is a brilliant choice — it draws the eye vertically and creates a slimming, elongated look. "
                "[PRODUCT:vtx-top-vneck]"
                + _profile_tag({**merged, "bodyShape": "apple"})
            )
        return (
            "Knowing your body shape helps me recommend the most flattering cuts! Which describes you best? "
            "[CHIPS:Hourglass (balanced curves)|Pear (wider hips)|Apple (midsection fullness)|Rectangle (straight, athletic)]"
        )

    if h and s and o:
        rec = _RECS.get((h, s, o))
        if rec:
            ids, why = rec
            return (
                f"{why}\n\n" + _product_tags(ids)
                + "\n\nWould you like to explore more options, or shall I guide you to the virtual try-on for any of these?"
                + " [CHIPS:Show more options|How to try on|Tell me about sizing]"
                + _profile_tag(merged)
            )
        fallback = _FALLBACK_RECS.get(s) or _FALLBACK_RECS.get(h)
        if fallback:
            ids, why = fallback
            return (
                f"{why}\n\n" + _product_tags(ids)
                + " [CHIPS:Show more options|How to try on]"
                + _profile_tag(merged)
            )

    if not o and user_turn_count == 1:
        return (
            "Lovely! I'd love to help you find the perfect look. "
            "First — what's the occasion you're shopping for? "
            "[CHIPS:Wedding / Festive|Office / Work|Casual / Everyday|Party / Night out]"
        )

    if o and not h:
        occasion_text = {"wedding": "a wedding", "office": "office", "casual": "everyday wear", "party": "a party", "festive": "a festive occasion"}.get(o, "this occasion")
        return (
            f"Perfect, {occasion_text} — great taste! Now, what's your height? This helps me suggest the most flattering silhouettes for you. "
            "[CHIPS:Petite (under 5'2\")|Regular (5'2\"–5'6\")|Tall (5'6\"+)]"
            + _profile_tag(merged)
        )

    if h and not s:
        height_text = {"petite": "Petite frames have such an elegant look", "regular": "Regular height is wonderfully versatile", "tall": "Tall frames can wear such beautiful silhouettes"}.get(h, "")
        return (
            f"{height_text} — I have some wonderful ideas already! One more thing: what's your skin tone? "
            "This helps me match the most flattering colours from our collection. "
            "[CHIPS:Fair|Wheatish / Medium|Dusky]" + _profile_tag(merged)
        )

    if h and s and not o:
        return (
            "Almost there! What's the occasion you're dressing for? "
            "[CHIPS:Wedding / Festive|Office / Work|Casual / Everyday|Party / Night out]"
            + _profile_tag(merged)
        )

    return (
        "I'd love to help you find the perfect look! Could you tell me what you're shopping for today? "
        "[CHIPS:Wedding / Festive|Office / Work|Casual / Everyday|Party / Night out|Style advice]"
    )


# ── Live Claude API ────────────────────────────────────────────────────────────

_CATALOG = """
PRODUCT CATALOG (9 items — always recommend from this list only):

1. ID: vtx-frock-floral | Name: Aditi Floral A-Line Frock | Category: dress
   Fabric: Pure Chiffon Crepe | Colour: French Blue Floral | Price: ₹2,499
   Silhouette: A-line | Best for: petite/regular frames, fair/dusky skin, weddings/parties

2. ID: vtx-frock-textured | Name: Puff-Sleeve Textured Midi Frock | Category: dress
   Fabric: Embossed Jacquard Cotton | Colour: Powder Blue | Price: ₹2,999
   Silhouette: Structured midi | Best for: tall/regular frames, dusky/wheatish skin, weddings/parties

3. ID: vtx-pants-beige | Name: Linen Striped Wide-Leg Trousers | Category: pants
   Fabric: Premium Linen | Colour: Oatmeal Beige | Price: ₹1,999
   Silhouette: High-waisted wide-leg with vertical stripes | Best for: all heights, casual/office

4. ID: vtx-pants-flared | Name: High-Waisted Flared Tailored Trousers | Category: pants
   Fabric: Tailored Ponte Knit | Colour: Sand Beige | Price: ₹2,299
   Silhouette: Dramatic flared leg | Best for: tall/regular, office/formal

5. ID: vtx-top-vneck | Name: V-Neck Collared Knit Top | Category: tops
   Fabric: Knit Rib Cotton | Colour: Navy & Light Blue | Price: ₹1,499
   Best for: dusky/fair skin, apple body shape, office/casual

6. ID: vtx-top-tieup | Name: Tie-Up Neck Fitted Top | Category: tops
   Fabric: Crinkled Chiffon | Colour: Lime Olive Green | Price: ₹1,299
   Best for: wheatish/dusky skin, hourglass, casual/party

7. ID: vtx-top-checked | Name: Checked Collared Button Top | Category: tops
   Fabric: Gingham Seersucker | Colour: Caramel Brown | Price: ₹1,399
   Best for: wheatish skin, office/casual

8. ID: vtx-top-slimfit | Name: Slim Fit Short Sleeved Top | Category: tops
   Fabric: Stretch Poplin | Colour: Blush Pink | Price: ₹1,699
   Best for: fair/regular skin, hourglass, casual/office

9. ID: vtx-top-wrap | Name: Wrap Style Top | Category: tops
   Fabric: Satin Crepe | Colour: Sky Blue Stripe | Price: ₹1,799
   Best for: fair/wheatish skin, hourglass/regular, casual/smart-casual
"""

_STYLING_RULES = """
STYLING RULES:
- Fair skin: cool pastels — blush pink, powder blue, French blue, sky blue, lavender
- Wheatish skin: earth tones — caramel, olive green, mustard, coral, teal
- Dusky skin: jewel tones & brights — navy, French blue, olive, sky blue, white; AVOID muted/grey tones
- Petite: A-line, high-waist, vertical patterns elongate; avoid wide-leg alone
- Regular: most styles work; balanced proportions
- Tall: wide-leg, flared, horizontal stripes, bold prints — all look great
- Hourglass: wrap styles, fitted tops show the waist
- Pear: A-line, structured shoulders, draw eye upward
- Apple: V-neck, flowy, empire waist
- Rectangle: peplum, ruffles, wrap styles create curves
"""

_SYSTEM_PROMPT_TEMPLATE = """{admin_instructions}

ACTIVE STORE OFFERS & PROMOTIONS (Mention these when relevant or when suggesting outfits):
{active_offers}

{catalog}
{styling}

TAGS YOU MUST USE:
- Multiple choice question → end with [CHIPS:Option1|Option2|Option3]
- Product recommendation → inline [PRODUCT:product-id]
- Profile fact learned → append [PROFILE:{{"key":"value"}}] silently at end

CUSTOMER PROFILE: {profile_context}
"""


def _get_catalog_context(db=None) -> str:
    """Fetch live published products from database, falling back to default boutique list."""
    if db is not None:
        try:
            from app.models.product import Product
            products = db.query(Product).filter(Product.is_published == True).all()
            if products:
                lines = [f"LIVE BOUTIQUE CATALOG ({len(products)} active products — recommend strictly from this list):"]
                for i, p in enumerate(products, 1):
                    cat_name = p.category.name if p.category else "Boutique Collection"
                    fabric = p.fabric or "Premium Luxury Fabric"
                    colour = p.colour or "Signature Shade"
                    occasion = p.occasion or "Any Occasion"
                    price = f"₹{p.price_selling:,.0f}" if p.price_selling else "₹1,999"
                    desc = p.description or ""
                    lines.append(f"{i}. ID: {p.id} | Name: {p.name} | Category: {cat_name} | Occasion: {occasion}")
                    lines.append(f"   Fabric: {fabric} | Colour: {colour} | Price: {price}")
                    if desc:
                        lines.append(f"   Description: {desc}")
                return "\n".join(lines)
        except Exception as e:
            logger.warning("Could not load products from database: %s", e)
    return _CATALOG


def _build_system_prompt(profile: dict, db=None, context_url: str = None, cart_items: list = None) -> str:
    from app.api.routes.settings import get_app_settings
    app_settings = get_app_settings()
    admin_instructions = getattr(app_settings, "stylistSystemPrompt", "You are Vastra, the personal style advisor for VastraX boutique.")
    active_offers = getattr(app_settings, "activeOffers", "Use code VASTRA10 for 10% off; Free express shipping on orders over ₹2,500.")

    catalog_text = _get_catalog_context(db)
    if profile:
        ctx = "Known: " + ", ".join(f"{k}={v}" for k, v in profile.items()) + ". Skip re-asking these."
    else:
        ctx = "No profile yet — gather naturally."
        
    if context_url:
        ctx += f"\n\nCURRENT PAGE: User is currently on this page/product URL: {context_url}. If this is a product page, proactively use this context to provide relevant styling advice for this specific item."
        
    if cart_items and len(cart_items) > 0:
        ctx += f"\n\nCART CONTEXT: User currently has these items in their cart: {', '.join([str(item) for item in cart_items])}. If relevant, suggest complementary pieces to what is already in their cart."

    return _SYSTEM_PROMPT_TEMPLATE.format(
        admin_instructions=admin_instructions,
        active_offers=active_offers,
        catalog=catalog_text,
        styling=_STYLING_RULES,
        profile_context=ctx
    )


# ── Public entry point ────────────────────────────────────────────────────────

def chat(messages: list, profile: dict, db=None, context_url: str = None, cart_items: list = None) -> str:
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    # 1. OpenAI GPT-4o-mini (Priority)
    if openai_key and not openai_key.startswith("your_"):
        try:
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            system_prompt = _build_system_prompt(profile, db=db, context_url=context_url, cart_items=cart_items)
            openai_messages = [{"role": "system", "content": system_prompt}] + messages
            
            with httpx.Client(timeout=30.0) as client:
                res = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": openai_messages,
                        "max_tokens": 512,
                        "temperature": 0.7,
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    logger.warning("OpenAI API returned %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.error("OpenAI chat error: %s", e)

    # 2. Anthropic Claude (Alternative)
    if anthropic_key and anthropic_key.startswith("sk-ant-"):
        try:
            response = _get_anthropic_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=_build_system_prompt(profile, db=db, context_url=context_url, cart_items=cart_items),
                messages=messages,
            )
            return response.content[0].text
        except Exception as e:
            logger.error("Anthropic chat error: %s", e)

    # 3. Smart Fashion Intelligence Mock Fallback
    return mock_chat(messages, profile)
