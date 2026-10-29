# Slope (original build)

The original Slope game (Unity WebGL build by Rob Kay, published by IDnet / Y8), taken from
github.com/cgolden15/Slope-Game, with the ads, analytics and banner of that page removed.
It runs full screen, works offline after the first load, and can be installed as an app.

## Run it
Serve this folder with any static web server, for example `python3 -m http.server`, then open
http://localhost:8000. Opening index.html straight from disk does not work (Unity needs a server).

## Change things
The game logic is compiled, but the numbers it uses (forces, steering, speed-ups, gravity,
colors, texts) sit in Build/slope_data.unityweb and can be patched in place.
Bump VERSION in sw.js after any change so installed copies update.
