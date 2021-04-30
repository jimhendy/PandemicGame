
class Player{

    constructor(io, game_id, player_name, role_name, socket_id, player_num){

        this.io = io;
        this.game_id = game_id;

        this.player_name = player_name;
        this.role_name = role_name;
        this.socket_id = socket_id;
        this.actions_per_turn = 4;
        this.n_cards_to_cure = this.role_name == "Scientist" ? 4 : 5;
        this.max_hand_cards = 7;
        this.city_name = "Atlanta";
        this.player_cards = [];

        this.player_num = player_num;

        this.used_special_action_this_turn = false;
        this.contingency_planner_event_card = null;
    }

    add_player_cards(cards_data){
        // Expect an array of incoming cards to allow client side animation to order multiple deals
        for (var i =0; i<cards_data.length; i++){
            if (!cards_data[i].is_epidemic)
                this.player_cards.push(cards_data[i]);
        }
        this.io.to(this.socket_id).emit(
            "newPlayerCards", cards_data
        );
    }

    receive_card_from_other_player(card_data){
        this.player_cards.push(card_data);
        this.io.to(this.socket_id).emit(
            "addPlayerCardToHand", card_data
        );
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
        this.io.to(this.socket_id).emit(
            "discardPlayerCardFromHand", card_name
        );
        return card_data;
    };


    place_pawn(city) {
        this.city_name = city.city_name;
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "pawn",
                img_name: "pawn_" + this.role_name,
                image_file: "images/game/roles/Pawn " + this.role_name + ".png",
                x: city.location[0] + 0.02,
                y: city.location[1] - 0.01 + (0.01 * this.player_num),
                dx: 0.015,
                dy: 0.02
            }
        )
    }

    move_pawn(city) {
        this.city_name = city.city_name;
        this.io.in(this.game_id).emit(
            "moveImage",
            {
                img_name: "pawn_" + this.role_name,
                dest_x: city.location[0] + 0.02,
                dest_y: city.location[1] - 0.01 + (0.01 * this.player_num),
                dt: 1
            }
        )
        this.io.to(this.socket_id).emit("changeLocation", this.city_name);
    }

    too_many_cards(){
        return this.player_cards.length > this.max_hand_cards;
    }

}


module.exports = Player