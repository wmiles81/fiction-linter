---
id: settings-model-picker
title: Model Picker
category: Settings
order: 4
summary: Browse, sort, and select an AI model. Free models carry a FREE badge. Context window size is shown next to each model name.
keywords: model, free, badge, context window, sort, cost, provider, newest, picker, tokens
---

## Model Picker

The **Model** section appears in the lower portion of the **Studio Settings** dialog, after you have entered an API key and the list has loaded. Each row in the list represents one available model from your chosen provider.

### Reading the list

Each model row shows:

- **Model ID** — the provider's name for the model (e.g., `openai/gpt-4o`)
- **Context window** — shown in parentheses next to the name (e.g., `128k` or `2M`). For long manuscripts, prefer models with larger context windows
- **FREE badge** — models with $0 input and $0 output pricing show a green **FREE** badge instead of a price. These are the same models as $0.00/$0.00 but displayed prominently so they are easy to find
- **Price** — input and output cost per million tokens, shown as `$X.XX / $X.XX` for paid models

### Sort modes

Use the sort dropdown (top-right of the model list) to arrange models:

| Mode | What it does |
|------|-------------|
| **Provider (A–Z)** | Alphabetical by model ID — the default |
| **Cost: Low to High** | Cheapest first; free models appear at the top |
| **Cost: High to Low** | Most expensive first |
| **Context: Largest First** | Largest context window first — useful for long manuscripts |
| **Newest First** | Most recently released model first |
| **Free only** | Hides all paid models; shows only FREE models (the option displays a count, e.g., "Free only (8)") |

Your sort preference is remembered across sessions.

### Selecting a model

Click a row to select it. The selected model is highlighted. Once selected, the **Hyperparameters** panel appears below the list.

### See also

- [Hyperparameters](settings-hyperparameters)
- [AI Provider](settings-ai-provider)
- [API Key](settings-api-key)
