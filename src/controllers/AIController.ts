import * as vscode from 'vscode';
import { ModelManager } from '../managers/ModelManager';

export type AIConnectionStatus = 'disconnected' | 'vscode-model' | 'api-key' | 'error' | 'disabled';

export interface AIStatusInfo {
    status: AIConnectionStatus;
    modelName?: string;
    message: string;
}

export class AIController {
    private model: vscode.LanguageModelChat | undefined;
    private outputChannel: vscode.OutputChannel;
    private connectionStatus: AIStatusInfo = { status: 'disconnected', message: 'Not initialized' };
    private isInitialized: boolean = false;
    private modelManager: ModelManager;

    constructor(outputChannel: vscode.OutputChannel, modelManager: ModelManager) {
        this.outputChannel = outputChannel;
        this.modelManager = modelManager;
    }

    /**
     * Returns the current AI connection status
     */
    getStatus(): AIStatusInfo {
        return this.connectionStatus;
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
        console.log(`AIController: ${message}`);
    }

    /**
     * Initializes the AI Connection.
     * Checks if a valid API Key is available via ModelManager.
     */
    async initialize(): Promise<boolean> {
        try {
            const provider = this.modelManager.currentProvider;
            const modelId = this.modelManager.currentModelId;
            const apiKey = await this.modelManager.getApiKey(provider);

            if (apiKey) {
                this.connectionStatus = {
                    status: 'api-key',
                    modelName: modelId,
                    message: `Connected via ${provider}: ${modelId}`
                };
                this.log(`✅ Using ${provider} API with model: ${modelId}`);
                this.isInitialized = true;
                return true;
            }

            // Fallback: Try VS Code models if no key found
            this.log(`⚠️ No API key found for ${provider}. Checking VS Code models...`);
            // ... (keep legacy vscode.lm logic if desired, or simpler fallback)

            // Simplified VS Code LM check for now to avoid complexity during migration
            let models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
            if (models.length > 0) {
                this.model = models[0];
                this.connectionStatus = {
                    status: 'vscode-model',
                    modelName: this.model.name,
                    message: `Connected via VS Code: ${this.model.name}`
                };
                this.isInitialized = true;
                return true;
            }

            this.connectionStatus = {
                status: 'disconnected',
                message: `No API Key for ${provider} and no VS Code models found.`
            };
            return false;

        } catch (error) {
            this.connectionStatus = {
                status: 'error',
                message: `Error: ${error}`
            };
            this.log(`❌ Error initializing AI: ${error}`);
            return false;
        }
    }

    async generateFix(originalText: string, violation: string, contextContext: string): Promise<string | undefined> {
        if (!this.isInitialized) await this.initialize();
        if (this.connectionStatus.status === 'disconnected') return undefined;

        const prompt = `
You are an expert fiction editor.
Task: Fix the following text which has been flagged as: "${violation}".
Context/Rules: ${contextContext}

Original Text: "${originalText}"

Return ONLY the rewritten text that fixes the issue while preserving the author's voice. Do not add quotes or explanations.
`;
        return this.sendRequest(prompt);
    }

    async analyzeText(text: string, criteria: string): Promise<any[]> {
        if (!this.isInitialized) await this.initialize();
        if (this.connectionStatus.status === 'disconnected') return [];

        const prompt = `
You are an expert fiction editor.
Task: Analyze the following text based on these criteria: ${criteria}

Input Text: "${text}"

Return ONLY a valid JSON array of objects. No markdown formatting.
Schema: [{"offending_text": "exact substring", "issue": "description", "suggestion": "fix"}]
`;
        const result = await this.sendRequest(prompt);
        if (!result) return [];

        try {
            const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('AIController: JSON parse failed', e);
            return [];
        }
    }

    private async sendRequest(prompt: string): Promise<string | undefined> {
        // Use VS Code API if active
        if (this.connectionStatus.status === 'vscode-model' && this.model) {
            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const response = await this.model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            let text = '';
            for await (const fragment of response.stream) text += fragment;
            return text;
        }

        // Use Direct API
        return this.callProviderApi(prompt);
    }

    private async callProviderApi(prompt: string): Promise<string | undefined> {
        const provider = this.modelManager.currentProvider;
        const modelId = this.modelManager.currentModelId;
        const apiKey = await this.modelManager.getApiKey(provider);

        if (!apiKey) return undefined;

        let url = '';
        let headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        if (provider === 'openrouter') {
            url = 'https://openrouter.ai/api/v1/chat/completions';
            headers['HTTP-Referer'] = 'https://github.com/ocotillo-quill-press-llc/fiction-linter';
            headers['X-Title'] = 'Fiction Linter';
        } else {
            // OpenAI
            const config = vscode.workspace.getConfiguration('fiction-linter');
            url = config.get<string>('apiBaseUrl') || 'https://api.openai.com/v1/chat/completions';
        }

        const payload = {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        };

        // Reasoning models (o1, etc.) constraint
        if (modelId.startsWith('o1') || modelId.startsWith('o3')) {
            delete (payload as any).temperature;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                this.log(`❌ API Error: ${response.status} - ${err}`);
                return undefined;
            }

            const data: any = await response.json();
            return data.choices[0]?.message?.content?.trim();

        } catch (error) {
            this.log(`❌ Network Error: ${error}`);
            return undefined;
        }
    }
}


