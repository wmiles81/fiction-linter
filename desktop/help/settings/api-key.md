---
id: settings-api-key
title: API Key
category: Settings
order: 3
summary: Paste your API key from OpenRouter, OpenAI, or Anthropic into Settings. The key is stored locally on your machine and never sent to our servers.
keywords: api key, token, secret, openrouter, openai, anthropic, security, paste, credentials
---

## API Key

The **API Key** field is in the **Studio Settings** dialog (gear icon, top-right corner, or **Cmd+,** / **Ctrl+,**), directly below the Provider and Base URL fields.

### Where to get a key

| Provider | Where to find your key |
|----------|----------------------|
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) — create a free account, then generate a key |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic** | [console.anthropic.com/keys](https://console.anthropic.com/keys) |
| **Ollama (local)** | No API key required — leave the field blank |

### Pasting your key

1. Copy the key from your provider's dashboard.
2. Click into the **API Key** field in Studio Settings.
3. Paste with **Cmd+V** (Mac) or **Ctrl+V** (Windows/Linux).
4. The field shows dots — this is normal. Keys are masked for privacy.
5. Tab away from the field or click **Refresh models** to test the connection.

### Security

Your API key is stored in Electron's `userData` directory on your local machine — the same secure location used for your settings and license. It is encrypted at rest using your operating system's secure storage facility where available.

**The key is never sent to our servers.** API calls go directly from your computer to your chosen provider. Fiction Linter does not proxy, log, or see your requests.

### See also

- [AI Provider](settings-ai-provider)
- [Model Picker](settings-model-picker)
