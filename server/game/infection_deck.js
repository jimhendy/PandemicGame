const utils = require("./utils")

class InfectionDeck {
    constructor(io, game_id, cities) {

        this.io = io;
        this.game_id = game_id;

        this.cities = cities;

        this.deck = Object.keys(this.cities);
        utils.shuffle(this.deck);

        this.discarded = [];

        this.card_width_frac = 0.142;
        this.card_height_frac = 0.14;

        this.deck_location = [0.597, 0.058];
        this.discard_location = [0.759, 0.058];

        this._create_deck_image();

    }

    _create_deck_image() {
        this.io.in(this.game_id).emit(
            "createImage", this._infection_deck_image_data()
        )
    }

    _infection_deck_image_data(){
        return {
            img_type: "card",
            img_name: "infection_deck",
            image_file: "images/game/infection_deck/Back Infection.gif",
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
            cardCanvas: true
        }
    }

    initial_deal() {
        var city_name;
        var city;
        for (var cubes = 3; cubes >= 1; cubes--) {
            for (var c = 0; c < 3; c++) {
                city_name = this.deck.pop();
                city = this.cities[city_name];
                this.io.in(this.game_id).emit(
                    "logMessage",
                    {
                        message: "🕱 " + city_name + " was infected with " + cubes + " cubes",
                        style: {
                            color: city.native_disease_colour,
                            "font-weight": "bold"
                        }
                    }
                )
                for (var n = 0; n < cubes; n++) {
                    city.add_cube();
                }
                this.discarded.push(city_name);
            }
        }
        this._discard_city_card(city);
    }

    _discard_city_card(city) {
        var data = this._discard_card_data(city)
        data.x = this.discard_location[0]
        data.y = this.discard_location[1]
        this.io.in(this.game_id).emit(
            "discardInfectionCard", data
        )
    }

    _discard_card_data(city){
        return {
            img_type: "card",
            img_name: "infection_discard",
            image_file: "images/game/infection_deck/Infection " + utils.toTitleCase(city.native_disease_colour) + " " + utils.toTitleCase(city.name) + ".jpg",
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
            dest_x: this.discard_location[0],
            dest_y: this.discard_location[1],
            dt: 1,
            cardCanvas: true
        }
    }

    draw(n_cards) {
        var client_infection_data = {
            empty_deck_deal: null, // We do not find the end of the infection deck
            // Otherwise the deck will be empty on this deal (0 based) and refilled on +1
            cards: [],
            infection_deck_image_data: this._infection_deck_image_data()
        }
        for (var i=0; i<n_cards; i++){
            if (!this.deck.length) {
                this.deck = this.discarded;
                this.discarded = [];
                shuffle(this.deck);
                client_infection_data.empty_deck_deal = i;
            }
            var city_name = this.deck.pop();
            var city = this.cities[city_name];
            this.io.in(this.game_id).emit(
                "logMessage", 
                {
                    message: "🕱 " + city_name + " was infected",
                    style: {
                        color: city.native_disease_colour,

                    }
                }
            )
            
            city.add_cube(this.cities);
            this.discarded.push(city_name);

            client_infection_data.cards.push(
                this._discard_card_data(city)
            )
        }
        this.io.in(this.game_id).emit(
            "drawInfectionCards",
            client_infection_data
        )
    }


}

module.exports = InfectionDeck