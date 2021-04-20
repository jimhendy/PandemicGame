class PandemicGame {

    constructor(players){
        this.players = players;
        
        this.epidemics = 0;
        this.outbreaks = 0;

        this.markers = new Markers();

        this.diseases = create_new_diseases();
        this.cities = create_cities();
        this.infection_deck = new InfectionDeck(this.cities)

        this.infection_deck.initial_deal();
    }

}
