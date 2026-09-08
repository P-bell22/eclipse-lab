# Eclipse Lab

An interactive solar system and eclipse lab for teaching the difference between total, partial, annular and lunar eclipses.
Three tabs: **Solar System** (real positions, true scale), **Eclipse Lab** (sandbox and real sky, NASA Besselian elements) and **Eclipse Simple**.

Live site: https://p-bell22.github.io/eclipse-lab/

## Watch a year

In **Eclipse Lab → Watch a year**, press **Play year** for a guided tour of 2027 (2 minutes 21 seconds at normal speed).
The tour follows all 13 new moons: 11 miss Earth, 6 February produces an annular eclipse, and 2 August produces a total eclipse.
Two new moons fall in August; lunar cycles are not calendar months.

Use Previous/Next, the dated new-moon buttons, or the timeline to pause at an alignment. Playback speeds are 0.5×, 1× and 2×.
**Inspect the shadow** magnifies the Earth and its nearby shadow; the longer eclipse stops also zoom in during playback.
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
- `src/bessel_data.js` holds the Besselian elements for every solar eclipse 2026–2050, from NASA/GSFC (Fred Espenak).
- `src/vendor/astronomy.browser.min.js` is Astronomy Engine 2.1.19 (Don Cross, MIT).
- `src/year-tour.js` calculates the new-moon schedule, presentation timing and real orbital plane; `src/year-tour-ui.js` connects it to the lab.

Run the astronomy and playback checks with `node --test tests/year-tour.test.cjs`.

## Credits

Planet and moon maps from NASA 3D Resources; Earth from NASA Blue Marble / Black Marble; Moon from NASA/USGS Clementine.
Real-sky positions and the eclipse catalogue from Astronomy Engine. Solar eclipse tracks and timings from NASA/GSFC Besselian elements.
