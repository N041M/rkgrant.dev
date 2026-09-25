# rkgrant.dev

The portfolio site of R. K. Grant, in English and Czech. It is plain HTML, CSS and JavaScript with no build step.

## Where things are

- `index.html` holds all the text. Every piece of text exists twice, once with `lang="en"` and once with `lang="cs"`, and the page shows the one that matches the chosen language.
- `assets/css/site.css` sets the colours at the top of the file. `--accent` is the one colour besides black and white, and the background picks it up as well.
- `assets/js/field.js` draws the glyph background behind the page: the ridgeline plot, the water under the footer, the ruler under the top bar and the trail the pointer leaves.
- `assets/js/drive/` draws the drive on the first screen, on its own canvas under the field. The car drives an endless route that is generated as it goes, through cities, highways, a bridge, the coast, a desert, a rally stage, farmland, villages, forest, mountains and a winter valley. The time of day and the weather change slowly. The scenery is drawn as pixel art. A character look in the style of the first drive is kept in the code and shows with `?drive=ascii` in the address. The rules the drive follows are in `docs/drive-rules.md`, and every change to it should be checked against them.
  - `core.js` holds the materials, the light and weather colouring, and the small sprites every picture is drawn into.
  - `art-nature.js`, `art-built.js` and `art-beings.js` draw the pictures: plants, buildings and signs, and people, animals and vehicles.
  - `world.js` holds the places, the regions and the route.
  - `weather.js` holds the weather, the clouds and the rain and snow.
  - `scenes.js` holds everything that moves: people, animals, the football pitch, traffic, trains, boats, birds, planes and the UFO.
  - `ascii.js` redraws the pictures in characters the way the first drive built its scene, and draws the road and the fences row by row.
  - `engine.js` builds the planes of scenery and draws each frame.
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
