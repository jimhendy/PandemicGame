UTILS = {

    sleep: function(time) {
        // sleep time expects milliseconds
        return new Promise((resolve) => setTimeout(resolve, time));
    }

}