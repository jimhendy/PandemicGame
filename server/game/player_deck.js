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

        this.event_card_names = ["Airlift", "Forecast", "Government Grant", "One Quiet Night", "Resilient Population"];

        this.discard_pile = [];
        this.cards_in_player_hands = {};
        this.deck = [];
        for (const [city_name, city] of Object.entries(this.cities)) {
            this.deck.push(
                new PlayerCard(city)
            )
        }
        for (const ev of this.event_card_names){
            this.deck.push(
                new PlayerCard(null, false, null, ev)
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
        this._add_epidemics();
    };

    _add_epidemics() {
        var sub_decks = [];
        for (var i = 0; i < this.n_epidemics; i++) {
            var new_epidemic = new PlayerCard(null, true, i)
            sub_decks.push([new_epidemic])
        }
        for (var i = 0; i < this.deck.length; i++) {
            sub_decks[i % this.n_epidemics].push(this.deck[i]);
        }
        this.deck = [];
        for (var i = 0; i < this.n_epidemics; i++) {
            utils.shuffle(sub_decks[i]);
            for (const c of sub_decks[i]) {
                this.deck.push(c)
            }
        }
    }


    drawPlayerCards(n_cards, player) {
        var player_cards = [];
        var new_epidemics = 0;
        for (var i = 0; i < n_cards; i++) {
            
            var card = this.deck.pop();
            this.cards_in_player_hands[card.card_name] = card;
            player_cards.push(this.emit_data(card));

            if (card.is_epidemic){
                this.io.in(this.game_id).emit(
                    "logMessage",
                    {
                        message: "An Epidemic card was drawn!",
                        fontWeight: "bold"
                    }
                )
                new_epidemics++;
            } else {
                this.io.in(this.game_id).emit(
                    "logMessage",
                    {
                        message: "🃟 " + player.player_name + ' received player card "' + card.card_name + '"',
                        style: {
                            color: card.is_city ? card.city.native_disease_colour : null
                        }
                    }
                )
            }
        }
        player.add_player_cards(player_cards);
        return new_epidemics;
    }

    emit_data(card) {
        var data = card.emit_data()
        data.x =this.deck_location[0]
        data.y = this.deck_location[1]
        data.dx = this.card_width_frac
        data.dy = this.card_height_frac
        return data
    };

    discard(destinations) {
        // destinations is an array of the card city_names (/event card names)
        var player_cards = [];
        for (const d of destinations) {
            var card = this.cards_in_player_hands[d];
            delete this.cards_in_player_hands[d];
            this.discard_pile.push(card);

            var data = this.emit_data(card);

            data.img_name = "player_card_discard"
            data.x = 1
            data.y = 0.5
            data.dest_x = this.discard_location[0];
            data.dest_y = this.discard_location[1];
            data.cardCanvas = true;
            data.dt = 1;

            player_cards.push(data);
        }
        this.io.in(this.game_id).emit(
            "discardPlayerCards", player_cards
        )
    }
}

class PlayerCard {
    constructor(city = null, epidemic = false, epidemic_num = null, event_name=null) {
        this.city = city;

        this.is_city = city != null;
        this.is_event = event_name != null ;
        this.is_epidemic = epidemic;

        if (this.is_epidemic) {
            this.img_name = "player_card_epidemic_" + epidemic_num
            this.image_file = "images/game/player_cards/Epidemic.jpg"
            this.card_name = "Epidemic";
        } else if (this.is_event) {
            this.card_name = event_name;
            this.img_name = "player_card_event_" + this.card_name;
            this.image_file = "images/game/player_cards/Special Event - " + this.card_name + ".jpg"
        } else if (this.is_city) {
            this.img_name = "player_card_" + this.city.city_name
            this.image_file = "images/game/player_cards/Card " + utils.toTitleCase(this.city.native_disease_colour) + " " + utils.toTitleCase(this.city.city_name) + ".jpg"
            this.card_name = this.city.city_name;
        }
    }

    emit_data() {
        return {
            is_epidemic: this.is_epidemic,
            is_city: this.is_city,
            is_event: this.is_event,

            city_name: this.is_city ? this.city.city_name : null,
            img_name: this.img_name,
            card_name: this.card_name,

            image_file: this.image_file,

            
        }
    }
}

module.exports = PlayerDeck