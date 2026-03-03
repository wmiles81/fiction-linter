import * as vscode from 'vscode';
import { SPEController } from './controllers/SPEController';
import { PatternLinter } from './linters/PatternLinter';
import { NameValidator } from './linters/NameValidator';
import { AIController, AIStatusInfo } from './controllers/AIController';
import { FixActionProvider } from './providers/FixActionProvider';
import { ScannerController } from './controllers/ScannerController';
import { ModelManager, Model } from './managers/ModelManager';
import { ModelViewProvider } from './views/ModelViewProvider';

let speController: SPEController;
let diagnosticCollection: vscode.DiagnosticCollection;
let aiDiagnosticCollection: vscode.DiagnosticCollection;
let patternLinter: PatternLinter;
let nameValidator: NameValidator;
let modelManager: ModelManager;
let modelViewProvider: ModelViewProvider;

// Status Bar Items
let statusBarItem: vscode.StatusBarItem;
let aiStatusBarItem: vscode.StatusBarItem;
let scanButtonItem: vscode.StatusBarItem;

// Output Channel
let outputChannel: vscode.OutputChannel;

// Active scan state
let activeScanController: ScannerController | null = null;
let isScanning = false;

export function activate(context: vscode.ExtensionContext) {
	// Create Output Channel first
	outputChannel = vscode.window.createOutputChannel('Fiction Linter');
	context.subscriptions.push(outputChannel);
	outputChannel.appendLine('Fiction Linter is now active');

	speController = new SPEController(context);
	patternLinter = new PatternLinter();
	nameValidator = new NameValidator();
	diagnosticCollection = vscode.languages.createDiagnosticCollection('fiction-linter');
	aiDiagnosticCollection = vscode.languages.createDiagnosticCollection('fiction-linter-ai');

	context.subscriptions.push(diagnosticCollection);
	context.subscriptions.push(aiDiagnosticCollection);

	// Initialize Model Management
	modelManager = new ModelManager(context);
	modelViewProvider = new ModelViewProvider(modelManager);
	vscode.window.registerTreeDataProvider('fiction-linter.modelView', modelViewProvider);

	// Create Status Bar Item (Linter Toggle)
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'fiction-linter.toggle';
	context.subscriptions.push(statusBarItem);
	updateStatusBar();

	// Create AI Status Bar Item (priority 101 = appears before linter toggle)
	aiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
	aiStatusBarItem.command = 'fiction-linter.toggleAI';
	context.subscriptions.push(aiStatusBarItem);
	updateAIStatusBar({ status: 'disconnected', message: 'Initializing...' });

	// Create AI Scan Button (Left aligned, near word count for visibility)
	scanButtonItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
	scanButtonItem.text = '$(search) AI Scan';
	scanButtonItem.tooltip = 'Click to scan document with AI';
	scanButtonItem.command = 'fiction-linter.toggleAiScan';
	scanButtonItem.show();
	context.subscriptions.push(scanButtonItem);
	outputChannel.appendLine('AI Scan button created and shown');

	// Lint active document on load
	if (vscode.window.activeTextEditor) {
		lintDocument(vscode.window.activeTextEditor.document);
	}

	// Lint on change
	let lintTimeout: NodeJS.Timeout | undefined;
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (lintTimeout) {
				clearTimeout(lintTimeout);
			}
			lintTimeout = setTimeout(() => {
				lintDocument(event.document);
			}, 500);
		})
	);

	// Lint on open
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			lintDocument(doc);
		})
	);

	// AI Integration
	const aiController = new AIController(outputChannel, modelManager);
	const fixActionProvider = new FixActionProvider(context);

	// Register Model Management Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.selectModel', async (model: Model) => {
			if (!model) return;
			await modelManager.setModel(model.provider, model.id);
			modelViewProvider.refresh();
			await initializeAI(aiController); // Re-connect with new model
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.setApiKey.openai', async () => {
			const key = await vscode.window.showInputBox({
				title: 'Enter OpenAI API Key',
				password: true,
				placeHolder: 'sk-...'
			});
			if (key) {
				await modelManager.setApiKey('openai', key);
				modelViewProvider.refresh();
				vscode.window.showInformationMessage('OpenAI API Key updated.');
				await initializeAI(aiController);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.setApiKey.openrouter', async () => {
			const key = await vscode.window.showInputBox({
				title: 'Enter OpenRouter API Key',
				password: true,
				placeHolder: 'sk-or-...'
			});
			if (key) {
				await modelManager.setApiKey('openrouter', key);
				modelViewProvider.refresh();
				vscode.window.showInformationMessage('OpenRouter API Key updated.');
				await initializeAI(aiController);
			}
		})
	);

	// Configuration change listener
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('fiction-linter.spePath')) {
				speController.reloadConfiguration();
				vscode.workspace.textDocuments.forEach(lintDocument);
			}
			if (e.affectsConfiguration('fiction-linter.enabled')) {
				updateStatusBar();
				vscode.workspace.textDocuments.forEach(lintDocument);
			}
			if (e.affectsConfiguration('fiction-linter.aiEnabled')) {
				const aiEnabled = vscode.workspace.getConfiguration('fiction-linter').get<boolean>('aiEnabled');
				if (aiEnabled) {
					initializeAI(aiController);
				} else {
					updateAIStatusBar({ status: 'disabled', message: 'AI features disabled' });
				}
			}
		})
	);

	// Register command to manually trigger re-lint
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.lintWorkspace', () => {
			vscode.workspace.textDocuments.forEach(lintDocument);
			vscode.window.showInformationMessage('Fiction Linter: Workspace linted.');
		})
	);

	// Register Toggle Command
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.toggle', async () => {
			const config = vscode.workspace.getConfiguration('fiction-linter');
			const current = config.get<boolean>('enabled');
			await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
		})
	);

	// Initialize AI and show status
	initializeAI(aiController);

	// Register AI Status Command
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.showAIStatus', () => {
			const status = aiController.getStatus();
			vscode.window.showInformationMessage(`Fiction Linter AI: ${status.message}`);
			outputChannel.show();
		})
	);

	// Register AI Toggle Command
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.toggleAI', async () => {
			const config = vscode.workspace.getConfiguration('fiction-linter');
			const current = config.get<boolean>('aiEnabled');
			await config.update('aiEnabled', !current, vscode.ConfigurationTarget.Global);
		})
	);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			[{ language: 'markdown', scheme: 'file' }, { language: 'plaintext', scheme: 'file' }],
			fixActionProvider,
			{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.fixWithAI', async (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, violation: string) => {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Fiction Linter: Generating AI Fix...",
				cancellable: false
			}, async (progress) => {
				const originalText = document.getText(range);
				// In a real scenario, we would pass specific rules based on the violation type
				const rules = "Follow standard fiction editing protocols. Avoid clichés. Be specific.";

				const fixedText = await aiController.generateFix(originalText, violation, rules);

				if (fixedText) {
					const edit = new vscode.WorkspaceEdit();
					edit.replace(document.uri, range, fixedText);
					await vscode.workspace.applyEdit(edit);
				}
			});
		})
	);

	// AI Scanner
	const scannerController = new ScannerController(context, speController, aiController, outputChannel);
	activeScanController = scannerController;

	// Register Toggle AI Scan Command
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.toggleAiScan', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('Fiction Linter: No active document to scan.');
				return;
			}

			// Only scan markdown and plaintext files
			const doc = editor.document;
			if (doc.languageId !== 'markdown' && doc.languageId !== 'plaintext') {
				vscode.window.showWarningMessage(`Fiction Linter: Cannot scan ${doc.languageId} files. Open a markdown or text file.`);
				return;
			}

			// Check if file URI (not output/untitled)
			if (doc.uri.scheme !== 'file') {
				vscode.window.showWarningMessage('Fiction Linter: Please open a saved file to scan.');
				return;
			}

			if (isScanning) {
				// Cancel current scan
				scannerController.cancelScan(editor.document.uri.toString());
				isScanning = false;
				updateScanButton();
				outputChannel.appendLine('AI Scan cancelled.');
			} else {
				// Start new scan
				isScanning = true;
				updateScanButton();

				const existingAiDiagnostics = aiDiagnosticCollection.get(editor.document.uri) || [];
				const cursorLine = editor.selection.active.line;
				await scannerController.scanDocumentProgressively(
					editor.document,
					aiDiagnosticCollection,
					[...existingAiDiagnostics],
					(progress: number) => {
						// Update button with progress
						scanButtonItem.text = `$(sync~spin) AI Scan: ${progress}%`;
					},
					cursorLine  // Pass cursor line to constrain to current chapter
				);

				isScanning = false;
				updateScanButton();
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.analyzeSelection', async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const diagnostics = await scannerController.scanSelection(editor);

				// Merge with existing AI diagnostics
				const currentDiagnostics = aiDiagnosticCollection.get(editor.document.uri) || [];
				const newDiagnostics = [...currentDiagnostics, ...diagnostics];
				aiDiagnosticCollection.set(editor.document.uri, newDiagnostics);
			}
		})
	);
}

function updateStatusBar() {
	const enabled = vscode.workspace.getConfiguration('fiction-linter').get<boolean>('enabled');
	if (enabled) {
		statusBarItem.text = '$(eye) Fiction Linter';
		statusBarItem.tooltip = 'Fiction Linter is Active (Click to Disable)';
		statusBarItem.show();
	} else {
		statusBarItem.text = '$(eye-closed) Fiction Linter';
		statusBarItem.tooltip = 'Fiction Linter is Disabled (Click to Enable)';
		statusBarItem.show();
	}
}

function lintDocument(document: vscode.TextDocument) {
	if (document.languageId !== 'markdown' && document.languageId !== 'plaintext') {
		return; // Only lint markdown/text files
	}

	const enabled = vscode.workspace.getConfiguration('fiction-linter').get<boolean>('enabled');
	if (!enabled) {
		diagnosticCollection.delete(document.uri);
		return;
	}

	const data = speController.getData();
	const patternDiagnostics = patternLinter.lint(document, data);
	const nameDiagnostics = nameValidator.lint(document, data);

	diagnosticCollection.set(document.uri, [...patternDiagnostics, ...nameDiagnostics]);
}

function updateAIStatusBar(status: AIStatusInfo) {
	switch (status.status) {
		case 'vscode-model':
			aiStatusBarItem.text = '$(hubot) AI';
			aiStatusBarItem.tooltip = `AI Connected: ${status.modelName || 'VS Code Model'}\n(Click to disable)`;
			aiStatusBarItem.backgroundColor = undefined;
			break;
		case 'api-key':
			aiStatusBarItem.text = '$(hubot) AI';
			aiStatusBarItem.tooltip = `AI Connected: ${status.modelName || 'OpenAI API'}\n(Click to disable)`;
			aiStatusBarItem.backgroundColor = undefined;
			break;
		case 'error':
			aiStatusBarItem.text = '$(warning) AI Error';
			aiStatusBarItem.tooltip = `AI Error: ${status.message}\n(Click to disable)`;
			aiStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
			break;
		case 'disabled':
			aiStatusBarItem.text = '$(circle-slash) AI Off';
			aiStatusBarItem.tooltip = 'AI features disabled\n(Click to enable)';
			aiStatusBarItem.backgroundColor = undefined;
			break;
		case 'disconnected':
		default:
			aiStatusBarItem.text = '$(circle-slash) No AI';
			aiStatusBarItem.tooltip = 'AI Not Connected\n(Click to see details)';
			aiStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
			break;
	}
	aiStatusBarItem.show();
}

async function initializeAI(aiController: AIController) {
	// Check if AI is enabled
	const aiEnabled = vscode.workspace.getConfiguration('fiction-linter').get<boolean>('aiEnabled');
	if (!aiEnabled) {
		updateAIStatusBar({ status: 'disabled', message: 'AI features disabled' });
		return;
	}

	const success = await aiController.initialize();
	const status = aiController.getStatus();
	updateAIStatusBar(status);

	// Show startup notification
	if (success) {
		vscode.window.showInformationMessage(
			`Fiction Linter: ${status.message}`,
			'View Output'
		).then(selection => {
			if (selection === 'View Output') {
				outputChannel.show();
			}
		});
	} else {
		vscode.window.showWarningMessage(
			`Fiction Linter: ${status.message}`,
			'Open Settings',
			'View Output'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'fiction-linter.openAiKey');
			} else if (selection === 'View Output') {
				outputChannel.show();
			}
		});
	}
}

/**
 * Update the AI scan button state
 */
function updateScanButton(): void {
	if (isScanning) {
		scanButtonItem.text = '$(sync~spin) Stop Scan';
		scanButtonItem.tooltip = 'AI Scan in progress (Click to cancel)';
		scanButtonItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	} else {
		scanButtonItem.text = '$(search) AI Scan';
		scanButtonItem.tooltip = 'Click to scan document with AI';
		scanButtonItem.backgroundColor = undefined;
	}
	scanButtonItem.show();
}

export function deactivate() { }
