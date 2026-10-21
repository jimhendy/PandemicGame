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
1. Put `APP_PASSWORD` and `TUNNEL_TOKEN` in `secrets.env` (gitignored)
2. In the Cloudflare dashboard, give the tunnel a public hostname (e.g. pandemic.jimhendy.com) pointing at `http://pandemic:3001`
3. $ docker compose up -d --build

When APP_PASSWORD is set the site uses HTTP basic auth (any username).
