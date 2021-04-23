function createImage(image_file, context, x_frac, y_frac, dx_frac, dy_frac, canvas, tooltip = null) {
    var img = new Image();

    img.canvas_x = x_frac * canvas.width;
    img.canvas_y = y_frac * canvas.height;
    img.width = dx_frac * canvas.width;
    img.height = dy_frac * canvas.height;

    img.onload = function () {
        context.drawImage(img, img.canvas_x, img.canvas_y, img.width, img.height);
    }

    img.src = image_file;
    return img
};

function alter_image(image, new_image_file) {
    clearImage(image);
    image.img.src = new_image_file
    image.data.ctx.drawImage(
        image.img, image.img.canvas_x, image.img.canvas_y, image.img.width, image.img.height
    );
};

function clearImage(image) {
    image.data.ctx.clearRect(
        image.img.canvas_x, image.img.canvas_y, image.img.width, image.img.height
    );
};

function move(image, destination_x, destination_y, destination_dx, destination_dy, duration, other_images, updateInterval = 25) {
    
    var img_object = image.img;
    var context = image.data.ctx;
    var canvas = image.data.canvas;

    var images_to_redraw = [];
    for (const [oi_name, oi] of Object.entries(other_images)){
        if ((oi.data.ctx === context) && (oi.data.img_name != image.data.img_name)){
            images_to_redraw.push(oi);
        }
    }

    var current_x = img_object.canvas_x;
    var current_y = img_object.canvas_y;
    var current_dx = img_object.width;
    var current_dy = img_object.height;

    var n_steps = duration * 1000 / updateInterval;

    if (destination_x)
        var final_x = destination_x * canvas.width;
    else
        var final_x = current_x

    if (destination_y)
        var final_y = destination_y * canvas.height;
    else
        var final_y = current_y;

    if (destination_dx)
        var final_dx = destination_dx * canvas.width;
    else
        var final_dx = current_dx;

    if (destination_dy)
        var final_dy = destination_dy * canvas.height;
    else
        var final_dy = current_dy;

    var dx = (final_x - current_x) / n_steps;
    var dy = (final_y - current_y) / n_steps;

    var ddx = (final_dx - current_dx) / n_steps;
    var ddy = (final_dy - current_dy) / n_steps;

    if (dx === 0 && dy === 0 && ddx === 0 && ddy === 0){
        return Promise.resolve();
    }

    return new Promise(
        resolve => {

            var id = setInterval(frame, updateInterval);
            var i = 0;

            var x = current_x;
            var y = current_y;
            var width = current_dx;
            var height = current_dy;

    
            function frame() {
                if (i == n_steps) {
                    img_object.canvas_x = final_x;
                    img_object.canvas_y = final_y;
                    img_object.width = final_dx;
                    img_object.height = final_dy;
                    clearInterval(id);
                    resolve();
                } else {
                    i++;
                    context.clearRect(
                        x, y, width * 1.1, height * 1.1 // to avoid anti-ailiasing issues
                    );
                    x += dx;
                    y += dy;
                    width += ddx;
                    height += ddy;
                    context.drawImage(
                        img_object, x, y, width, height
                    );
                };
                for (const oi of images_to_redraw){
                    context.drawImage(
                        oi.img, oi.img.canvas_x, oi.img.canvas_y, oi.img.width, oi.img.height
                    );
                };
            }
        } // end of resolve
    );
};