class InfectionDeck {
    constructor(cities) {

        this.cities = cities;

        this.deck = Object.keys(this.cities);
        shuffle(this.deck);

        this.discarded = [];

        this.card_width_frac = 0.142;
        this.card_height_frac = 0.14;

        this.deck_location = [0.597, 0.058];
        this.discard_location = [0.759, 0.058];

        this._create_deck_image();
        this.img_discard = null;

    }

    _create_deck_image() {
        this.img_deck = createImage(
            "images/infection_deck/Back Infection.gif",
            ctx,
            this.deck_location[0], this.deck_location[1],
            this.card_width_frac, this.card_height_frac
        );
    }

    initial_deal() {
        var city_name;
        var city;
        for (var cubes = 1; cubes <= 3; cubes++) {
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
        this.img_discard = createImage(
            "images/infection_deck/Infection " + city.native_disease_colour.toTitleCase() + " " + city.name.toTitleCase() + ".jpg",
            ctx,
            this.discard_location[0], this.discard_location[1],
            this.card_width_frac, this.card_height_frac
        );
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
            clearImage(this.img_deck, ctx)
        }
    }


}

module.exports = InfectionDeck