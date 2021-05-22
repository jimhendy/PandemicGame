# PandemicGame

TODO:
* role card in top right corner rather than just role name
* role log messages and top tight hover could be in role colours
* share knowledge Pick a card to discard (probably discard_card_name default)
* > 6 Research stations should be build by moving one
* Download font to provide from static directory
(fixed?) * Infection & player cards unicodes icons don't show on firefox/mac 
* Match font to game font on board (irsa thin)

* Restart game button in selection page / another page with current game/new game

* log file
* Random state and log actions for replication

* Capitalise disease colours when asking question

* Font sizes should be in %/vh, still having issue with overflow of divs from top right (current city etc)

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
