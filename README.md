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

* Should pandemic.assess_actions only provide an array of objects to the client where we then present a series of options
 [
     {action: "Drive/Ferry", player_name: "Jim", is_current_player: true, destination: "London", discard_card_name: null, is_dispatcher_moving_other_player: false, emit_response: "player_move"},
     {action: "Cure", player_name: "Jim"}

 ]
 
Of all (remaining) available actions present choices via Client._ask_question...
How to loop an unknown number of times? - recursion



Initial deal should only be seen by player. All other draws should be shown to everyone. Other players cards should come/go to from different location.

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
