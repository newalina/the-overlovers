// function preload() {
//   bg = loadImage("assets/images/JD4185005787-R1-E022.JPG");
// }

// function setup() {
//   createCanvas(windowWidth, windowHeight);
//   // frameRate(60);
// }

// function draw() {
//   background(bg);

// function windowResized() {
//   resizeCanvas(windowWidth, windowHeight);
// }

var bg = [];
var img1, img2, img3, img4, img5, img6;
var hold = false;
var blurred = false;

function preload() {
  img1 = loadImage("assets/images/JD4185005788-R1-E035.JPG");
  img2 = loadImage("assets/images/JD4185005788-R1-E036.JPG");
  img3 = loadImage("assets/images/JD4185005788-R1-E037.JPG");
  img4 = loadImage("assets/images/JD4185005787-R1-E023.JPG");
  img5 = loadImage("assets/images/JD4185005787-R1-E020.JPG");
  img6 = loadImage("assets/images/JD4185005787-R1-E019.JPG");

  bg1 = loadImage("assets/images/000055850035.JPG");
  bg2 = loadImage("assets/images/000055850036.JPG");
}
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // img1.loadPixels();
  // img2.loadPixels();
  // img3.loadPixels();
  // img4.loadPixels();
  // img5.loadPixels();
  // img6.loadPixels();

  // bg.push(img1);
  // bg.push(img2);
  // bg.push(img3);
  // bg.push(img4);
  // bg.push(img5);
  // bg.push(img6);

  bg1.loadPixels();
  bg2.loadPixels();

  bg.push(bg1);
  bg.push(bg2);

  loadPixels();
}

function draw() {
  var r = 1;
  for (var i = 0; i < 20000; i++) {
    var x = int(random(windowWidth));
    var y = int(random(windowHeight));
    var nimg = round(
      noise(
        x * 0.002 + cos(frameCount * 0.02),
        y * 0.002 + sin(frameCount * 0.02),
        sin(frameCount * 0.01)
      )
    );

    for (var k = 0; k < 4; k++) {
      var col = pixels[k + 4 * (y * width + x)];
      pixels[k + 4 * (y * width + x)] = round(
        0.5 * bg[nimg].pixels[k + 4 * (y * width + x)] + 0.5 * col
      );
    }
  }
  updatePixels();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
