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

Find external IP (google it or "$ curl ifconfig.co") 
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
 