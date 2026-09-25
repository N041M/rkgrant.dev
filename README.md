# rkgrant.dev

The portfolio site of R. K. Grant, in English and Czech. It is plain HTML, CSS and JavaScript with no build step.

## Where things are

- `index.html` holds all the text. Every piece of text exists twice, once with `lang="en"` and once with `lang="cs"`, and the page shows the one that matches the chosen language.
- `assets/css/site.css` sets the colours at the top of the file. `--accent` is the one colour besides black and white, and the background picks it up as well.
- `assets/js/field.js` draws the moving glyph background. On the first screen the car drives past a coastline city, a highway where it overtakes traffic, a bridge, a shore road, a desert, a rally stage, farmland, a village, a forest, mountains and a winter valley while the day turns to night. Each change of place has its own set piece, such as the town signs, the bridge anchorages, a fuel station, the rally start and finish, a rock cutting and a harbour crane. The ridgeline plot sits behind the rest of the page and water runs under the footer.
- `assets/js/figures.js` draws the small figures on the project cards and the globe in the contact section.
- `assets/js/scramble.js` is the text scramble from [Addison](https://github.com/N041M/Addison), ported to plain JavaScript.
- `assets/js/site.js` handles the language and theme switches.

Everything that moves stops when the visitor's system asks for reduced motion.

## Fonts

[Departure Mono](https://departuremono.com) by Helena Zhang and [Geist](https://vercel.com/font) by Vercel, both under the SIL Open Font License. The licence texts are in `assets/fonts/`.
