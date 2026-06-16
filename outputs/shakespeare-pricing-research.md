# Shakespeare Pricing Research

Date researched: 2026-06-16

## Recommendation

Shakespeare should be priced as a heavily subsidized, adoption-first productivity utility, not as a per-prompt or per-token tool.

The cheapest sane launch ladder:

| Tier | Price | Include | Why |
| --- | ---: | --- | --- |
| Free | $0 | 100 Speed rewrites/month, selected-text only, General/Coding Agent/Debugging modes | Generous enough to build habit and compete with free browser extensions, but excludes costly context features. |
| Founding Pro | $3/month or $30/year | First 1,000 users, unlimited normal Speed rewrites under fair use, 100 Quality rewrites/month, preview/diff, local history, custom modes | A deliberately subsidized early-adopter plan. Use this only as a time-limited founding offer. |
| Pro | $5/month or $48/year | Unlimited normal Speed rewrites under fair use, 250 Quality rewrites/month, 200 context-aware rewrites/month, preview/diff, app/window context, local history, custom modes, privacy denylist, optional BYO key | The main cheap public plan. Annual price lands at $4/month, far below Raycast, PromptAI 360 Pro, and voice competitors. |
| Team | $8/seat/month or $84/seat/year | Everything in Pro, shared modes, centralized billing, team privacy defaults, admin app/domain denylist, team usage analytics without prompt content, 500 context-aware rewrites/seat/month | Cheap enough for small dev teams to approve without procurement. Team value is shared workflow quality, not raw usage. |
| Enterprise | Talk to Us | SSO/SAML/SCIM, DPA, SOC 2 packet, zero-data-retention commitments, private model routing, custom retention, audit controls, volume discounts | This is security/procurement-led. Do not publish a dollar price. |

Do not lead with usage pricing. Track usage internally and reserve visible limits only for expensive features such as Quality mode, screen OCR, browser DOM context, IDE context, and web/tool calls. Users are buying reduced friction and fewer bad agent runs, not tokens.

The principle: subsidize the habit, meter the expensive context invisibly until someone is far outside normal use.

## Price Positioning

The market splits into three pricing clusters:

1. Free or cheap browser-only prompt helpers: Promptly is free; PromptAI 360 Basic is $6.67/month annually. These set the low anchor for generic prompt enhancement.
2. Cross-app AI writing or OS workflow tools: Raycast, Willow, Wispr Flow, Grammarly, Typeless, and Superwhisper generally sit around $8 to $15/month on annual plans. This is the correct anchor for Shakespeare if it works everywhere the user types.
3. Team and enterprise workflow layers: $12 to $18/seat/month publicly, then custom enterprise for SSO, compliance, admin controls, and zero-retention needs.

If the goal is maximum adoption, Shakespeare should not start at $12/month. That is the market-clearing price, not the subsidized price. The best cheap wedge is $5/month or $48/year, with a $3/month founding plan for early users and students.

The cost risk is manageable because selected-text Speed rewrites are extremely cheap. The product should only become careful with usage when users lean heavily on Quality mode, large context packets, or future tool calls.

## Competitor Pricing Matrix

| Product | Type | Pricing model found | Pricing implication for Shakespeare |
| --- | --- | --- | --- |
| Promptly | Browser prompt enhancer and manager | Free Chrome extension. Official structured data lists an offer price of $0. Chrome Web Store listing shows 30,000 users, one-click optimization, prompt library, and conversation export. | Browser-only prompt optimization is effectively free. Shakespeare needs native hotkey reliability, coding-agent specialization, and real context to charge. |
| PromptAI 360 | Direct prompt enhancer | 5-day free trial with 1 prompt/day. Basic $79.99/year, shown as $6.67/month. Pro $149.99/year, shown as $12.50/month. Teams custom for 5+ seats. | Beat this decisively on price: $48/year public Pro and $30/year founding/student pricing. |
| Raycast AI Commands / Quick Fix | OS productivity layer with AI commands | Free users get limited AI messages. Pro is $10/month or $8/month annually. Team Pro is $15/user/month or $12/user/month annually. Advanced AI add-on is +$8/month or +$8/user/month. | Raycast creates the strongest OS-level AI utility anchor. A subsidized Shakespeare should sit below it: $4/year-equivalent Pro, $7/year-equivalent Team. |
| Willow Voice / Scribe | Voice dictation plus context-aware writing | Free trial tier includes 2,000 words/week. Individual Pro is $15/month or $12/month annually. Team Pro is $12/month or $10/month annually with 3-seat minimum. Enterprise is custom. | Voice products can charge $12 to $15 because they replace typing. Shakespeare should intentionally undercut them until it proves the same daily habit. |
| Wispr Flow Command Mode | Voice dictation and inline command mode | Basic is free with weekly word limits. Pro is $15/user/month or $12/user/month annually. Enterprise is contact sales. Command Mode requires paid subscription or active trial. | Wispr shows that inline transformation belongs in paid. It also shows a 14-day no-card trial is normal for this category. |
| Superwhisper | Voice-to-text with context and modes | Free tier. Pro is $8.49/month. Official pricing page also exposes monthly, yearly, and lifetime purchase options. Enterprise is custom. Pro includes BYO AI API keys and unlimited cloud/local AI models. | BYO keys should be an advanced Pro/Team feature, not a separate cheap tier. Lifetime pricing is risky for Shakespeare because managed model costs are recurring. |
| OpenAI Prompt Optimizer | Platform prompt optimization workflow | Developer-platform feature rather than a standalone app. OpenAI docs say the dataset-backed prompt optimizer is being deprecated with read-only status on 2026-10-31 and shutdown on 2026-11-30. | Generic prompt optimization is not defensible. Shakespeare's moat must be inline workflow, context receipts, and coding-agent modes. |
| Grammarly Pro | Cross-app writing assistant | Free plan includes 100 AI prompts. Pro is $12/member/month annually or $30 monthly, with 2,000 AI prompts. Enterprise is contact sales. | Sets a broad writing-assistant ceiling. Subsidized Shakespeare should be less than half the annualized Grammarly Pro price. |
| Typeless | Cross-platform AI dictation | Free plan includes 8,000 words/week. Pro is $12/member/month annually or $30 monthly. | Another signal that $12 annual is accepted for daily writing utilities, but Shakespeare can undercut this while its core usage is cheaper than voice. |
| VoiceInk | Local-first Mac dictation | One-time lifetime pricing: $25 for 1 Mac, $39 for 2 devices, $49 for 3 devices. No subscription. | Good cautionary anchor for local-only/BYO competitors. Shakespeare should avoid lifetime pricing while it subsidizes model calls. |
| AIPRM | Prompt template library for ChatGPT and Claude | Free version plus paid prompt-library plans. Public search snippets show solo plans from $20/month upward, but the app pricing table is client-rendered. | Less direct. It proves template libraries can monetize, but Shakespeare should avoid becoming a prompt marketplace. |

## Model Cost Check

Shakespeare's current spec uses `gpt-5.4-nano` for Speed and `gpt-5.4-mini` for Quality.

Current OpenAI API prices checked on 2026-06-16:

| Model | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| gpt-5.4-nano | $0.20 / 1M tokens | $0.02 / 1M tokens | $1.25 / 1M tokens |
| gpt-5.4-mini | $0.75 / 1M tokens | $0.075 / 1M tokens | $4.50 / 1M tokens |

Rough COGS examples:

| Scenario | Tokens | Nano cost | Mini cost |
| --- | --- | ---: | ---: |
| Normal selected-text rewrite | 1,000 input + 250 output | about $0.00051 | about $0.00188 |
| Context-heavy rewrite | 8,000 input + 500 output | about $0.00223 | about $0.00825 |
| 1,000 normal rewrites/month | same mix | about $0.51 | about $1.88 |
| 5,000 normal rewrites/month | same mix | about $2.56 | about $9.38 |

Conclusion: a $5/month Pro plan can still subsidize normal Speed usage if the default model is `gpt-5.4-nano` and Quality/context-heavy usage is budgeted. The margin risk is not normal selected-text rewriting. The risk is heavy context capture, high Quality-mode usage, web search/tool calls, and support burden. That means the external model should stay seat-based while the backend enforces internal budgets by model, context size, and mode.

## Packaging Rules

- Free should be real, but narrow: no screen context, no browser/IDE context, no shared modes, no extended history.
- Pro should feel unlimited for normal daily selected-text use. Do not show scary token counters.
- Quality mode should be positioned as "slower, more careful" and capped generously enough that normal users do not notice.
- Context-aware rewrites should have a visible monthly allowance only if needed; otherwise treat the limit as fair-use enforcement.
- BYO key should live in Pro/Team as a power/privacy feature, not as a free escape hatch.
- Team should be about shared prompt modes, admin privacy defaults, and predictable workflow quality.
- Enterprise should be `Talk to Us`, especially for SSO, SCIM, SOC 2, HIPAA-style procurement, zero data retention, or private model routing.
- Avoid lifetime pricing while Shakespeare uses a managed backend. A one-time local-only edition could exist later, but it should be separate from the managed cloud product.

## Cheapest Viable Subsidy Policy

Use this policy if the goal is to grow usage as aggressively as possible:

- Default every rewrite to Speed mode unless the user explicitly chooses Quality.
- Keep the stable compiler prompt short and cache-friendly.
- Put Quality mode and large context behind monthly soft budgets, not token pricing.
- Let users BYO API keys in Pro and Team to reduce Shakespeare's model subsidy while still charging for the workflow layer.
- Offer 50 percent off for students, open-source maintainers, and early design partners.
- Grandfather Founding Pro for 12 months, not forever.
- Review gross margin only after measuring real usage distribution; do not optimize pricing around hypothetical power users on day one.

## Source Links

- Raycast pricing: https://www.raycast.com/pricing
- Raycast AI Commands: https://manual.raycast.com/ai/ai-commands
- PromptAI 360 pricing: https://www.promptai360.com/pricing
- Promptly site: https://www.promptly.fyi/
- Promptly Chrome Web Store: https://chromewebstore.google.com/detail/promptly-%E2%80%93-ai-prompt-enha/jjfoaldlbbcfgkhbfmadjjelphbgmngg
- Willow pricing: https://willowvoice.com/pricing
- Willow Scribe intro: https://help.willowvoice.com/en/articles/15043797-introduction-to-scribe-in-willow
- Wispr Flow pricing: https://wisprflow.ai/pricing
- Wispr Flow Command Mode: https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode
- Superwhisper pricing/home: https://superwhisper.com/
- Superwhisper context docs: https://superwhisper.com/docs/common-issues/context
- OpenAI Prompt Optimizer: https://developers.openai.com/api/docs/guides/prompt-optimizer
- OpenAI API pricing: https://openai.com/api/pricing/
- OpenAI GPT-5.4 nano model pricing: https://developers.openai.com/api/docs/models/gpt-5.4-nano
- OpenAI GPT-5.4 mini model pricing: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- Grammarly Pro pricing: https://www.grammarly.com/pro
- Typeless pricing: https://www.typeless.com/pricing
- VoiceInk pricing: https://tryvoiceink.com/pricing
- AIPRM pricing: https://app.aiprm.com/pricing
