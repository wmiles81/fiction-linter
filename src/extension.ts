import * as vscode from 'vscode';
import { SPEController } from './controllers/SPEController';
import { PatternLinter } from './linters/PatternLinter';
import { NameValidator } from './linters/NameValidator';

let speController: SPEController;
let diagnosticCollection: vscode.DiagnosticCollection;
let patternLinter: PatternLinter;
let nameValidator: NameValidator;

export function activate(context: vscode.ExtensionContext) {
	console.log('Fiction Linter is now active');

	speController = new SPEController(context);
	patternLinter = new PatternLinter();
	nameValidator = new NameValidator();
	diagnosticCollection = vscode.languages.createDiagnosticCollection('fiction-linter');

	context.subscriptions.push(diagnosticCollection);

	// Lint active document on load
	if (vscode.window.activeTextEditor) {
		lintDocument(vscode.window.activeTextEditor.document);
	}

	// Lint on change
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			lintDocument(event.document);
		})
	);

	// Lint on open
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			lintDocument(doc);
		})
	);

	// Configuration change listener
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('fiction-linter.spePath')) {
				speController.reloadConfiguration();
				// Re-lint all open documents
				vscode.workspace.textDocuments.forEach(lintDocument);
			}
		})
	);

	// Register command to manually trigger re-lint (useful for debug)
	context.subscriptions.push(
		vscode.commands.registerCommand('fiction-linter.lintWorkspace', () => {
			vscode.workspace.textDocuments.forEach(lintDocument);
			vscode.window.showInformationMessage('Fiction Linter: Workspace linted.');
		})
	);
}

function lintDocument(document: vscode.TextDocument) {
	if (document.languageId !== 'markdown' && document.languageId !== 'plaintext') {
		return; // Only lint markdown/text files
	}

	const data = speController.getData();
	const patternDiagnostics = patternLinter.lint(document, data);
	const nameDiagnostics = nameValidator.lint(document, data);

	diagnosticCollection.set(document.uri, [...patternDiagnostics, ...nameDiagnostics]);
}

export function deactivate() { }
