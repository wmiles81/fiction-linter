import { describe, it, expect } from 'vitest';
import { PatternLinterCore } from './PatternLinterCore';
import { SPEData } from './types';

function makeData(): SPEData {
    return {
        cliches: {
            somatic_cliches: [
                {
                    phrase: 'shiver down his spine',
                    penalty_score: 5,
                    exclude_dialogue: true,
                    suggested_fix: 'use a specific sensory detail'
                }
            ]
        },
        names: {},
        places: {},
        protocols: {}
    };
}

describe('PatternLinterCore.isInsideQuotes (via lintText)', () => {
    const core = new PatternLinterCore();

    it('flags the phrase when it is outside any quotes', () => {
        const text = 'He felt a shiver down his spine as the door creaked.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('shiver down his spine');
    });

    it('excludes the phrase when it is inside a single-line quoted dialogue', () => {
        const text = '"I felt a shiver down his spine," she whispered.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });

    it('excludes the phrase when a multi-line quote opens before and closes after (same paragraph)', () => {
        const text = [
            '"Everything in me tightened as',
            'a shiver down his spine told me',
            'this was the moment I had feared."'
        ].join('\n');
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });

    it('flags the phrase when the opening quote is in a different paragraph', () => {
        const text = [
            '"This was the moment," he said.',
            '',
            'He stood alone, a shiver down his spine settling into dread.'
        ].join('\n');
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(1);
    });

    it('treats curly quotes the same as straight quotes', () => {
        const text = '\u201CI felt a shiver down his spine,\u201D she whispered.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });
});
