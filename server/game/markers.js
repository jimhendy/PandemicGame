class Markers {
    constructor() {
        this.outbreak_locations = this.create_outbreak_marker_locations();
        this.infection_rate_locations = this.create_infection_rate_locations();

        this.outbreak_marker = this.create_outbreak_marker();
        this.infection_rate_marker = this.create_infection_rate_marker();
    };

    create_outbreak_marker() {
        return createImage(
            "images/Marker Outbreak.png",
            ctx,
            this.outbreak_locations[0][0],
            this.outbreak_locations[0][1],
            0.032,
            0.042
        )
    };

    create_infection_rate_marker() {
        return createImage(
            "images/Marker Infection Rate.png",
            ctx,
            this.infection_rate_locations[6][0],
            this.infection_rate_locations[6][1],
            0.032,
            0.042
        )
    };

    create_outbreak_marker_locations() {
        return [
            [0.063, 0.54],
            [0.0985, 0.583],
            [0.063, 0.6225],
            [0.0985, 0.664],
            [0.063, 0.705],
            [0.0985, 0.745],
            [0.063, 0.782],
            [0.0985, 0.821],
            [0.063, 0.861]
        ];
    };

    create_infection_rate_locations() {
        return [
            [0.627, 0.211],
            [0.662, 0.211],
            [0.695, 0.211],
            [0.73, 0.211],
            [0.763, 0.211],
            [0.797, 0.211],
            [0.831, 0.211]
        ];
    }

}

module.exports = Markers