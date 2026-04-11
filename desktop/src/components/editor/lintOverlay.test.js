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
});
