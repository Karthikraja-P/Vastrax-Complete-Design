"""Vastra AI Stylist service. Shopper conversations use self-hosted Qwen only."""
import json
import logging
import os
import httpx

logger = logging.getLogger(__name__)


_STYLING_RULES = """
STYLING & FIT GUIDANCE:
- Tailor advice to preferences or measurements the shopper actually supplied. Never infer complexion, body shape, fit, or undertones from a product name or colour.
- If sizing matters, refer shoppers to the actual product Size Chart; use the inventory tool before claiming a size is in stock.
- Suggest the AI Fitting Room for a product only as an optional preview, without promising an exact physical fit.
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
3. CURATION & PACING: Recommend 1-3 tailored pieces per query. Keep responses concise (2-4 sentences). Ask at most ONE focused follow-up question.
4. ACTIVITY-AWARE SUGGESTION CHIPS: Format quick-reply buttons at the very end of your response as [CHIPS:Opt1|Opt2|Opt3].
   - If user asks about styling, sizing, or outfits: suggest styling options (e.g. [CHIPS:Show festive looks|Size guidance|Try in fitting room|Casual picks]).
   - If user asks about an order/shipping: suggest order options (e.g. [CHIPS:Track order|Return policy|Contact support]).
   - NEVER suggest order tracking chips during styling or outfit browsing.
5. PROFILE MEMORY: Silently append learned customer attributes at the end as [PROFILE:{{"skin_tone":"wheatish"}}] when detected.

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
                    lines.append(f"{i}. ID: {p.id} | Name: {p.name} | Category: {cat_name} | Occasion: {occasion}")
                    lines.append(f"   Fabric: {fabric} | Colour: {colour} | Price: {price}")
                    if desc:
                        lines.append(f"   Description: {desc}")
                return "\n".join(lines)
        except Exception as e:
            logger.warning("Could not load products from database: %s", e)
    return "LIVE BOUTIQUE CATALOG: No published products are currently available."


def _build_system_prompt(profile: dict, db=None, context_url: str = None, cart_items: list = None) -> str:
    from app.api.routes.settings import load_app_settings
    app_settings = load_app_settings(db)
    admin_instructions = getattr(app_settings, "stylistSystemPrompt", "You are Vastra, the personal style advisor for VastraX boutique.")
    active_offers = (app_settings.get("activeOffers", "") if isinstance(app_settings, dict) else getattr(app_settings, "activeOffers", "")) or "No verified offers are currently listed."

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
    try:
        with httpx.Client(timeout=120.0, trust_env=False) as client:

            def complete(include_tools: bool):
                payload = {
                    "model": model,
                    "messages": qwen_messages,
                    "options": {"num_predict": 768, "num_ctx": 4096, "num_gpu": 28, "temperature": 0.6},
                    "think": False,
                    "stream": False,
                }
                if include_tools and db is not None:
                    payload["tools"] = CHAT_TOOLS
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


# ── Public entry point ────────────────────────────────────────────────────────

def chat(
    messages: list,
    profile: dict,
    db=None,
    context_url: str = None,
    cart_items: list = None,
    user_id: str = None,
    session_id: str = None,
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
    system_prompt = _build_system_prompt(profile, db=db, context_url=context_url, cart_items=cart_items)
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
