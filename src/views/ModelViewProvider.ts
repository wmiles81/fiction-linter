import * as vscode from 'vscode';
import { ModelManager, Model } from '../managers/ModelManager';

export class ModelViewProvider implements vscode.TreeDataProvider<ModelTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModelTreeItem | undefined | null | void> = new vscode.EventEmitter<ModelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ModelTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private modelManager: ModelManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ModelTreeItem): Promise<ModelTreeItem[]> {
        if (!element) {
            // Root level
            const activeModelId = this.modelManager.currentModelId;
            const activeProvider = this.modelManager.currentProvider;

            return [
                new ActiveModelItem(activeModelId, activeProvider),
                new ProviderGroupItem('OpenAI', 'openai', vscode.TreeItemCollapsibleState.Expanded),
                new ProviderGroupItem('OpenRouter', 'openrouter', vscode.TreeItemCollapsibleState.Collapsed)
            ];
        }

        if (element instanceof ProviderGroupItem) {
            const items: ModelTreeItem[] = [];

            // "Set API Key" item
            items.push(new ActionItem(
                'Set API Key',
                'key',
                element.providerId,
                `fiction-linter.setApiKey.${element.providerId}`
            ));

            // Fetch models
            const models = await this.modelManager.getAvailableModels(element.providerId);
            const activeModelId = this.modelManager.currentModelId;

            items.push(...models.map(m => new ModelItem(
                m,
                m.id === activeModelId && element.providerId === this.modelManager.currentProvider
            )));

            return items;
        }

        return [];
    }
}

export type ModelTreeItem = ActiveModelItem | ProviderGroupItem | ActionItem | ModelItem;

class ActiveModelItem extends vscode.TreeItem {
    constructor(modelId: string, provider: string) {
        super(`Active: ${modelId} (${provider})`, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('check');
        this.contextValue = 'activeModel';
    }
}

class ProviderGroupItem extends vscode.TreeItem {
    constructor(
        label: string,
        public providerId: 'openai' | 'openrouter',
        state: vscode.TreeItemCollapsibleState
    ) {
        super(label, state);
        this.contextValue = 'providerGroup';
        this.iconPath = providerId === 'openai' ? new vscode.ThemeIcon('brain') : new vscode.ThemeIcon('globe');
    }
}

class ActionItem extends vscode.TreeItem {
    constructor(
        label: string,
        icon: string,
        public providerId: 'openai' | 'openrouter',
        commandId?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'action';
        if (commandId) {
            this.command = {
                command: commandId,
                title: label,
                arguments: [providerId]
            };
        }
    }
}

class ModelItem extends vscode.TreeItem {
    constructor(
        public model: Model,
        isActive: boolean
    ) {
        super(model.name, vscode.TreeItemCollapsibleState.None);
        this.description = model.id;
        this.contextValue = 'model';
        this.iconPath = isActive ? new vscode.ThemeIcon('pass-filled') : new vscode.ThemeIcon('symbol-misc');

        this.command = {
            command: 'fiction-linter.selectModel',
            title: 'Select Model',
            arguments: [model]
        };
    }
}
