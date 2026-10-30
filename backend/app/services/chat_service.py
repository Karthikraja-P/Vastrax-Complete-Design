"""Vastra AI Stylist service. Shopper conversations use self-hosted Qwen only."""
import json
import logging
import os
import re
import httpx

logger = logging.getLogger(__name__)


_STYLING_RULES = """
SHOPPER HELP — ORDERS, SIZE, TRY-ON, AND STYLE:
- You are the VastraX store assistant as well as a stylist. Help with order updates, product discovery, size charts, virtual try-on, and practical outfit advice.
- For “where is my order?”, “check my orders”, or order tracking without an order number, use the verified recent-order account context below and call list_my_orders if more detail is needed. For a supplied order number, call get_order_status. Never claim you cannot access the shopper's orders page; the secure account lookup can check their signed-in account. If they are not signed in, explain that they must sign in to the account that placed the order. Do not invent shipping, payment, courier, or delivery updates. The shopper can also open My Account → Orders & Shipment at /storefront/account. If the verified lookup returns zero orders, say none are listed for the signed-in account and suggest checking that they signed in with the account used to place the order.
- For current product availability or recommendations, use search_products when needed and recommend only published items in the live catalog. Include the [PRODUCT:id] tag for each product you recommend.
- For questions about saved, favorited, or wishlisted items, use only the verified WISHLIST CONTEXT below. Mention specific saved products from that list and include [PRODUCT:id] tags when recommending them. If the list is empty, say you cannot see any saved items yet and invite the shopper to save a product; never invent wishlist contents.
- For sizing, retrieve the actual product size chart with get_product_details when needed, then compare it with measurements the shopper provides. Use check_inventory before claiming a size is in stock. Do not claim the chart predicts exact fit.
- For virtual try-on, explain that it is a visual preview, not a fit measurement. Give practical photo guidance when useful: use a clear, well-lit, full-length photo, stand mostly facing the camera with arms slightly away from the body, keep the outfit visible, and avoid other people or objects covering the person. Link them to the product's Virtual Try-On page when relevant.
- Give natural, useful general style advice when asked. You may discuss visual styling effects (for example, vertical stripes can create a longer visual line) as optional styling ideas, never as guaranteed effects or assumptions about the shopper's body. Personalize only from preferences or measurements the shopper actually shared; do not infer complexion, body shape, or fit from an image or product name.
- Speak like a thoughtful, attentive human in a relaxed conversation. Answer the shopper's actual question first, use earlier turns when relevant, and do not restart the conversation or repeat a question they already answered.
- For the first reply, welcome the shopper warmly and naturally, then help with what they asked; if they only greet you, greet them back and offer one easy way to begin. In later turns, acknowledge their answer or preference briefly and build on it instead of resetting to a generic pitch. Treat details already shared as known: never say they have not specified something they already told you, and never repeat the same follow-up question.
- Sound like a helpful boutique stylist: use plain, warm language, vary phrasing naturally, and show interest through relevant follow-up—not exaggerated enthusiasm, sales pressure, or repeated "How can I help?" lines. Be transparent that you are Vastra, the AI stylist; never claim to be a human employee.
- Be concise by default, but give enough detail to solve the question. Do not force a product recommendation, follow-up question, or quick-reply chips into a simple factual answer. Ask one focused question only when the answer genuinely depends on it.
- Use cart context only when it helps with pairing or the shopper asks about their bag. Never expose internal IDs or repeat the cart contents unnecessarily.
"""

_SYSTEM_PROMPT_TEMPLATE = """{admin_instructions}

ACTIVE STORE PROMOTIONS:
{active_offers}

{catalog}
{styling}

CONVERSATIONAL & CARD RENDERING DIRECTIVES:
1. STRICT CATALOG GROUNDING: Recommend ONLY garments listed in the live catalog above with valid IDs. Never invent or hallucinate products or brands.
   Do not guess missing fabric, colour, price, stock, discounts, or shipping details. If no products are published, say so plainly.
2. MANDATORY INTERACTIVE CARDS: When recommending any catalog item, ALWAYS include [PRODUCT:product-id] inline (e.g. [PRODUCT:vtx-top-wrap]). The UI uses this tag to render an interactive card with photo, price, 'Try On', and 'Add to Bag'.
3. CURATION & PACING: Recommend 1-3 tailored pieces when the shopper asks for products or a look. Keep simple answers short and expand only when useful. Ask at most ONE focused follow-up question, and do not ask for information already shared.
4. ACTIVITY-AWARE SUGGESTION CHIPS: Add [CHIPS:Opt1|Opt2|Opt3] only when useful for the next step; omit chips for greetings, direct factual answers, and completed requests.
   - If user asks about styling, sizing, or outfits: suggest styling options (e.g. [CHIPS:Show festive looks|Size guidance|Try in fitting room|Casual picks]).
   - If user asks about an order/shipping: suggest order options (e.g. [CHIPS:Track order|Return policy|Contact support]).
   - NEVER suggest order tracking chips during styling or outfit browsing.
5. PERSONALIZATION & PRIVACY: Use preferences the shopper explicitly shares in this conversation. Never infer or store complexion, body shape, age, or other sensitive traits from an image. Do not emit hidden profile tags.

CUSTOMER CONTEXT:
{profile_context}
"""


def _get_catalog_context(db=None) -> str:
    """Fetch published products only; never expose the legacy demo catalog."""
    if db is not None:
        try:
            from app.models.product import Product
            products = db.query(Product).filter(Product.is_published == True).all()
            if products:
                lines = [f"LIVE BOUTIQUE CATALOG ({len(products)} active products — recommend strictly from this list):"]
                for i, p in enumerate(products, 1):
                    cat_name = p.category.name if p.category else "Boutique Collection"
                    fabric = p.fabric or "not specified"
                    colour = p.colour or "not specified"
                    occasion = p.occasion or "not specified"
                    price = f"₹{p.price_selling:,.0f}" if p.price_selling is not None else "not specified"
                    desc = p.description or ""
                    lines.append(f"{i}. ID: {p.id} | Name: {p.name} | Category: {cat_name} | Occasion: {occasion} | Fabric: {fabric} | Colour: {colour} | Price: {price}")
                    sizes = ", ".join(v.size for v in p.variants) or "not specified"
                    if desc:
                        lines.append(f"   Sizes: {sizes} | About: {desc[:180].strip()}")
                    else:
                        lines.append(f"   Sizes: {sizes}")
                return "\n".join(lines)
        except Exception as e:
            logger.warning("Could not load products from database: %s", e)
    return "LIVE BOUTIQUE CATALOG: No published products are currently available."


def _build_system_prompt(profile: dict, db=None, context_url: str = None, cart_items: list = None, order_context: str = "", wishlist_context: str = "") -> str:
    from app.api.routes.settings import load_app_settings
    app_settings = load_app_settings(db)
    admin_instructions = getattr(app_settings, "stylistSystemPrompt", "You are Vastra, the personal style advisor for VastraX boutique.")
    active_offers = (app_settings.get("activeOffers", "") if isinstance(app_settings, dict) else getattr(app_settings, "activeOffers", "")) or "No verified offers are currently listed."

    catalog_text = _get_catalog_context(db)
    if profile:
        ctx = "Known: " + ", ".join(f"{k}={v}" for k, v in profile.items()) + ". Skip re-asking these."
    else:
        ctx = "No saved preferences. Answer the current question first; let the shopper volunteer preferences naturally and never interrogate them."
        
    if order_context:
        ctx += f"\n\nVERIFIED ACCOUNT ORDER LOOKUP:\n{order_context}\nUse this data only to answer the signed-in shopper's order question; state the recorded status and tracking details plainly."

    if wishlist_context:
        ctx += f"\n\n{wishlist_context}"

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


def _call_qwen(
    messages: list,
    system_prompt: str,
    model: str = "qwen3.5:9b-q4_K_M",
    base_url: str = "http://stylist-model:11434/api/chat",
    db=None,
    user_id: str = None,
    session_id: str = None,
) -> tuple[str, list]:
    from app.core.exceptions import BadGatewayError
    from app.services.chat_tools import CHAT_TOOLS, execute_tool

    qwen_messages = [{"role": "system", "content": system_prompt}] + messages
    executed_tools = []
    available_tools = _relevant_tools(messages, CHAT_TOOLS) if db is not None else []
    try:
        with httpx.Client(timeout=120.0, trust_env=False) as client:

            def complete(include_tools: bool):
                payload = {
                    "model": model,
                    "messages": qwen_messages,
                    "options": {"num_predict": 384, "num_ctx": 4096, "num_gpu": 28, "temperature": 0.6},
                    "think": False,
                    "stream": False,
                }
                if include_tools and available_tools:
                    payload["tools"] = available_tools
                res = client.post(base_url, json=payload)
                if res.status_code != 200:
                    logger.error("Local Qwen API returned HTTP %s", res.status_code)
                    raise BadGatewayError("Stylist model is temporarily unavailable")
                data = res.json()
                if not isinstance(data, dict):
                    raise BadGatewayError("Invalid response from local stylist model")
                if not isinstance(data.get("message"), dict):
                    raise BadGatewayError("Invalid response from local stylist model")
                return data["message"]

            response_message = complete(include_tools=True)
            tool_calls = response_message.get("tool_calls") or []
            if tool_calls:
                if db is None or len(tool_calls) > 3:
                    raise BadGatewayError("Stylist requested unsupported actions")
                # Validate the whole batch before executing anything so a malformed
                # later call cannot leave earlier side effects (e.g. cancel_order) applied.
                parsed_calls = []
                for call in tool_calls:
                    function = call.get("function") if isinstance(call, dict) else None
                    if not isinstance(function, dict) or not function.get("name"):
                        raise BadGatewayError("Invalid stylist tool call")
                    try:
                        raw_args = function.get("arguments") or {}
                        arguments = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except (TypeError, ValueError) as exc:
                        raise BadGatewayError("Invalid stylist tool arguments") from exc
                    if not isinstance(arguments, dict):
                        raise BadGatewayError("Invalid stylist tool arguments")
                    parsed_calls.append((call.get("id"), function["name"], arguments))

                qwen_messages.append(response_message)
                for call_id, name, arguments in parsed_calls:
                    result = execute_tool(name, arguments, db=db, user_id=user_id, session_id=session_id)
                    executed_tools.append({"tool": name, "arguments": arguments, "result": result})
                    tool_message = {"role": "tool", "tool_name": name, "content": json.dumps(result)}
                    if call_id:
                        tool_message["tool_call_id"] = call_id
                    qwen_messages.append(tool_message)
                response_message = complete(include_tools=False)

            reply = response_message.get("content")
            if not isinstance(reply, str) or not reply.strip():
                raise BadGatewayError("Stylist model returned an empty reply")
            return reply.strip(), executed_tools
    except BadGatewayError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.error("Local Qwen request failed: %s", type(exc).__name__)
        raise BadGatewayError("Stylist model is temporarily unavailable") from exc


_CLIENT_ROLES = ("user", "assistant")


def _sanitize_client_messages(messages: list) -> list:
    """Keep only user/assistant text turns from the client; system and tool turns stay server-side."""
    return [
        {"role": m["role"], "content": m["content"]}
        for m in messages or []
        if isinstance(m, dict) and m.get("role") in _CLIENT_ROLES and isinstance(m.get("content"), str)
    ]


def _relevant_tools(messages: list, tool_definitions: list) -> list:
    """Keep unrelated tool schemas out of the prompt so the model can retain chat history."""
    latest = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    text = latest.lower()
    selected = set()

    if re.search(r"\b(order|shipment|tracking|delivery|shipped|courier|return|exchange|refund|cancel|support|damaged)\b", text):
        selected.update({
            "list_my_orders", "get_order_status", "get_order_details", "get_shipping_estimate",
            "check_return_eligibility", "cancel_order", "create_support_ticket", "connect_to_human",
        })
    if re.search(r"\b(size chart|measurements|fabric|details|product details)\b", text):
        selected.add("get_product_details")
    if re.search(r"\b(in stock|stock|available|availability)\b", text):
        selected.add("check_inventory")
    if re.search(r"\b(show|find|recommend|suggest|looking for|shop|catalog|collection|outfit|look|product|products|dress|top|skirt|co-?ord(?:inated|s|set)?|set|occasion|colour|color|price|budget)\b", text):
        selected.add("search_products")

    return [tool for tool in tool_definitions if tool.get("function", {}).get("name") in selected]


def _order_lookup_context(messages: list, db, user_id: str | None) -> str:
    """Load verified recent-order data when the latest shopper turn asks about their orders."""
    if not messages or db is None:
        return ""
    latest = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    if not re.search(r"\b(?:my orders?|where(?:'s| is) my order|check (?:my )?orders?|track (?:my )?order|order status|orders page)\b", latest, re.IGNORECASE):
        return ""
    from app.services.chat_tools import execute_tool
    result = execute_tool("list_my_orders", {}, db=db, user_id=user_id)
    return json.dumps(result, ensure_ascii=False, separators=(",", ":"), default=str)


# ── Public entry point ────────────────────────────────────────────────────────

def _wishlist_lookup_context(messages: list, db, user_id: str | None, client_product_ids: list | None) -> str:
    """Resolve account wishlist or validated guest favorite IDs for wishlist questions."""
    if not messages or db is None:
        return ""
    latest = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    if not re.search(r"\b(?:wish\s?list(?:ed)?|favorites?|favourites?|saved (?:items?|products?|pieces?))\b", latest, re.IGNORECASE):
        return ""

    try:
        from app.models.product import Product
        from app.models.wishlist import Wishlist

        product_ids: list[str] = []
        if user_id:
            account_ids = (
                db.query(Wishlist.product_id)
                .join(Product, Product.id == Wishlist.product_id)
                .filter(Wishlist.user_id == user_id, Product.is_published.is_(True))
                .order_by(Wishlist.added_at.desc())
                .limit(24)
                .all()
            )
            product_ids.extend(product_id for (product_id,) in account_ids)

        # Guest favorites are browser-local; IDs are hints, resolved below against published products.
        for raw_id in client_product_ids or []:
            if isinstance(raw_id, str):
                clean_id = raw_id.strip()
                if clean_id and clean_id not in product_ids:
                    product_ids.append(clean_id)
            if len(product_ids) >= 24:
                break

        if not product_ids:
            if user_id:
                return "VERIFIED WISHLIST CONTEXT: The signed-in shopper's wishlist is empty. Do not claim they have saved items; invite them to save pieces they like."
            return "VERIFIED WISHLIST CONTEXT: No guest favorites were supplied and the shopper is not signed in. Do not claim to see saved items; invite them to save a product or sign in to view their account wishlist."

        products = db.query(Product).filter(
            Product.id.in_(product_ids), Product.is_published.is_(True)
        ).all()
        by_id = {product.id: product for product in products}
        ordered = [by_id[product_id] for product_id in product_ids if product_id in by_id][:12]
        if not ordered:
            return "VERIFIED WISHLIST CONTEXT: No saved products are currently published in the catalog. Do not invent saved items; offer to browse current pieces."

        lines = [f"VERIFIED WISHLIST CONTEXT ({len(ordered)} published saved products):"]
        for product in ordered:
            category = product.category.name if product.category else "Apparel"
            price = f"INR {product.price_selling:,.0f}" if product.price_selling is not None else "not listed"
            colour = product.colour or "not specified"
            fabric = product.fabric or "not specified"
            lines.append(f"- ID: {product.id} | Name: {product.name} | Category: {category} | Colour: {colour} | Fabric: {fabric} | Price: {price}")
        lines.append("Use only these saved products when answering what the shopper saved or styling their wishlist. Check live catalog/inventory before making availability claims.")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning("Could not load stylist wishlist context: %s", type(exc).__name__)
        return "VERIFIED WISHLIST CONTEXT: Wishlist lookup is temporarily unavailable. Be transparent and do not guess saved items."


def chat(
    messages: list,
    profile: dict,
    db=None,
    context_url: str = None,
    cart_items: list = None,
    user_id: str = None,
    session_id: str = None,
    wishlist_product_ids: list = None,
) -> tuple[str, list]:
    """
    Shopper stylist chat uses the self-hosted Qwen model only. An outage raises
    a controlled error and never substitutes a scripted or remote-model reply.
    Returns: (reply_text, executed_tools_list)
    """
    from app.core.config import settings
    from app.core.exceptions import ServiceUnavailableError

    messages = _sanitize_client_messages(messages)
    model = os.getenv("STYLIST_MODEL", "").strip() or settings.stylist_model
    url = os.getenv("STYLIST_BASE_URL", "").strip() or settings.stylist_base_url
    if not model or not url:
        raise ServiceUnavailableError("Stylist is not configured")
    order_context = _order_lookup_context(messages, db, user_id)
    wishlist_context = _wishlist_lookup_context(messages, db, user_id, wishlist_product_ids)
    system_prompt = _build_system_prompt(
        profile, db=db, context_url=context_url, cart_items=cart_items,
        order_context=order_context, wishlist_context=wishlist_context
    )
    return _call_qwen(
        messages=messages,
        system_prompt=system_prompt,
        model=model,
        base_url=url,
        db=db,
        user_id=user_id,
        session_id=session_id,
    )


def chat_stream(
    messages: list,
    profile: dict,
    db=None,
    context_url: str = None,
    cart_items: list = None,
    user_id: str = None,
    session_id: str = None,
    wishlist_product_ids: list = None,
):
    """
    Server-Sent Events for a streamed reply. The provider call runs eagerly (before the
    response starts) so model outages surface as a real HTTP 502/503, not a broken stream.
    """
    reply_text, executed_tools = chat(
        messages=messages,
        profile=profile,
        db=db,
        context_url=context_url,
        cart_items=cart_items,
        user_id=user_id,
        session_id=session_id,
        wishlist_product_ids=wishlist_product_ids,
    )
    return _sse_events(reply_text, executed_tools, session_id)


def _sse_events(reply_text: str, executed_tools: list, session_id: str):
    # Emit tool events if any were executed
    for tool_event in executed_tools:
        yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_event['tool'], 'result': tool_event['result']})}\n\n"

    words = reply_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'executed_tools': executed_tools})}\n\n"
