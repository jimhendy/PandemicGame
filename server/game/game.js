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
        this.n_research_stations = 0;
        this.max_n_research_stations = 6;
        this.research_station_cities = [];

        this.current_player = null;
    }

    add_player(data) {
        var p = new Player(this.io, this.game_id, data.player_name, data.role, data.socket_id, this.players.length);
        this.players.push(p);
    }

    initial_game_setup() {
        this.markers = new Markers(this.io, this.game_id);
        this.diseases = Diseases.create_new_diseases(this.io, this.game_id);
        this.cities = Cities.create_cities(this.io, this.game_id);
        this.infection_deck = new InfectionDeck(this.io, this.game_id, this.cities, this.diseases)
        this.player_deck = new PlayerDeck(this.io, this.game_id, this.cities)

        this.colour_to_cities = {};
        for (const c of Object.values(this.cities)){
            if (Object.keys(this.colour_to_cities).includes(c.native_disease_colour)){
                this.colour_to_cities[c.native_disease_colour].push(c.name)
            } else {
                this.colour_to_cities[c.native_disease_colour] = [c.name]
            }
        }
        for (const k of Object.keys(this.colour_to_cities))
            this.colour_to_cities[k].sort()

        this.infection_deck.initial_deal();
        this.player_deck.initial_deal(this.players, this.n_initial_player_cards());

        this.add_research_station("Atlanta")

        for (var p of this.players) {
            p.place_pawn(this.cities["Atlanta"]);
        }

        this.update_infection_count();
    }

    new_player_turn() {
        if (this.current_player) {
            this.io.to(this.current_player.socket_id).emit("disableActions");
        }
        this.current_player = this.players[this.round % this.players.length];
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
                        city_name: city_name,
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
            text += ic.colour + ';">' + ic.city_name
            text += '<span style="float:right;">' + ic.num + '</span></p>'
        }
        this.io.in(this.game_id).emit(
            "updateInfectionCounter", text
        )
    }

    add_research_station(city_name) {
        this.n_research_stations++;
        var city = this.cities[city_name];
        city.add_research_station();
        this.research_station_cities.push(city_name);
        this.research_station_cities.sort();
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
        this.io.in(this.game_id).emit(
            "logMessage", 
            {
                message: "Research Station built in " + city_name,
                style: {
                    color: city.native_disease_colour
                }
            }
        )
    }

    n_initial_player_cards() {
        var n_players = this.players.length;
        if (n_players <= 2)
            return 4;
        else if (n_players == 3)
            return 3;
        else
            return 2;
    }

    infect_cities() {
        var n_outbreaks = this.infection_deck.draw(this.markers.infection_rate());
        if (n_outbreaks){
            if(this.markers.increase_outbreaks(n_outbreaks))
                this.gameOver();
        }
        this.update_infection_count();
    }

    resolve_epidemics(n_epidemics){
        for (var i=0; i<n_epidemics; i++){
            this.epidemics++;
            this.markers.increase_infection_rate();
            var n_outbreaks = this.infection_deck.draw(1, true); // Infect stage
            if (n_outbreaks){
                if(this.markers.increase_outbreaks(n_outbreaks)){
                    this.gameOver();
                    return true;
                }
            }
            // TODO Allow players chance to play event cards
            this.infection_deck.epidemic_intensify();
        }
        this.update_infection_count();
    }

    gameOver(){
        console.log("disableing actions")
        this.io.in(this.game_id).emit("disableActions");
    }


}

module.exports = PandemicGame