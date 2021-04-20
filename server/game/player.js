
class Player{
    constructor(player_name, role_name, socket_id){
        this.player_name = player_name;
        this.role_name = role_name;
        this.socket_id = socket_id;
        this.actions_per_turn = 4;
        this.city = "Atlanta";
        this.player_cards = [];
    }
}


module.exports = Player