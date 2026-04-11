import { describe, it, expect } from 'vitest';
import { buildOffsetMap, rangeFromOffsets } from './lintOverlay';

function makeDom(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    return container;
}

describe('buildOffsetMap', () => {
    it('builds plain text from a simple paragraph', () => {
        const root = makeDom('<p>Hello world</p>');
        const { text, map } = buildOffsetMap(root);
        expect(text).toBe('Hello world');
        expect(map.length).toBeGreaterThan(0);
    });

    it('joins adjacent text nodes without separator', () => {
        const root = makeDom('<p>Hello <strong>bold</strong> world</p>');
        const { text } = buildOffsetMap(root);
        expect(text).toBe('Hello bold world');
    });

    it('inserts \\n\\n between block-level elements', () => {
        const root = makeDom('<p>First</p><p>Second</p>');
        const { text } = buildOffsetMap(root);
        expect(text).toBe('First\n\nSecond');
    });

    it('inserts \\n\\n around horizontal rules', () => {
        const root = makeDom('<p>Before</p><hr><p>After</p>');
        const { text } = buildOffsetMap(root);
        expect(text).toBe('Before\n\n---\n\nAfter');
    });
});

describe('rangeFromOffsets', () => {
    it('returns a Range for offsets inside a single text node', () => {
        const root = makeDom('<p>Hello world</p>');
        const { map } = buildOffsetMap(root);
        document.body.appendChild(root);
        const range = rangeFromOffsets(map, 6, 11); // "world"
        expect(range).toBeInstanceOf(Range);
        expect(range.toString()).toBe('world');
        document.body.removeChild(root);
    });

    it('returns a Range spanning across text nodes', () => {
        const root = makeDom('<p>Hello <strong>bold</strong> world</p>');
        document.body.appendChild(root);
        const { map } = buildOffsetMap(root);
        // "Hello bold world" — offsets 6-10 = "bold"
        const range = rangeFromOffsets(map, 6, 10);
        expect(range.toString()).toBe('bold');
        document.body.removeChild(root);
    });

    it('clamps out-of-range offsets', () => {
        const root = makeDom('<p>Hi</p>');
        document.body.appendChild(root);
        const { map } = buildOffsetMap(root);
        const range = rangeFromOffsets(map, 0, 999);
        expect(range.toString()).toBe('Hi');
        document.body.removeChild(root);
    });

    it('returns null for empty DOM', () => {
        const root = makeDom('');
        const { map } = buildOffsetMap(root);
        const range = rangeFromOffsets(map, 0, 5);
        expect(range).toBeNull();
    });

    it('does not crash when offset falls in a synthetic separator region between text nodes', () => {
        // The text representation of <p>Hello</p><p>World</p> is "Hello\n\nWorld"
        // (length 12). The text nodes are at [0,5] (Hello) and [7,12] (World).
        // Offsets 5 and 6 land in the synthetic "\n\n" separator with no
        // backing text node — this used to crash with a DOMException because
        // findEntryContaining fell through to the last entry and produced a
        // negative local offset.
        const root = makeDom('<p>Hello</p><p>World</p>');
        document.body.appendChild(root);
        const { map } = buildOffsetMap(root);
        const range = rangeFromOffsets(map, 5, 6);
        expect(range).toBeInstanceOf(Range);
        // The exact text the range covers does not matter — only that we
        // got a valid Range object back without throwing.
        document.body.removeChild(root);
    });

    it('does not crash on offsets far past the end of the text', () => {
        // Simulates the markdown-vs-DOM coordinate mismatch bug: a finding
        // computed against a markdown source whose offsets exceed the DOM
        // text length (because the markdown has syntax markers that the DOM
        // text does not). Should clamp gracefully, not throw.
        const root = makeDom('<p>Short</p>');
        document.body.appendChild(root);
        const { map } = buildOffsetMap(root);
        // Offsets in the thousands, far beyond "Short" (length 5)
        const range = rangeFromOffsets(map, 1500, 2000);
        expect(range).toBeInstanceOf(Range);
        document.body.removeChild(root);
    });

    it('does not crash when end < start globally (caller bug)', () => {
        // Defensive: if a caller somehow passes end < start, we clamp end
        // to start instead of producing an inverted Range.
        const root = makeDom('<p>Hello world</p>');
        document.body.appendChild(root);
        const { map } = buildOffsetMap(root);
        const range = rangeFromOffsets(map, 8, 3);
        // Should not throw and should produce a valid (possibly empty) range
        expect(range === null || range instanceof Range).toBe(true);
        document.body.removeChild(root);
    });
});
