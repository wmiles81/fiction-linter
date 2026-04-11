import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileTree from './FileTree';

const sampleNodes = [
    { name: 'manuscript.md', path: '/p/manuscript.md', isDirectory: false, expanded: false, children: null },
    { name: 'chapter1.txt', path: '/p/chapter1.txt', isDirectory: false, expanded: false, children: null },
    { name: 'cover.jpg', path: '/p/cover.jpg', isDirectory: false, expanded: false, children: null },
    { name: 'old-version.docx', path: '/p/old.docx', isDirectory: false, expanded: false, children: null },
    { name: 'drafts', path: '/p/drafts', isDirectory: true, expanded: false, children: null }
];

describe('FileTree', () => {
    it('renders all file entries including ineligible ones', () => {
        render(<FileTree nodes={sampleNodes} onToggle={() => {}} onSelect={() => {}} selectedPath={null} />);
        expect(screen.getByText('manuscript.md')).toBeInTheDocument();
        expect(screen.getByText('chapter1.txt')).toBeInTheDocument();
        expect(screen.getByText('cover.jpg')).toBeInTheDocument();
        expect(screen.getByText('old-version.docx')).toBeInTheDocument();
        expect(screen.getByText('drafts')).toBeInTheDocument();
    });

    it('marks ineligible files with the disabled class', () => {
        const { container } = render(
            <FileTree nodes={sampleNodes} onToggle={() => {}} onSelect={() => {}} selectedPath={null} />
        );
        const jpgRow = container.querySelector('[data-path="/p/cover.jpg"]');
        const docxRow = container.querySelector('[data-path="/p/old.docx"]');
        const mdRow = container.querySelector('[data-path="/p/manuscript.md"]');
        expect(jpgRow?.className).toMatch(/disabled/);
        expect(docxRow?.className).toMatch(/disabled/);
        expect(mdRow?.className).not.toMatch(/disabled/);
    });

    it('does not call onSelect when an ineligible file is clicked', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(<FileTree nodes={sampleNodes} onToggle={() => {}} onSelect={onSelect} selectedPath={null} />);
        await user.click(screen.getByText('cover.jpg'));
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('calls onSelect for eligible files', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(<FileTree nodes={sampleNodes} onToggle={() => {}} onSelect={onSelect} selectedPath={null} />);
        await user.click(screen.getByText('manuscript.md'));
        expect(onSelect).toHaveBeenCalledWith(sampleNodes[0]);
    });

    it('directories always clickable regardless of contents', async () => {
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(<FileTree nodes={sampleNodes} onToggle={onToggle} onSelect={() => {}} selectedPath={null} />);
        await user.click(screen.getByText('drafts'));
        expect(onToggle).toHaveBeenCalledWith('/p/drafts');
    });
});
