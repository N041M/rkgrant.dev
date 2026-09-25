# rkgrant.dev

The portfolio site of R. K. Grant, in English and Czech. It is plain HTML, CSS and JavaScript with no build step.

## Where things are

- `index.html` holds all the text. Every piece of text exists twice, once with `lang="en"` and once with `lang="cs"`, and the page shows the one that matches the chosen language.
- `assets/css/site.css` sets the colours at the top of the file. `--accent` is the one colour besides black and white, and the background picks it up as well.
- `assets/js/field.js` draws the moving glyph background. On the first screen the car drives past a coastline city, a highway where it overtakes traffic, a bridge, a shore road, a desert, a rally stage, farmland, a village, a forest, mountains and a winter valley while the day turns to night. Each change of place has its own set piece, such as the town signs, the bridge anchorages, a fuel station, the rally start and finish, a rock cutting and a harbour crane. The ridgeline plot sits behind the rest of the page and water runs under the footer.
- `assets/js/figures.js` draws the small figures on the project cards and the globe in the contact section. The globe is shaded as a lit sphere and marks Jablonec nad Nisou. Visitors can drag it, zoom in with the buttons, a double click, a pinch or the wheel once they have clicked it, and read the name of the country under the pointer.
- `assets/data/world.png` and `world.json` hold the map for the globe. Each pixel of the image stores which country it belongs to, and the JSON lists the countries with their ISO codes, label positions and sizes. The browser supplies the country names in English and Czech.
- `tools/build-world.js` rebuilds both files from Natural Earth's 1:50m countries. It is run by hand when the map data changes, not as part of a build.
- `assets/js/scramble.js` is the text scramble from [Addison](https://github.com/N041M/Addison), ported to plain JavaScript.
- `assets/js/site.js` handles the language and theme switches.

Everything that moves stops when the visitor's system asks for reduced motion.

## Map data

The globe uses [Natural Earth](https://www.naturalearthdata.com)'s 1:50m admin-0 countries, which are in the public domain. To rebuild the map, download `ne_50m_admin_0_countries.geojson` from the [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson) repository and run:

```sh
node tools/build-world.js ne_50m_admin_0_countries.geojson assets/data
```

## Fonts

[Departure Mono](https://departuremono.com) by Helena Zhang and [Geist](https://vercel.com/font) by Vercel, both under the SIL Open Font License. The licence texts are in `assets/fonts/`.
