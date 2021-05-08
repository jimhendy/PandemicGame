class Queue {

    /*
    data expected to be in the format:
    {function: _func, args: _object, desctiption: _str, n_responses: _int}
    */

    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.n_players = 0;
        this._queue = [];
        this.awaiting_responses = 0;

        // Bind Events
        this.add_player = this.add_player.bind(this);
        this.start = this.start.bind(this);
        this.add_task = this.add_task.bind(this);
        this.add_response = this.add_response.bind(this);
        this._next_task = this._next_task.bind(this);
        this.size = this.size.bind(this);
        this._check_next_task = this._check_next_task.bind(this);

        //setInterval(this._check_next_task, 2000);
    }

    add_player() { this.n_players++; }

    start() {
        if (this.size()) {
            this._next_task();
        } else {
            console.error("No tasks in queue")
        }
    }

    add_task(func, args, n_players_response = 1, description = null, front = false) {
        var n_responses;
        if (n_players_response == "all")
            n_responses = this.n_players
        else if (n_players_response == "none"){
            // Use this if we never want the queue to restart on its own but we will manually restart using "queue.start()"
            n_responses = 999999}
        else
            n_responses = n_players_response;
        var args = Array.isArray(args) ? args : [args];
        var data = {
            func: func,
            args: args,
            n_responses: n_responses,
            description: description
        }
        if (front) {
            this._queue.shift(data)
        } else {
            this._queue.push(data)
        }
    }

    add_response() {
        console.log("response received " + this.awaiting_responses)
        this.awaiting_responses--;
        if (this.awaiting_responses < 0){
            console.error("Negative queue.awaiting_responses, should not happen")
            console.error(this._queue)
        }
        this._check_next_task()
    }

    _check_next_task(){
        if (this.awaiting_responses == 0 && this.size()) {
            this._next_task();
        }
    }

    _next_task() {
        console.log("starting new task")
        if (!this.size()) return;
        var instruction = this._queue.shift();
        console.log(instruction)
        if (instruction.description)
            console.info(instruction.description)
        this.awaiting_responses = instruction.n_responses;
        instruction.func(...instruction.args);
        if (this.awaiting_responses == 0)
            this._next_task();
    }

    size() {
        return this._queue.length;
    }
}

module.exports = Queue;