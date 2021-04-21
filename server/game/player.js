
class Player{

    constructor(player_name, role_name, socket_id){

        this.player_name = player_name;
        this.role_name = role_name;
        this.socket_id = socket_id;
        this.actions_per_turn = 4;
        this.city = "Atlanta";
        this.player_cards = [];

        this.player_num = Player.counter;

        this.img = null;
    }

    static get counter(){
        Player._counter = (Player._counter || 0) + 1;
        return Player._counter;
    }
}


module.exports = Player