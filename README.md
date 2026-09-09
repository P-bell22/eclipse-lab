# Eclipse Lab

An interactive solar system and eclipse lab for teaching the difference between total, partial, annular and lunar eclipses.
Three tabs: **Solar System** (real positions, true scale), **Eclipse Lab** (sandbox and real sky, NASA Besselian elements) and **Eclipse Simple**.

Live site: https://p-bell22.github.io/eclipse-lab/

## Sizes and the Milky Way

In **Solar System → Squashed up**, choose **Proportional** to give the Sun, planets and moons correct relative sizes while keeping their orbital distances compressed. The default **Enlarged** setting magnifies each body independently for visibility. **True scale** uses one physical scale for both sizes and distances, with spherical bodies based on rounded mean radii.

Choose **Line-up** for a side-by-side diameter comparison. **Planet order** follows the familiar order out from the Sun; **Smallest first** sorts the other bodies by radius, keeping the Sun first. Pluto is included as a dwarf planet. Moons are excluded from this comparison, and Saturn's rings have room of their own. The orthographic camera preserves size ratios at every zoom. Drag to pan, scroll/pinch to zoom, select a name to inspect a body, or use **Fit all**. Returning to **Orbits** restores the preceding size setting, camera and playback state; the planetary clock pauses in the line-up.

Keep zooming out to leave the solar system, or use **View Milky Way**. Squashed up first transitions into True scale, then the continuous camera can travel across physical distances to frame the galaxy. **Return to solar system**, or the solar-system location marker, returns to the preceding presentation. Manual zooming inward near the Sun also restores that presentation. Scale bars show kilometres, astronomical units (AU), or light-years on the plane through the camera target. The line-up's bar represents body dimensions; no physical distance bar is shown for compressed orbits.

The Milky Way is an **illustrative, static reconstruction**, approximately 100,000 light-years across, with the Sun approximately 26,000 light-years from the centre in the Orion spur. Its spiral structure and luminous clouds are not a catalogue of individual stars. A marker locates the solar system when its physical bodies are too small to resolve; that marker is not to scale. The planetary simulation's date range does not animate the galaxy. A standard J2000 galactic-coordinate rotation orients its plane relative to the solar system. Local bodies render in millions of kilometres with a floating origin; the galaxy renders in light-years using the same physical camera position.

Measurements: [NASA Milky Way overview](https://imagine.gsfc.nasa.gov/science/featured_science/milkyway/), [IAU nominal solar radius](https://www.iau.org/static/resolutions/IAU2015_English.pdf), [JPL astronomical unit](https://ssd.jpl.nasa.gov/glossary/au.html), and [JPL planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html).

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
The outer shadow uses muted blue. Parts that meet Earth stop at its curved surface; parts that miss continue into space and fade. The umbra still ends at its physically calculated tip when it falls short of Earth.
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
- `src/system-scale.js` holds physical units, size comparisons and galactic coordinate conversion; `src/system-view.js` handles the comparison and travel controls; `src/galaxy-view.js` renders the illustrative galaxy without additional downloads.

Run the astronomy, playback and camera checks with `node --test tests/*.test.cjs`.

After rebuilding and starting a local HTTP server, run the production browser checks with `node tests/system-view.browser.cjs http://127.0.0.1:4176/eclipse-lab-site/`. They use an existing Playwright installation and Chrome; `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` can specify their paths. These checks cover actual mesh sizes, camera and date restoration, both zoom directions, tab switches, reduced motion and mobile framing.

## Credits

Planet and moon maps from NASA 3D Resources; Earth from NASA Blue Marble / Black Marble; Moon from NASA/USGS Clementine.
Real-sky positions and the eclipse catalogue from Astronomy Engine. Solar eclipse tracks and timings from NASA/GSFC Besselian elements.
