import { LintFinding, SPEData } from './types';

export class NameValidatorCore {
    public lintText(text: string, data: SPEData): LintFinding[] {
        const findings: LintFinding[] = [];

        if (data.names && data.names.global_exclusion) {
            this.checkNames(text, data.names.global_exclusion.forbidden_first_names, 'Forbidden First Name', findings);
            this.checkNames(text, data.names.global_exclusion.forbidden_surnames, 'Forbidden Surname', findings);
        }

        if (data.places && data.places.global_exclusion) {
            this.checkNames(text, data.places.global_exclusion.forbidden_town_names, 'Forbidden Town Name', findings);
            this.checkNames(text, data.places.global_exclusion.forbidden_city_names, 'Forbidden City Name', findings);
            this.checkNames(text, data.places.global_exclusion.forbidden_fantasy_locations, 'Forbidden Fantasy Location', findings);
        }

        return findings;
    }

    private checkNames(text: string, names: string[], category: string, findings: LintFinding[]) {
        if (!names || !Array.isArray(names)) return;

        for (const name of names) {
            const regex = new RegExp(`\\b${this.escapeRegExp(name)}\\b`, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const message = `${category}: "${name}". This is a high-frequency AI default name.`;
                findings.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    message,
                    severity: 'warning',
                    source: 'Fiction Linter'
                });
            }
        }
    }

    private escapeRegExp(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
