---
id: spe-name-collider
title: Name Collider
category: SPE Rules
order: 3
summary: The Name Collider flags character names that language models reach for by default — names so common in AI-generated fiction that they signal an unrevised draft.
keywords: name, character, forbidden, ai default, kael, luna, aria, first name, last name, blackwood
---

## Name Collider

The **Name Collider** maintains a list of first names and last names that appear disproportionately often in AI-generated fiction. When your manuscript uses one of these names, Fiction Linter flags it — not because the name is bad, but because it is a statistical fingerprint of unrevised AI output.

### Why these names are flagged

Language models learn from vast amounts of text, and they develop strong preferences. A fantasy hero is statistically likely to be named Kael, Alaric, or Caspian. A contemporary heroine is likely to be Luna, Aria, or Evelyn. A villain's surname tends to be Blackwood, Thornwood, or Ravencrest. These are not invented — they are defaults baked into the model's probability distribution.

If you are revising AI-assisted prose, seeing your protagonist named "Kael Blackwood" is a reliable signal that the names were never reconsidered. Fiction Linter surfaces this so you can decide deliberately.

### Customizing the list

The list is long — over 300 first names — because it was compiled from real AI output across many genres. You may have a legitimate reason to use any name on it. To remove a name from the list, edit your own copy of `name_collider.yaml` and remove the entry, then point Settings at your custom folder.

### Adding names

You can also add names that you personally want to avoid — names your own writing gravitates toward, or names that carry unintended cultural associations in your genre. Add them under the appropriate key in your YAML file.

### See also

- [How the SPE Works](spe-how-it-works)
- [Place Collider](spe-place-collider)
- [Customizing Rules](spe-customizing-rules)
- [SPE YAML Rules](data-files-spe-yaml)
