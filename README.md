# PandemicGame

Little lockdown project to learn javascript: the Pandemic board game, online, for up to four friends.

## Playing

- Log in with the site password, choose a name, then create a game and share its link (or pick one from the games list).
- Everyone picks a role and says they're ready; the host starts the game. Several games can run at once.
- Refreshing, or losing your connection, puts you straight back in your seat. Anyone else who opens a game that's already started watches it.
- On your turn, click a city to go there. Rings show the cities you can drive to, and how many actions it takes; planes show where your cards can fly you. You can also pick actions from the list on the right, including treating several cubes at once.
- The panel on the right shows every player's role, city and cards (hands are open in Pandemic).

Games live in memory, so restarting the server ends them.

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
   - `TUNNEL_TOKEN`: from the Cloudflare Zero Trust dashboard
2. In the Cloudflare dashboard, give the tunnel a public hostname (e.g. pandemic.jimhendy.com) pointing at `http://pandemic:3001`
3. $ docker compose up -d --build

When APP_PASSWORD is set the site asks for it once, then remembers the browser with a cookie for a year.

## Testing

$ npm test

Starts a server and has bots play several games at once (every role, one to four players), with players refreshing, spectators dropping in and bogus answers thrown in. It fails if any game stalls or the server logs an error. `node test/bots.js <games> <turns>` changes how many; `SERVER_LOG=<file>` keeps the server's log. `kill -USR2 <server pid>` makes a running server print what each game is waiting for.

## TODO

* Remove all other player options as soon as forecast is selected (currently can use forecast to investigate cards and then current player can start action so we know the upcoming infection cards without using the forecast card)
* Random state and log actions for replication
