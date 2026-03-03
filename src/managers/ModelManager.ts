import * as vscode from 'vscode';


export interface Model {
    id: string;
    name: string; // Display name
    contextWindow?: number;
    provider: 'openai' | 'openrouter';
}

export interface ModelProvider {
    id: 'openai' | 'openrouter';
    name: string;
    baseUrl: string;
    apiKeySecretKey: string; // Key used in secret storage
}

export class ModelManager {
    private context: vscode.ExtensionContext;
    private _currentProvider: 'openai' | 'openrouter' = 'openai';
    private _currentModelId: string = 'gpt-4o-mini';

    // Default fallback models
    private readonly defaultOpenAIModels: Model[] = [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
    ];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadState();
    }

    private loadState() {
        const config = vscode.workspace.getConfiguration('fiction-linter');
        // Load legacy settings if available, otherwise use defaults
        const legacyModel = config.get<string>('modelName');
        if (legacyModel) {
            this._currentModelId = legacyModel;
        }

        // Load from workspace state if available (overrides legacy)
        const storedProvider = this.context.workspaceState.get<'openai' | 'openrouter'>('selectedProvider');
        const storedModel = this.context.workspaceState.get<string>('selectedModel');

        if (storedProvider) this._currentProvider = storedProvider;
        if (storedModel) this._currentModelId = storedModel;
    }

    public async getApiKey(providerId: 'openai' | 'openrouter'): Promise<string | undefined> {
        const secretKey = `fiction-linter.${providerId}Key`;
        let key = await this.context.secrets.get(secretKey);

        // Fallback to legacy settings for OpenAI
        if (!key && providerId === 'openai') {
            const config = vscode.workspace.getConfiguration('fiction-linter');
            key = config.get<string>('openAiKey');
        }

        return key;
    }

    public async setApiKey(providerId: 'openai' | 'openrouter', key: string): Promise<void> {
        const secretKey = `fiction-linter.${providerId}Key`;
        await this.context.secrets.store(secretKey, key);

        // If it's OpenAI, maybe warn user about legacy setting? 
        // For now, we prefer the secret storage.
    }

    public get currentProvider(): 'openai' | 'openrouter' {
        return this._currentProvider;
    }

    public get currentModelId(): string {
        return this._currentModelId;
    }

    public async setModel(provider: 'openai' | 'openrouter', modelId: string): Promise<void> {
        this._currentProvider = provider;
        this._currentModelId = modelId;

        await this.context.workspaceState.update('selectedProvider', provider);
        await this.context.workspaceState.update('selectedModel', modelId);

        // Also update legacy setting for backward compatibility
        if (provider === 'openai') {
            await vscode.workspace.getConfiguration('fiction-linter').update('modelName', modelId, vscode.ConfigurationTarget.Global);
        }
    }

    public async getAvailableModels(providerId: 'openai' | 'openrouter'): Promise<Model[]> {
        const apiKey = await this.getApiKey(providerId);
        if (!apiKey) {
            if (providerId === 'openai') return this.defaultOpenAIModels;
            return [];
        }

        try {
            if (providerId === 'openrouter') {
                return await this.fetchOpenRouterModels(apiKey);
            } else {
                return await this.fetchOpenAIModels(apiKey);
            }
        } catch (error) {
            console.error(`Error fetching models for ${providerId}:`, error);
            if (providerId === 'openai') return this.defaultOpenAIModels;
            return [];
        }
    }

    private async fetchOpenRouterModels(apiKey: string): Promise<Model[]> {
        const response = await this.makeRequest('https://openrouter.ai/api/v1/models', apiKey);
        if (!response || !response.data) return [];

        return response.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            contextWindow: m.context_length,
            provider: 'openrouter'
        })).sort((a: Model, b: Model) => a.name.localeCompare(b.name));
    }

    private async fetchOpenAIModels(apiKey: string): Promise<Model[]> {
        const response = await this.makeRequest('https://api.openai.com/v1/models', apiKey);
        if (!response || !response.data) return this.defaultOpenAIModels;

        // Filter for chat models and sort
        return response.data
            .filter((m: any) => m.id.includes('gpt'))
            .map((m: any) => ({
                id: m.id,
                name: m.id,
                provider: 'openai'
            }))
            .sort((a: Model, b: Model) => b.id.localeCompare(a.id)); // Newest first usually
    }

    private async makeRequest(url: string, apiKey: string): Promise<any> {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Request to ${url} failed with status ${response.status}: ${response.statusText}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`Network error requesting ${url}:`, error);
            throw error;
        }
    }
}
