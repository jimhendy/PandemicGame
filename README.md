# PandemicGame

functions = camel case
variables = underscores, small case
classes = Capital camel case

TODO:
* log file
* tooltops/titles on cards - some way to explain event cards
* tooltip for chosen role abilities
* landing page image does not show on phone
* Font sizes should be in %/vh
* Contingency planner special action
* Infection counter should update with initial deal
* Tooltip for current role
* Tooltips for role card selection
* Restart game button in selection page / another page with current game/new game
* Tooltips for event cards
* Event cards between epidemic stages
* Random state and log actions for replication
* Toronto -> Montreal
* Cure disease if Medic cures on location with cubes
* Run out of player cards
Picking the bottom infection deck card with resilient population makes the whole deck image disappear ??

Random state and log?


## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
