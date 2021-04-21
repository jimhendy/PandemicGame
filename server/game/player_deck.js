const utils = require("./utils");

class PlayerDeck {
    constructor(io, game_id, cities, n_epidemics = 4) {
        this.io = io;
        this.game_id = game_id;
        this.cities = cities;

        this.deck_location = [0.599, 0.73];
        this.discard_location = [0.732, 0.73];

        this.card_width_frac = 0.103;
        this.card_height_frac = 0.205;

        this.deck = [];
        for (const [city_name, city] of Object.entries(this.cities)) {
            this.deck.push(
                new PlayerCard(city)
            )
        }
        for (var i = 0; i < this.n_epidemics; i++)
            this.deck.push(new PlayerCard(null, true, i))
        // TODO: Add epidemics equally throughout 1/n_epidemic of deck
        // TODO: Add special event cards
        utils.shuffle(this.deck);

        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "card",
                img_name: "player_deck",
                image_file: "images/game/player_cards/Back Player Card.gif",
                x: this.deck_location[0],
                y: this.deck_location[1],
                dx: this.card_width_frac,
                dy: this.card_height_frac,
                cardCanvas: true
            }
        )

    }
}

class PlayerCard {
    constructor(city = null, epidemic = false, epidemic_num = null) {
        this.city = city;
        this.epidemic = epidemic;
        if (epidemic) {
            this.img_name = "player_card_epidemic_" + epidemic_num
            this.img_file = "images/game/player_deck/Epidemic.jpg"
        } else {
            this.img_name = "player_card_" + this.city.city_name
            this.img_file = "images/game/player_deck/Card " + utils.toTitleCase(this.city.native_disease_colour) + " " + utils.toTitleCase(this.city.name) + ".jpg"
        }
    }
}

module.exports = PlayerDeck