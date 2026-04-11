export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintFinding {
    start: number;
    end: number;
    message: string;
    severity: LintSeverity;
    source?: string;
}

export interface SPEData {
    cliches: any;
    names: any;
    places: any;
    protocols: any;
}
