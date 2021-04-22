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
            "createImage",
            {
                img_type: "card",
                img_name: "infection_deck",
                image_file: "images/game/infection_deck/Back Infection.gif",
                x: this.deck_location[0],
                y: this.deck_location[1],
                dx: this.card_width_frac,
                dy: this.card_height_frac,
                cardCanvas: true
            }
        )
    }

    initial_deal() {
        var city_name;
        var city;
        for (var cubes = 3; cubes >= 1; cubes--) {
            for (var c = 0; c < 3; c++) {
                city_name = this.deck.pop();
                console.log("Adding " + cubes + " cubes to " + city_name);
                city = this.cities[city_name];
                for (var n = 0; n < cubes; n++) {
                    city.add_cube();
                }
                this.discarded.push(city_name);
            }
        }
        this._discard_city_card(city);
    }

    _discard_city_card(city) {
        this.io.in(this.game_id).emit(
            "discardInfectionCard",
            {
                img_type: "card",
                img_name: "infection_discard",
                image_file: "images/game/infection_deck/Infection " + utils.toTitleCase(city.native_disease_colour) + " " + utils.toTitleCase(city.name) + ".jpg",
                x: this.discard_location[0],
                y: this.discard_location[1],
                dx: this.card_width_frac,
                dy: this.card_height_frac,
                cardCanvas: true
            }
        )
    }

    draw() {
        if (!this.deck.length) {
            this.deck = this.discarded;
            this.discarded = [];
            shuffle(this.deck);
            this._create_deck_image();
        }
        var city_name = this.deck.pop();
        var city = this.cities[city_name];
        city.add_cube(this.cities);
        this._discard_city_card(city);
        this.discarded.push(city_name);

        if (!this.deck.length) {
            this.io.in(this.game_id).emit(
                "removeImage", "infection_deck"
            )
            //clearImage(this.img_deck, ctx)
        }
    }


}

module.exports = InfectionDeck