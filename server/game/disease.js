const utils = require("./utils")

class Disease {
    constructor(colour, x_loc){
        this.colour = colour.toLowerCase();
        this.cured = false;
        this.eradicated = false;
        this.x_loc_frac = x_loc; // frac of board canvas
        this.y_loc_frac = 0.915;
        this.y_loc_cured_frac = 0.85;
        this.dx_frac = 0.025;
        this.dy_frac = 0.04;
        this.vial_file = "images/vials/Vial " + utils.toTitleCase(this.colour) + ".png"
        this.vial_file_eradicated = this.vial_file.replace(".png", " Eracdiacted.png")
        this.total_cubes = 24;
        this.cubes_on_board = 0;
        //this.img = createImage(this.vial_file, ctx, this.x_loc_frac, this.y_loc_frac, this.dx_frac, this.dy_frac)
    }

    cure(){
        console.log("Curing " + this.colour + " disease!");
        self.cured = true;
        move(this.img, ctx, null, this.y_loc_cured_frac, 1);
    }

    eradicate(){
        console.log("Eradicating " + this.colour + " disease!");
        this.eradicated = true;
        alter_image(this.img, ctx, this.vial_file_eradicated)
    }
}

module.exports = {
    create_new_diseases: function(){
        return {
            "yellow": new Disease("yellow", 0.328),
            "red": new Disease("red", 0.374),
            "blue": new Disease("blue", 0.42),
            "black": new Disease("black", 0.462)
        }
    },
    
    Disease: Disease
}