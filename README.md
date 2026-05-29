# Upper Capital

Website for Upper Capital — a seed + growth venture fund based in San Juan, Puerto Rico.

Live at **https://jaredb650.github.io/UpperCapital/**

## Repo layout

```
/
├── index.html        # The site
├── styles.css        # All styling
├── script.js         # Cursor, type scramble, scroll reveals, footer clock
├── content/
│   └── source.md     # Reference copy scraped from the old upper.capital
└── shared/
    └── placeholders/ # Reserved for client-supplied assets
```

Single page, vanilla HTML/CSS/JS, no build step, no framework. Only external dependency is JetBrains Mono loaded from Google Fonts.

## Editing content

All copy is hard-coded in `index.html` between HTML tags. To change wording:

1. Open `index.html` in any editor (or Claude Code on the web).
2. Find the text you want to change.
3. Replace it.
4. Save and commit — GitHub Pages auto-rebuilds in ~30s.

## Theme

- Background: near-black (`#08080a`)
- Accent (the "hot" colour): electric fuchsia (`#c026d9`) — defined as `--hl` in `styles.css`. Change the variable to re-tint the entire site.
- Font: JetBrains Mono throughout.
