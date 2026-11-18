# AI Executive Briefing

A twice-weekly briefing (Monday and Thursday) on what is really happening in AI, with a data and analytics lens.

**Read it:** https://kimse944.github.io/ai-executive-briefing/

Each edition is researched and written by Claude, then reviewed before it is published. Every item links to the report it rests on; figures are as reported by the cited source, and vendor claims are labelled as such.

## How the site works

- `index.html`, `style.css`, `app.js`: the page. It has no build step and loads nothing but its own files and Google Fonts.
- `editions/<YYYY-MM-DD>.json`: one file per edition.
- `editions/index.json`: the list of editions. Generated, never edited by hand.
- `scripts/add_edition.py`: validates edition files and regenerates `editions/index.json`. Run `python3 scripts/add_edition.py path/to/new-edition.json` to add one.

New editions arrive as pull requests and go live when merged into `main`.
