import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SPEData } from '../shared/linting';

export class SPEController {
    private spePath: string = '';
    private data: SPEData = { cliches: {}, names: {}, places: {}, protocols: {} };
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Fiction Linter SPE');
        this.reloadConfiguration();
    }

    public reloadConfiguration() {
        const config = vscode.workspace.getConfiguration('fiction-linter');
        const userPath = config.get<string>('spePath');

        if (userPath && userPath.trim() !== '') {
            this.spePath = userPath;
            this.outputChannel.appendLine(`Using user-configured SPE path: ${this.spePath}`);
        } else {
            // Fallback to bundled resources
            this.spePath = this.context.asAbsolutePath(path.join('resources', 'spe_defaults'));
            this.outputChannel.appendLine(`No user path configured. Using bundled defaults: ${this.spePath}`);
            vscode.window.showInformationMessage('Fiction Linter: Using bundled default SPE rules.');
        }

        this.loadExampleData();
    }

    private loadExampleData() {
        try {
            this.data.cliches = this.loadYaml('cliche_collider.yaml');
            this.data.names = this.loadYaml('name_collider.yaml');
            this.data.places = this.loadYaml('place_collider.yaml');
            this.data.protocols = this.loadYaml('line_editing_protocol.yaml');
            this.outputChannel.appendLine('SPE Data loaded successfully.');
        } catch (error) {
            this.outputChannel.appendLine(`Error loading SPE data: ${error}`);
            vscode.window.showErrorMessage(`Fiction Linter: Error loading data. Check Output panel.`);
        }
    }

    private loadYaml(filename: string): any {
        const filePath = path.join(this.spePath, filename);
        if (fs.existsSync(filePath)) {
            const fileContents = fs.readFileSync(filePath, 'utf8');
            return yaml.load(fileContents);
        } else {
            this.outputChannel.appendLine(`Warning: Could not find file ${filename} at ${this.spePath}`);
        }
        return {};
    }

    public getData(): SPEData {
        return this.data;
    }
}
