
class Player{

    constructor(io, game_id, queue, player_name, role_name, socket_id, player_num){

        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.player_name = player_name;
        this.role_name = role_name;
        this.socket_id = socket_id;
        this.actions_per_turn = 4;
        this.n_cards_to_cure = this.role_name == "Scientist" ? 4 : 5;
        this.max_hand_cards = 7;
        this.city_name = null;
        this.player_cards = [];

        this.player_num = player_num;

        this.used_special_action_this_turn = false;
        this.contingency_planner_event_card = null;

        // Override the silly javascript concept of "this" changing meaning depending on the caller
        this.add_player_card = this.add_player_card.bind(this);
        this.discard_card = this.discard_card.bind(this);
        this.place_pawn = this.place_pawn.bind(this);
        this.move_pawn = this.move_pawn.bind(this);
        this.too_many_cards = this.too_many_cards.bind(this);
    }

    add_player_card(card_data){
        this.player_cards.push(card_data);
    }

    discard_card(card_name){
        // Expect just a single card here (can't think of situation to discard multiple cards)
        var card_data = null;
        for (const c of this.player_cards){
            if (c.card_name == card_name){
                card_data = c;
            }
        }
        this.player_cards = this.player_cards.filter(
            function(c) { return c.card_name != card_name});
        /*
        this.io.to(this.socket_id).emit(
            "clientAction",
            {
                function: "discardPlayerCardFromHand",
                args: card_name
            }
        );
        */
        return card_data;
    };


    place_pawn(city) {
        this.city_name = city.city_name;
        this.io.in(this.game_id).emit(
            "clientAction",
            {
                function: "createImage",
                args: {
                    img_type: "pawn",
                    img_name: "pawn_" + this.role_name,
                    image_file: "images/game/roles/Pawn " + this.role_name + ".png",
                    x: city.location[0] + 0.02,
                    y: city.location[1] - 0.01 + (0.01 * this.player_num),
                    dx: 0.015,
                    dy: 0.02
                },
                return: true
            }
        )
    }

    move_pawn(city) {
        this.city_name = city.city_name;
        var move_args = {
            img_name: "pawn_" + this.role_name,
            dest_x: city.location[0] + 0.02,
            dest_y: city.location[1] - 0.01 + (0.01 * this.player_num),
            dt: 1
        }
        this.queue.add_task(
            ()=>{
                this.io.to(this.socket_id).emit(
                    "series_actions",
                    {
                        series_actions_args: [
                            { function: "changeLocation", args: this.city_name },
                            { function: "moveImage", args: move_args }
                        ],
                        return: true
                    }
                );
                // Other players
                this.io.sockets.sockets.get(this.socket_id).to(this.game_id).emit(
                    "clientAction",
                    {
                        function: "moveImage",
                        args: move_args,
                        return: true
                    }
                );
            },
            null, "all", "Moving " + this.player_name + "'s pawn to " + this.city_name
        );
    }

    too_many_cards(){
        return this.player_cards.length > this.max_hand_cards;
    }

}


module.exports = Player