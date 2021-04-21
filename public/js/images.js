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

function move(image, destination_x, destination_y, duration, other_images, updateInterval = 25) {

    object = image.img;
    context = image.data.ctx;
    canvas = image.data.canvas;

    var images_to_redraw = [];
    for (const [oi_name, oi] of Object.entries(other_images)){
        if ((oi.data.ctx === context) && (oi.data.img_name != image.data.img_name)){
            images_to_redraw.push(oi);
        }
    }

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
        for (const oi of images_to_redraw){
            context.drawImage(
                oi.img, oi.img.canvas_x, oi.img.canvas_y, oi.img.width, oi.img.height
            );
        };
    }
};