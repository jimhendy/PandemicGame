
class PlayerDeck{

    constructor(n_epidemics=4){

    }
}

class PlayerCard {
    constructor(city=null, epidemic=null){
        this.city = city;
        this.epidemic = epidemic;
        this.img_file = this.create_imgage_filename();
        this.card_width_frac = 0.103;
        this.card_height_frac = 0.21;
    }

    create_imgage_filename(){
        if (this.epidemic){
            return "images/"
        }
    }
}

module.exports = PlayerDeck