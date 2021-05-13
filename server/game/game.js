const Markers = require("./markers")
const Diseases = require("./disease")
const Cities = require("./city")
const InfectionDeck = require("./infection_deck")
const Player = require("./player")
const PlayerDeck = require("./player_deck")
const Queue = require("./queue")

class PandemicGame {

    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.players = [];

        this.epidemics = 0;

        this.round = 0;
        this.n_research_stations = 0;
        this.max_n_research_stations = 6;
        this.research_station_city_names = [];

        this.current_player = null;
        this.starting_city = "Atlanta"

        this.skip_infection_step = false;

        this.queue = new Queue(this.io, this.game_id)

        // Bind functions
        this.add_player = this.add_player.bind(this);
        this.initial_game_setup = this.initial_game_setup.bind(this);
        this.add_research_station = this.add_research_station.bind(this);
        this.new_player_turn = this.new_player_turn.bind(this);
        this.update_infection_count = this.update_infection_count.bind(this);
        this.n_initial_player_cards = this.n_initial_player_cards.bind(this);
        this.infect_cities = this.infect_cities.bind(this);
        this.resolve_epidemic = this.resolve_epidemic.bind(this);
        this.gameOver = this.gameOver.bind(this);
    }

    add_player(data) {
        var p = new Player(this.io, this.game_id, this.queue, data.player_name, data.role, data.socket_id, this.players.length);
        this.players.push(p);
        this.queue.add_player();
    }

    initial_game_setup() {
        this.markers = new Markers(this.io, this.game_id, this.queue);
        this.diseases = Diseases.create_new_diseases(this.io, this.game_id, this.queue);
        this.cities = Cities.create_cities(this.io, this.game_id, this.queue, this.diseases, this.markers);
        this.infection_deck = new InfectionDeck(this.io, this.game_id, this.queue, this.cities, this.players, this.diseases, this.markers)
        this.player_deck = new PlayerDeck(this.io, this.game_id, this.queue, this, this.markers, this.cities)

        this.add_research_station(this.starting_city)
        for (var p of this.players) {
            this.queue.add_task(p.place_pawn, this.cities[this.starting_city], "all", "Placing initial pawn for " + p.player_name)
        }

        this.infection_deck.initial_deal();
        this.player_deck.initial_deal(this.players, this.n_initial_player_cards())
        this.update_infection_count();
    }


    new_player_turn() {
        this.current_player = this.players[this.round % this.players.length];
        this.current_player.used_special_action_this_turn = false;
        this.queue.add_task(
            () => this.io.to(this.game_id).emit(
                "logMessage",
                {message: "It's " + this.current_player.player_name + "'s turn"}
            ), null, 0, "Logging new player turn"
        )
        this.player_used_actions = 0;
    }

    update_infection_count() {
        // Whole task needs to be in queued function to get count correct
        this.queue.add_task(
            () => {
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
                    "clientAction",
                    { function: "updateInfectionCounter", args: text, return: true }
                )
            },
            null, "all", "Updating infection count"
        )
    }

    add_research_station(city_name) {
        this.queue.add_task(
            (cn) => {
                this.n_research_stations++;
                var city = this.cities[cn];
                city.add_research_station();
                this.research_station_city_names.push(cn);
                this.research_station_city_names.sort();
                this.io.in(this.game_id).emit(
                    "clientAction",
                    {
                        function: "createImage",
                        args: {
                            img_type: "research_station",
                            img_name: "research_station_" + cn,
                            image_file: "images/game/Marker Research Station.png",
                            x: this.cities[cn].location[0],
                            y: this.cities[cn].location[1],
                            dx: 0.02,
                            dy: 0.02,
                            respond: true
                        },
                        return: true
                    }
                )
                this.io.in(this.game_id).emit(
                    "clientAction",
                    {
                        function: "logMessage",
                        args: {
                            message: "Research Station built in " + cn,
                            style: {
                                color: city.native_disease_colour
                            }
                        }
                    }
                )
            }, city_name, "all", "Adding reasearch station to " + city_name
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
        if (this.skip_infection_step) {
            this.queue.add_task(
                () => {
                    this.io.in(this.game_id).emit(
                        "logMessage", { message: "Infection step skipped" }
                    )
                    this.skip_infection_step = false;
                },
                null, 0, "Logging infection step skipped"
            )
        } else {
            this.infection_deck.draw(this.markers.infection_rate());
        }
        this.update_infection_count();
    }

    resolve_epidemic() {
        this.epidemics++;
        this.markers.increase_infection_rate();
        this.infection_deck.draw(1, true); // Infect stage
        // TODO Allow players chance to play event cards
        this.infection_deck.epidemic_intensify();
        this.update_infection_count();
    }

    gameOver() {
        this.io.in(this.game_id).emit("disableActions");
    }


}

module.exports = PandemicGame