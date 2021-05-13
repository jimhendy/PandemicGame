# PandemicGame

functions = camel case
variables = underscores, small case
classes = Capital camel case

TODO:

* Contingency planner special action
* Cure disease if Medic cures on location with cubes
* Run out of player cards
* Can't win game by curing all !

* Restart game button in selection page / another page with current game/new game

* log file
* Random state and log actions for replication

* tooltops/titles on cards - some way to explain event cards
* tooltip for chosen role abilities
* Tooltip for current role
* Tooltips for role card selection
* Tooltips for event cards

* landing page image does not show on phone
* Font sizes should be in %/vh

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
