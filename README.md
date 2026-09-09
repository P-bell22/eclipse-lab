# Eclipse Lab

An interactive solar system and eclipse lab for teaching the difference between total, partial, annular and lunar eclipses.
Three tabs: **Solar System** (real positions, true scale), **Eclipse Lab** (sandbox and real sky, NASA Besselian elements) and **Eclipse Simple**.

Live site: https://p-bell22.github.io/eclipse-lab/

## Watch a year

In **Eclipse Lab → Watch a year**, choose any year from **2026–2050** and press **Play year**.
The year picker and adjacent arrows switch years and pause at the start. Dates, new moons, eclipse types, explanations, totals and duration all follow the selected year.
Enable **Continue into the next year** to play successive years. Each year ends with a short summary; playback stops at the end of 2050.

The default 2027 tour takes 2 minutes 21 seconds and follows 13 new moons: 11 miss Earth, 6 February produces an annular eclipse, and 2 August produces a total eclipse.
Other years have 12 or 13 new moons and different combinations of partial, annular, total and hybrid eclipses. For example, 2029 has four partial eclipses and no totality; 2031 includes a hybrid eclipse.
Lunar cycles are not calendar months, so two new moons sometimes fall in the same month.

Use Previous/Next, the dated new-moon buttons, or the timeline to pause at an alignment. Playback speeds are 0.5×, 1× and 2×.
Drag to orbit, scroll/pinch to zoom, or right-drag/two-finger drag to pan, even during playback. Moving the camera keeps your chosen angle, zoom and position when you resume, change dates or years, or reach an eclipse. **Use guided camera** restores the automatic framing and eclipse close-ups. **Inspect the shadow** still offers an explicit camera move.
**Inspect the shadow** magnifies the Earth and its nearby shadow; the longer eclipse stops also zoom in during playback.
At eclipse close-ups, a marker locates the eclipse centre and an inset shows the Sun as seen from that spot, including the annular ring of fire.
For partial eclipses and rare grazing eclipses whose shadow axis misses Earth, the marker identifies an example sunlit location, with the Sun at least 3° above the horizon; it does not claim to mark the global maximum. Hybrid eclipses have their own explanation and show the local type at the marked spot.
The outer shadow uses muted blue and fades into space beyond Earth; the umbra still ends at its physically calculated tip.
The small year overview shows Earth travelling around the Sun with enlarged bodies and compressed distances. The main 3D lab stays at true scale.
Eclipse types refer to what happens somewhere on Earth, not necessarily at the saved home location. Dates are UTC.

The tour pauses when changing tabs or hiding the page, preserves its position when revisited, and restores the previous lab settings when leaving the mode.
Reduced-motion playback uses static teaching stops and avoids animated camera travel.

The whole app is the single file `index.html`. It loads only two things from the web: three.js from cdnjs and two fonts from Google Fonts.

## Hosting on GitHub Pages

1. Create a repository (public, unless you have GitHub Pro for private Pages) and push these files to the `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. After a minute the site is live at `https://<your-username>.github.io/<repository>/`.

`.nojekyll` is included so GitHub serves the file as-is.

## Rebuilding after a change

The editable sources are in `src/`. Edit `src/eclipse-lab.src.html` (or `src/simple.src.js`, `src/bessel.js`), then run

    python3 src/build.py

which writes a fresh `index.html`. Commit and push, and Pages redeploys on its own.

- `src/assets.js` holds the packed NASA texture maps (built by `src/build_assets.py` from a `tex/` folder of JPEGs, not included).
- `src/bessel_data.js` holds the Besselian elements and NASA catalogue classification for every solar eclipse 2026–2050, from NASA/GSFC (Fred Espenak).
- `src/vendor/astronomy.browser.min.js` is Astronomy Engine 2.1.19 (Don Cross, MIT).
- `src/year-tour.js` calculates the new-moon schedule, presentation timing and real orbital plane; `src/year-tour-ui.js` connects it to the lab.

Run the astronomy, playback and camera checks with `node --test tests/*.test.cjs`.

## Credits

Planet and moon maps from NASA 3D Resources; Earth from NASA Blue Marble / Black Marble; Moon from NASA/USGS Clementine.
Real-sky positions and the eclipse catalogue from Astronomy Engine. Solar eclipse tracks and timings from NASA/GSFC Besselian elements.
