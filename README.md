# PandemicGame

Little lockdown project to learn javascript. Feedback would be greatly appreciated.

TODO:

* Remove all other player options as soon as forecast is selected (currently can use forecast to investigate cards and then current player can start action so we know the upcoming infection cards without using the forecast card)

* Download font to provide from static directory
* Match font to game font on board (irsa thin)

* log file
* Random state and log actions for replication

* Font sizes should be in %/vh, still having issue with overflow of divs from top right (current city etc)

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Locally:
$ node server/server.js

Via Cloudflare tunnel (docker):
1. Put these in `secrets.env` (gitignored; `.env` is committed, so no secrets there):
   - `APP_PASSWORD`: the site password
   - `SECRET_KEY`: signs the login cookie, e.g. `openssl rand -hex 32`
   - `RESET_PASSWORD`: entered as the game code, starts a new game and shows its code
   - `TUNNEL_TOKEN`: from the Cloudflare Zero Trust dashboard
2. In the Cloudflare dashboard, give the tunnel a public hostname (e.g. pandemic.jimhendy.com) pointing at `http://pandemic:3001`
3. $ docker compose up -d --build

When APP_PASSWORD is set the site asks for it once, then remembers the browser with a cookie for a year.
