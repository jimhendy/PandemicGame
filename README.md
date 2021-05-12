# PandemicGame

functions = camel case
variables = underscores, small case
classes = Capital camel case

TODO:
* Special role actions (CP)
* Event cards
* log file
* show other players the deal animations from different perspective
* tooltops/titles on cards - some way to explain event cards
* tooltip for chosen role abilities
* landing page image does not show on phone

* Allow players to use event cards on other players turns and between infect and intesify of epidemics

* Queue of function: args for pandmeic.js to allow event cards to skip in front
* Could also allow animations to be sent to client and next one only sent when first is complete
* pandemic.emit(action), pandemic=waiting, client.do_action, client.emit(action_complete), pandemic.unshift().action 

* Client should ask for confirmation only for submission (?)

veritcal scrollbar on role choice screen
Can op exp build reasearch stations where one already exists?
Infection counter should update with initial deal

## Installation

$ sudo apt install node npm
$ cd game_directory/
$ npm install

## Running

Find external IP (google it)
Enable port forwarding from 80 to 3000 via router advanced settings
$ node server/server.js
