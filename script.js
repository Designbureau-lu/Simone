const input = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

input.addEventListener("change", loadImage);

function loadImage(event){

    const file = event.target.files[0];

    if(!file) return;

    const img = new Image();

    img.onload = function(){

        canvas.width = img.width;
        canvas.height = img.height;

        drawColumns(img);

    };

    img.src = URL.createObjectURL(file);

}

function drawColumns(img){
    const visibleStep = 2;

    for(let x=0; x<img.width; x+=visibleStep){

        ctx.drawImage(

            img,

            x,0,1,img.height,

            x*0.9,0,1,img.height

        );

    }

}