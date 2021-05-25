function createImage(image_file, context, x_frac, y_frac, dx_frac, dy_frac, canvas, tooltip = null) {
    return new Promise(
        resolve => {
            var img = new Image();

            img.canvas_x = x_frac * canvas.width;
            img.canvas_y = y_frac * canvas.height;
            img.width = dx_frac * canvas.width;
            img.height = dy_frac * canvas.height;

            img.onload = function () {
                context.drawImage(img, img.canvas_x, img.canvas_y, img.width, img.height);
            }

            img.src = image_file;

            var i = 0;
            var id = setInterval(wait, 10)
            function wait(){
                i++;
                if (i>2){
                    clearInterval(id);
                    resolve(img);
                }
            }
        }
    );
};

function alter_image(image, new_image_file) {
    return new Promise(
        resolve => {
            clearImage(image).then(
                ()=>{
                    image.img.src = new_image_file
                    image.data.ctx.drawImage(
                        image.img, image.img.canvas_x, image.img.canvas_y, image.img.width, image.img.height
                    );
                    resolve();
                }
            );
        }
    );
};

function clearImage(image) {
    return new Promise(
        resolve => {
            image.data.ctx.clearRect(
                image.img.canvas_x, image.img.canvas_y, image.img.width, image.img.height
            );
            resolve();
        }
    )
};

function clearAndRedrawCanvas(image, other_images){
    //$("body").toggleClass("refresh");
    // Above seems to work for now...

    
    return new Promise(
        resolve => {
            var context = image.data.ctx;
            var canvas = image.data.canvas;

            var images_to_redraw = [];
            for (const [oi_name, oi] of Object.entries(other_images)){
                if ((oi.data.ctx === context)){
                    images_to_redraw.push(oi);
                }
            }

            context.clearRect(
                0, 0, canvas.width, canvas.height
            );

            for (const i of images_to_redraw){
                _redraw_image(i, context);
            }
            resolve();
        }
    );
    
}

function _redraw_image(image, context){
    return new Promise(
        resolve => {
            if (image.moving) resolve();
            var img = image.img;
            context.drawImage(img, img.canvas_x, img.canvas_y, img.width, img.height);
            resolve();
        }
    )
    
}

async function move(image, destination_x, destination_y, destination_dx, destination_dy, duration, other_images, updateInterval = 25) {
    
    var img_object = image.img;
    var context = image.data.ctx;
    var canvas = image.data.canvas;
    image.moving = true;

    duration = 0.1

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

    if (duration == null){
        console.error("moveImage Duration is null for " + image +", we will loop forever!")
    }

    var n_steps = duration * 1000 / updateInterval;

    var final_x = destination_x ? destination_x * canvas.width : current_x;
    var final_y = destination_y ? destination_y * canvas.height : current_y;
    var final_dx = destination_dx ? destination_dx * canvas.width : current_dx;
    var final_dy = destination_dy ? destination_dy * canvas.height : current_dy;

    var dx = (final_x - current_x) / n_steps;
    var dy = (final_y - current_y) / n_steps;
    var ddx = (final_dx - current_dx) / n_steps;
    var ddy = (final_dy - current_dy) / n_steps;

    if (dx === 0 && dy === 0 && ddx === 0 && ddy === 0 && !duration){
        return Promise.resolve();
    }

    await new Promise(
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
                    image.moving = false;
                    clearInterval(id);
                    for (const oi_1 of images_to_redraw) {
                        _redraw_image(oi_1, context);
                    }
                    //_redraw_image(img_object, context);
                    resolve();
                } else {
                    i++;
                    context.clearRect(
                        x, y, width + 1, height + 1 // to avoid anti-ailiasing issues
                    );
                    
                    x += dx;
                    y += dy;
                    width += ddx;
                    height += ddy;

                    // Redraw first so our moving object is on top
                    for (const oi_2 of images_to_redraw) {
                        // Only redraw if overlap
                        if (oi_2.img.canvas_x <= 1.1 * (x + width) && (oi_2.img.canvas_x + oi_2.img.width) >= 0.9 * x &&
                            oi_2.img.canvas_y <= 1.1 * (y + height) && (oi_2.img.canvas_y + oi_2.img.height) >= 0.9 * y)
                            _redraw_image(oi_2, context);
                    };

                    context.drawImage(
                        img_object, x, y, width, height
                    );
                };
                
            }
        } // end of resolve
    );
    return await clearAndRedrawCanvas(image, other_images);
};