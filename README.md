# PandemicGame

functions = camel case
variables = underscores, small case
classes = Capital camel case

TODO:

* > 6 Research stations should be build by moving one
(fixed?) * Infection & player cards unicodes icons don't show on firefox/mac 
* Forecast should be playable after epidemic but before draw
* Match font to game font on board (irsa thin)

* Restart game button in selection page / another page with current game/new game

* log file
* Random state and log actions for replication

* tooltops/titles on cards - some way to explain event cards
* Tooltips for event card actions

* Capitalise disease colours when asking question

* Font sizes should be in %/vh

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
