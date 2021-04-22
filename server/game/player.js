
class Player{

    constructor(player_name, role_name, socket_id, player_num){

        this.player_name = player_name;
        this.role_name = role_name;
        this.socket_id = socket_id;
        this.actions_per_turn = 4;
        this.city = "Atlanta";
        this.player_cards = [];

        this.player_num = player_num;
    }

}


module.exports = Player