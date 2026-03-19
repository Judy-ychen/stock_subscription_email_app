"""
Email rendering and sending.
"""

from django.core.mail import EmailMultiAlternatives
from django.conf import settings


HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body      {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
    .container{{ max-width: 600px; margin: 0 auto; background: white;
                 border-radius: 8px; padding: 30px; }}
    h1        {{ color: #1a1a1a; font-size: 22px; margin-bottom: 4px; }}
    .subtitle {{ color: #666; font-size: 13px; margin-bottom: 24px; }}
    .stock    {{ border: 1px solid #e0e0e0; border-radius: 6px;
                 padding: 16px; margin-bottom: 16px; }}
    .ticker   {{ font-size: 20px; font-weight: bold; color: #1a1a1a; }}
    .price    {{ font-size: 18px; color: #333; margin: 4px 0; }}
    .rec      {{ display: inline-block; padding: 4px 12px; border-radius: 4px;
                 font-weight: bold; font-size: 14px; margin: 6px 0; }}
    .BUY      {{ background: #d4edda; color: #155724; }}
    .HOLD     {{ background: #fff3cd; color: #856404; }}
    .SELL     {{ background: #f8d7da; color: #721c24; }}
    .reason   {{ color: #555; font-size: 13px; margin-top: 6px; }}
    .source   {{ color: #999; font-size: 11px; margin-top: 4px; }}
    .footer   {{ color: #999; font-size: 11px; margin-top: 24px;
                 border-top: 1px solid #eee; padding-top: 12px; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>📈 Stock Update</h1>
    <p class="subtitle">{generated_at}</p>

    {stock_blocks}

    <div class="footer">
      This is a demo AI-generated recommendation for educational purposes only.
      Not financial advice.
    </div>
  </div>
</body>
</html>
"""

STOCK_BLOCK_TEMPLATE = """
<div class="stock">
  <div class="ticker">{ticker}</div>
  <div class="price">${price:.2f}
    <span class="source">({source})</span>
  </div>
  <span class="rec {recommendation}">{recommendation}</span>
  <div class="reason">{reason}</div>
</div>
"""

TEXT_TEMPLATE = """Stock Update — {generated_at}

{stock_lines}

---
Demo AI recommendation. Not financial advice.
"""


def render_and_send_email(recipient_email: str, stock_updates: list[dict]):
    from django.utils import timezone
    from django.core.mail import get_connection

    generated_at = (timezone.localtime(timezone.now())).strftime("%B %d, %Y %I:%M %p %Z")

    # Build HTML blocks
    stock_blocks = "".join(
        STOCK_BLOCK_TEMPLATE.format(**update)
        for update in stock_updates
    )
    html_body = HTML_TEMPLATE.format(
        generated_at=generated_at,
        stock_blocks=stock_blocks,
    )

    # Build plain text fallback
    stock_lines = "\n\n".join(
        f"{u['ticker']}  ${u['price']:.2f}\n"
        f"  {u['recommendation']} — {u['reason']}"
        for u in stock_updates
    )
    text_body = TEXT_TEMPLATE.format(
        generated_at=generated_at,
        stock_lines=stock_lines,
    )

    tickers = [u["ticker"] for u in stock_updates]
    subject = f"Stock Update: {', '.join(tickers)}"

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@stockalert.dev")

    # Force a fresh connection using current settings — avoids cached backend
    connection = get_connection(backend=settings.EMAIL_BACKEND)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[recipient_email],
        connection=connection,
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()