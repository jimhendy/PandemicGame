const Markers = require("./markers")
const Diseases  = require("./disease")
const Cities  = require("./city")
const InfectionDeck = require("./infection_deck")
const Player = require("./player")
const city = require("./city")

class PandemicGame {

    constructor(io, game_id){

        this.io = io;
        this.game_id = game_id;

        this.players = [];
        
        this.epidemics = 0;
        this.outbreaks = 0;
    }

    add_player(data){
        var p = new Player(data.username, data.role, data.socketId);
        this.players.push(p);
    }

    initial_game_setup(){
        this.markers = new Markers();

        this.diseases = Diseases.create_new_diseases();
        this.cities = Cities.create_cities(this.io, this.game_id);
        this.infection_deck = new InfectionDeck(this.cities)

        this.infection_deck.initial_deal();

        this.add_research_station("Atlanta")

        for (var p of this.players){
            this.place_pawn(p, "Atlanta");
        }
    }

    add_research_station(city_name){
        this.io.in(this.game_id).emit(
            "createImage",
            {
                image_file: "images/game/Marker Research Station.png",
                x: this.cities[city_name].location[0],
                y: this.cities[city_name].location[1],
                dx: 0.02,
                dy: 0.02
            }
        )
    }

    place_pawn(player, city_name){
        var city = this.cities[city_name];
        this.io.in(this.game_id).emit(
            "createImage",
            {
                image_file: "images/game/roles/Pawn " + player.role_name + ".png",
                x: city.location[0] + 0.02,
                y: city.location[1] - 0.02 + (0.01 * player.player_num),
                dx: 0.015,
                dy: 0.02        
            }
        )
    }


}

module.exports = PandemicGame