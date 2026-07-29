const input = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

input.addEventListener("change", loadImage);

function loadImage(event) {

    const file = event.target.files[0];

    if (!file) return;

    const img = new Image();

    img.onload = function () {

        canvas.width = img.width;
        canvas.height = img.height;

        drawColumns(img);

    };

    img.src = URL.createObjectURL(file);

}

function drawColumns(img) {

    const compression = 1.0;

    for (let x = 0; x < img.width; x++) {

        let column = {

            sourceX: x,
            destinationX: x * compression,
            visibility: 1.0

        };

        ctx.drawImage(

            img,

            column.sourceX,
            0,
            1,
            img.height,

            column.destinationX,
            0,
            1,
            img.height

        );

    }

}