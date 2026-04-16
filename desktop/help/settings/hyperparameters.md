---
id: settings-hyperparameters
title: Hyperparameters
category: Settings
order: 5
summary: Fine-tune how the AI model generates text. Temperature controls creativity, top_p narrows word choice, max_tokens caps response length, and reasoning_effort adjusts how deeply a thinking model works.
keywords: temperature, top_p, max_tokens, reasoning_effort, hyperparameters, creativity, tokens, thinking
---

## Hyperparameters

The **Hyperparameters** panel appears below the model list in **Studio Settings** after you select a model. It shows only the parameters that your chosen model actually supports — if a parameter does not appear, the model does not expose it.

Think of these as creative sliders. Most writers can leave them at their defaults and get good results. Adjust them if the AI output feels too generic, too random, or too long.

### Temperature

A number between 0 and 2 (default varies by model, typically 1.0).

- **Lower (0–0.5):** More predictable, conservative word choices. Good when you want the AI to make safe, minimal edits.
- **Higher (1.0–1.5):** More varied, sometimes surprising language. Good for generating alternative phrasings with more personality.
- **Very high (above 1.5):** Output can become incoherent. Not recommended for prose editing.

### Top P

A number between 0 and 1 (default typically 1.0).

Works alongside temperature to narrow the pool of words the model considers at each step. A value of 0.9 means the model only picks from the top 90% of likely words. Lower values produce more focused output. Most writers can leave this at the default.

### Max Output Tokens

An integer that caps how long the AI's response can be.

For **Fix Now** rewrites (which replace a single flagged phrase), a cap of 200–400 tokens is usually plenty. For **AI Scan** (which analyzes larger chunks), the model will use as many tokens as it needs — setting this too low can truncate findings mid-response.

### Reasoning Effort

Available on models that support a "thinking" mode (such as certain Anthropic and OpenRouter models). Options are **low**, **medium**, and **high**.

Higher effort means the model spends more time reasoning before responding. For fiction editing, **medium** is a good starting point — it catches nuance without running slowly.

### See also

- [Model Picker](settings-model-picker)
- [AI Provider](settings-ai-provider)
