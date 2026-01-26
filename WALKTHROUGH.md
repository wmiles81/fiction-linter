# Fiction Linter Walkthrough

The **Fiction Linter** is now installed and ready to help you write high-entropy fiction.

## Prerequisites

Ensure you have your **Semantic Physics Engine (SPE)** YAML files available locally.
You will need the path to the folder containing:
- `cliche_collider.yaml`
- `name_collider.yaml`
- `line_editing_protocol.yaml`
- `place_collider.yaml`

## Setup

1.  **Open VS Code Settings** (`Cmd+,`).
2.  Search for **Fiction Linter**.
3.  Set **Spe Path** to the absolute path of your SPE directory.
    *   *Example:* `/Volumes/home/ai-tools/AntiGravity/Workflows/semantic_physics_engine`

## Usage

1.  Open any `.md` or `.txt` file.
2.  The linter will automatically scan your text.
3.  **Blue Squiggles**: Informational (Weak descriptors, etc.)
4.  **Yellow Squiggles**: Warning (Somatic cliches, Tells)
5.  **Red Squiggles**: Error (Banned cliches, Forbidden names)
6.  Hover over a squiggle to see the penalty score and suggested fix.

## Testing

Create a test file `test_chapter.md` with some known violations to verify:
```markdown
He released a breath he didn't know he was holding.
A shiver went down his spine.
It was almost as if the air was thick.
His name was Kael.
```
You should see diagnostics appear immediately.
