const Markers = require("./markers")
const Diseases = require("./disease")
const Cities = require("./city")
const InfectionDeck = require("./infection_deck")
const Player = require("./player")
const PlayerDeck = require("./player_deck")
const city = require("./city")

class PandemicGame {

    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.players = [];

        this.epidemics = 0;
        this.outbreaks = 0;

        this.round = 0;
    }

    add_player(data) {
        var p = new Player(data.username, data.role, data.socketId, this.players.length);
        this.players.push(p);
    }

    initial_game_setup() {
        this.markers = new Markers(this.io, this.game_id);
        this.diseases = Diseases.create_new_diseases(this.io, this.game_id);
        this.cities = Cities.create_cities(this.io, this.game_id);
        this.infection_deck = new InfectionDeck(this.io, this.game_id, this.cities)
        this.player_deck = new PlayerDeck(this.io, this.game_id, this.cities)

        this.infection_deck.initial_deal();
        this.player_deck.initial_deal(this.players, this.n_initial_player_cards());

        this.add_research_station("Atlanta")

        for (var p of this.players) {
            this.place_pawn(p, "Atlanta");
        }

        this.update_infection_count();
    }

    new_player_turn(){
        this.current_player = this.players[ this.round % this.players.length ];
        this.io.in(this.game_id).emit(
            "newPlayersTurn", this.current_player.player_name
        )
        this.player_used_actions = 0;
    }

    update_infection_count() {
        var infection_count = [];
        for (const [city_name, city] of Object.entries(this.cities)) {
            for (const [colour, num_colour] of Object.entries(city.disease_cubes)) {
                if (num_colour) {
                    infection_count.push({
                        city: city_name,
                        colour: colour,
                        num: num_colour
                    })
                }
            }
        }
        infection_count.sort((a, b) => (a.num > b.num) ? -1 : ((b.num > a.num) ? 1 : 0));
        var text = ""
        for (const ic of infection_count) {
            text += '<p style="margin-top: 0px; margin-bottom: 0px; margin-left: 5px; margin-right: 5px; text-align: left; color:'
            text += ic.colour + ';">' + ic.city
            text += '<span style="float:right;">' + ic.num + '</span></p>'
        }
        this.io.in(this.game_id).emit(
            "updateInfectionCounter", text
        )
    }

    add_research_station(city_name) {
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "research_station",
                img_name: "research_station_" + city_name,
                image_file: "images/game/Marker Research Station.png",
                x: this.cities[city_name].location[0],
                y: this.cities[city_name].location[1],
                dx: 0.02,
                dy: 0.02
            }
        )
    }

    place_pawn(player, city_name) {
        var city = this.cities[city_name];
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "pawn",
                img_name: "pawn_" + player.role_name,
                image_file: "images/game/roles/Pawn " + player.role_name + ".png",
                x: city.location[0] + 0.02,
                y: city.location[1] - 0.01 + (0.01 * player.player_num),
                dx: 0.015,
                dy: 0.02
            }
        )
    }

    move_pawn(player, city_name) {
        var city = this.cities[city_name];
        this.io.in(this.game_id).emit(
            "moveImage",
            {
                img_name: "pawn_" + player.role_name,
                dest_x: city.location[0] + 0.02,
                dest_y: city.location[1] - 0.01 + (0.01 * player.player_num),
                dt: 1
            }
        )
    }

    n_initial_player_cards(){
        var n_players = this.players.length;
        if (n_players <= 2)
            return 4;
        else if (n_players == 3)
            return 3;
        else
            return 2;
    }


}

module.exports = PandemicGame