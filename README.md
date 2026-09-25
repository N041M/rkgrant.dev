# rkgrant.dev

The portfolio site of Ronald Karel Grant, in English and Czech. It is plain HTML, CSS and JavaScript with no build step.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Where things are

- `index.html` holds all the text. Every piece of text exists twice, once with `lang="en"` and once with `lang="cs"`, and the page shows the one that matches the chosen language.
- `assets/css/site.css` sets the colours at the top of the file. `--accent` is the one colour besides black and white, and the background picks it up as well.
- `assets/js/field.js` draws the moving glyph background: the landscape and car on the first screen, the ridgeline plot behind the rest of the page, and the water under the footer.
- `assets/js/figures.js` draws the small figures on the project cards and the globe in the contact section.
- `assets/js/scramble.js` is the text scramble from [Addison](https://github.com/N041M/Addison), ported to plain JavaScript.
- `assets/js/site.js` handles the language and theme switches.

Everything that moves stops when the visitor's system asks for reduced motion.

## Hosting

GitHub Pages serves the `main` branch from the repository root.

For the domain, the DNS for `rkgrant.dev` needs these records:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | n041m.github.io |

`.dev` domains only load over HTTPS. GitHub issues the certificate once the records resolve, and "Enforce HTTPS" can then be turned on in the repository's Pages settings.

## Fonts

[Departure Mono](https://departuremono.com) by Helena Zhang and [Geist](https://vercel.com/font) by Vercel, both under the SIL Open Font License. The licence texts are in `assets/fonts/`.
