# PandemicGame

functions = camel case
variables = underscores, small case
classes = Capital camel case

TODO:
* Special role actions (CP, D)
* Event cards
* log file
* show other players the deal animations from different perspective
* tooltops/titles on cards - some way to explain event cards
* tooltip for chosen role abilities
* landing page image does not show on phone

Initial deal should only be seen by player. All other draws should be shown to everyone. Other players cards should come/go to from different location.

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
