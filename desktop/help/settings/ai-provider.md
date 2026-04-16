---
id: settings-ai-provider
title: AI Provider
category: Settings
order: 2
summary: Choose which AI service Fiction Linter uses for AI Scan and Fix Now rewrites — OpenRouter, OpenAI, Anthropic, or a local Ollama instance.
keywords: provider, openrouter, openai, anthropic, ollama, local, api, service, connection
---

## AI Provider

The **Provider** dropdown is in the **Studio Settings** dialog (gear icon, top-right corner, or **Cmd+,** / **Ctrl+,**). It controls which AI service powers the **AI Scan** and **Fix Now** operations.

### Available providers

| Provider | Best for |
|----------|----------|
| **OpenRouter** | Access to dozens of models from one account, including several free-tier options. Recommended starting point. |
| **OpenAI** | Direct access to GPT-4o and other OpenAI models. Requires an OpenAI account. |
| **Anthropic** | Direct access to Claude models. Requires an Anthropic account. |
| **Ollama (local)** | Runs a model entirely on your own machine — no API key needed, no data leaves your computer. Requires Ollama to be installed and running locally. |

### Base URL

Below the Provider dropdown is a **Base URL** field. This is pre-filled with the correct endpoint for the chosen provider. Most writers never need to change it. You would edit it only if you are running a self-hosted proxy or an alternative Ollama port.

### After changing providers

Switching provider clears the model list. Enter your API key for the new provider and click **Refresh models** (or tab away from the key field) to reload the model list.

### See also

- [API Key](settings-api-key)
- [Model Picker](settings-model-picker)
