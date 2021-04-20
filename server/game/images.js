module.exports = {

    createImage: function(image_file, context, x_frac, y_frac, dx_frac, dy_frac, tooltip=null){
        var img = new Image();

        img.canvas_x = x_frac * canvas.width;
        img.canvas_y = y_frac * canvas.height;
        img.width = dx_frac * canvas.width;
        img.height = dy_frac * canvas.height;

        img.onload = function(){
            context.drawImage(img, img.canvas_x, img.canvas_y, img.width, img.height);
        }

        img.src = image_file;
        img.title  = "hello";
        return img
    },

    alter_image: function(img, context, new_image_file){
        clearImage(img);
        img.src = new_image_file
        context.drawImage(
            img, img.canvas_x, img.canvas_y, img.width, img.height
        );
    },

    clearImage: function(img, context){
        context.clearRect(
            img.canvas_x, img.canvas_y, img.width, img.height
        );
    },

    move: function(object, context, destination_x, destination_y, duration, updateInterval=25){
        var current_x = object.canvas_x;
        var current_y = object.canvas_y;

        var n_steps = duration * 1000 / updateInterval; 

        if (destination_x)
            var final_x = destination_x * canvas.width;
        else
            var final_x = current_x

        if (destination_y)
            var final_y = destination_y * canvas.height;
        else
            var final_y = current_y;

        var dx = (final_x - current_x) / n_steps;
        var dy = (final_y - current_y) / n_steps;

        if (dx === 0 && dy === 0)
            return;

        var id = setInterval(frame, updateInterval);
        var i = 0;

        var x = current_x;
        var y = current_y;

        function frame() {
            if (i == n_steps) {
                clearInterval(id);
                object.canvas_x = final_x;
                object.canvas_y = final_y;
            } else {
                i++;
                context.clearRect(
                    x, y, object.width, object.height
                );
                x += dx;
                y += dy;
                context.drawImage(
                    object, x, y, object.width, object.height
                );
            };
        }
    }   
}