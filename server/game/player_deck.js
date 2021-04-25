const utils = require("./utils");

class PlayerDeck {
    constructor(io, game_id, cities, n_epidemics = 4) {
        this.io = io;
        this.game_id = game_id;
        this.cities = cities;
        this.n_epidemics = n_epidemics;

        this.deck_location = [0.599, 0.73];
        this.discard_location = [0.732, 0.73];

        this.card_width_frac = 0.103;
        this.card_height_frac = 0.205;

        this.discard_pile = [];
        this.cards_in_player_hands = {};
        this.deck = [];
        for (const [city_name, city] of Object.entries(this.cities)) {
            this.deck.push(
                new PlayerCard(city)
            )
        }
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

    initial_deal(players, n_initial_cards) {

        for (const p of players) {
            this.drawPlayerCards(n_initial_cards, p);
        }

        //for (var i = 0; i < this.n_epidemics; i++)
        //    this.deck.push(new PlayerCard(null, true, i))
        // TODO: Add epidemics equally throughout 1/n_epidemic of deck
        // TODO: Add special event cards
    };

    drawPlayerCards(n_cards, player) {
        var player_cards = [];
        for (var i = 0; i < n_cards; i++) {
            var card = this.deck.pop();
            this.cards_in_player_hands[card.city.name] = card;
            player_cards.push(this.emit_data(card));
            this.io.in(this.game_id).emit(
                "logMessage",
                {
                    message: "🃟 " + player.player_name + ' received player card "' + card.city.name + '"',
                    style: {
                        color: card.city.native_disease_colour
                    }
                }
            )
        }
        player.add_player_cards(player_cards);
    }

    emit_data(card) {
        return {
            is_epidemic: card.epidemic,
            is_city: card.city != null,
            is_event: false,
            city_name: card.city.name || null,
            card_name: card.card_name,
            img_name: card.img_name,
            image_file: card.image_file,
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
        }
    };

    discard(destination) {
        var card = this.cards_in_player_hands[destination];
        delete this.cards_in_player_hands[destination];
        this.discard_pile.push(card);

        var data = this.emit_data(card);

        data.img_name = "player_card_discard"
        data.x = 1
        data.y = 0.5
        data.dest_x = this.discard_location[0];
        data.dest_y = this.discard_location[1];
        data.cardCanvas = true;
        data.dt = 1;

        this.io.in(this.game_id).emit(
            "createImage", data
        )
        this.io.in(this.game_id).emit(
            "moveImage", data
        )
    }
}

class PlayerCard {
    constructor(city = null, epidemic = false, epidemic_num = null) {
        this.city = city;
        this.epidemic = epidemic;
        if (epidemic) {
            this.img_name = "player_card_epidemic_" + epidemic_num
            this.image_file = "images/game/player_cards/Epidemic.jpg"
            this.card_name = "epidemic";
        } else {
            this.img_name = "player_card_" + this.city.name
            this.image_file = "images/game/player_cards/Card " + utils.toTitleCase(this.city.native_disease_colour) + " " + utils.toTitleCase(this.city.name) + ".jpg"
            this.card_name = this.city.name;
        }
        console.log(this.card_name)
    }

    emit_data() {
        return {
            is_epidemic: this.epidemic,
            is_city: this.city != null,
            is_event: false,
            city_name: this.city.name || null,
            img_name: this.img_name,
            image_file: this.image_file,
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
        }
    }
}

module.exports = PlayerDeck