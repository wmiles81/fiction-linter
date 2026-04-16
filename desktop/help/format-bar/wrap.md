---
id: format-wrap
title: Wrap
category: Format Bar
order: 7
summary: Toggles soft line wrapping in the editor. When wrap is on, long lines fold at the window edge. When wrap is off, lines extend horizontally and a scrollbar appears.
keywords: wrap, line wrap, soft wrap, scrollbar, horizontal, toggle
---

## Wrap

The **Wrap** button at the far right of the format bar (directly above the editor) toggles soft line wrapping on and off.

### Wrap on (default)

When wrapping is on, long paragraphs fold at the right edge of the editor pane. No horizontal scrolling is needed. This is the most comfortable mode for writing and reading prose, since lines stay within view regardless of the window width.

The **Wrap** button is highlighted when wrapping is active.

### Wrap off

When wrapping is off, each paragraph stays on a single unbroken line. A horizontal scrollbar appears at the bottom of the editor if any line is wider than the visible area.

This mode is occasionally useful when reviewing structured content where line breaks are meaningful, or when you want to see the full length of a sentence without it folding.

### Persistence

The wrap setting is saved automatically and restored when you reopen Fiction Linter. There is no separate setting in the Settings dialog — the button in the format bar is the only control.

### Effect on findings

Wrapping is a display-only setting. It has no effect on how findings are detected, counted, or saved. Underline highlights follow the text regardless of whether lines wrap.

### See also

- [Font Size](format-font-size)
- [Line Numbers](toolbar-line-numbers)
