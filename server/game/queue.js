class Queue {

    /*
    data expected to be in the format:
    {function: _func, args: _object, desctiption: _str, n_responses: _int}

    Local (server side) functions should expect 0 responses.
    Reponses come from client side actions.
    Server side functions can still be queued to ensure correct running order
    */

    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.n_players = 0;
        this._queue = [];

        this.awaiting_responses = 0;
        this.running = false;
        this.game_over = false;

        // Bind Events
        this.add_player = this.add_player.bind(this);
        this.start = this.start.bind(this);
        this.add_task = this.add_task.bind(this);
        this.add_response = this.add_response.bind(this);
        this._next_task = this._next_task.bind(this);
        this.size = this.size.bind(this);
        this._check_next_task = this._check_next_task.bind(this);
        this.run_until_empty = this.run_until_empty.bind(this);

        //setInterval(this._check_next_task, 5000);
    }

    add_player() { this.n_players++; }

    start() {
        if (this.game_over){return;}
        //console.log("starting queue")
        this.running = true;
        if (this.size()){
            this._next_task();
        } else {
            console.error("No tasks in queue")
        }
    }

    async run_until_empty(){
        return new Promise(
            resolve => {
            if (this.game_over){resolve();}
            this.running = true;
            var id = setInterval(check_queue.bind(this), 50);
            function check_queue(){
                console.log("RUE=====================================================")
                console.log(this.awaiting_responses)
                console.log(this.running)
                console.log(this._queue)
                if (this.size()){
                    this._check_next_task();
                } else if (this.awaiting_responses==0){
                    clearInterval(id);
                    resolve();
                }
            } 
        });
    }

    add_task(func, args, n_players_response, description = null, front = false, pause=false) {
        /*
        pause: stop the queue running after executing this task (before getting any responses)
        */

        var n_responses;
        var game_over = false;
        if (n_players_response == "all")
            n_responses = this.n_players
        else if (n_players_response == "game_over"){
            n_responses = 9999999
            game_over = true;
        }
        else
            n_responses = n_players_response;
        var args = Array.isArray(args) ? args : [args];
        var data = {
            func: func,
            args: args,
            n_responses: n_responses,
            description: description,
            pause: pause,
            game_over: game_over
        }
        if (front) {
            this._queue.unshift(data)
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
        if (this.game_over){return;}
        //console.info("Current queue size: " + this._queue.length + ", awaiting responses: " + this.awaiting_responses)
        //if (this.size())
        //    console.log(this._queue[0])
        if (this.awaiting_responses == 0 && this.running) {
            if (this.size())
                this._next_task();
            else
                this.running = false;
        }
    }

    _next_task() {
        if (this.game_over){return;}
        //console.log("starting new task")
        if (!this.size()) return;
        /*
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        for (const i of this._queue){
            console.log(i.description)
        }
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        console.log("");
        */
        var instruction = this._queue.shift();
        //console.log(instruction)
        //console.log("")
        if (instruction.description)
            console.info(instruction.description)
        this.awaiting_responses = instruction.n_responses;
        instruction.func(...instruction.args);
        this.game_over = instruction.game_over;
        this.running = !instruction.pause;
        if (this.awaiting_responses == 0 && this.running)
            this._next_task();
    }

    size() {
        return this._queue.length;
    }


}

module.exports = Queue;