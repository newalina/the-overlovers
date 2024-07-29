import * as THREE from "three";
import {
  tslFn,
  attribute,
  varyingProperty,
  timerLocal,
  uniform,
  wgslFn,
  texture,
  sampler,
  uv,
  clamp,
  float,
  vec2,
  vec3,
  fract,
  floor,
  positionGeometry,
  sin,
} from "three/tsl";

import WebGPU from "three/addons/capabilities/WebGPU.js";

let renderer, camera, scene;
const dpr = window.devicePixelRatio;

const crtWidthUniform = uniform(1608);
const crtHeightUniform = uniform(1608);

const canvas = document.getElementById("c");

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.render(scene, camera);
}

function init() {
  if (WebGPU.isAvailable() === false) {
    document.body.appendChild(WebGPU.getErrorMessage());

    throw new Error("No WebGPU support");
  }

  const vUv = varyingProperty("vec2", "vUv");

  const wgslVertexShader = wgslFn(
    `
    fn crtVertex(
       position: vec3f,
      uv: vec2f
    ) -> vec3<f32> {
      varyings.vUv = uv;
      return position;
    }
  `,
    [vUv]
  );

  const wgslFragmentShader = wgslFn(`
    fn crtFragment(
      vUv: vec2f,
      tex: texture_2d<f32>,
      texSampler: sampler,
      crtWidth: f32,
      crtHeight: f32,
      cellOffset: f32,
      cellSize: f32,
      borderMask: f32,
      time: f32,
      speed: f32,
      pulseIntensity: f32,
      pulseWidth: f32,
      pulseRate: f32
    ) -> vec3<f32> {
      // Convert uv into map of pixels
      var pixel = ( vUv * 0.5 + 0.5 ) * vec2<f32>(
        crtWidth,
        crtHeight
      );
      // Coordinate for each cell in the pixel map
      let coord = pixel / cellSize;
      // Three color values for each cell (r, g, b)
      let subcoord = coord * vec2f( 3.0, 1.0 );
      let offset = vec2<f32>( 0, fract( floor( coord.x ) * cellOffset ) );

      let maskCoord = floor( coord + offset ) * cellSize;

      var samplePoint = maskCoord / vec2<f32>(crtWidth, crtHeight);
      samplePoint.x += fract( time * speed / 20 );

      var color = textureSample(
        tex,
        texSampler,
        samplePoint
      ).xyz;

      // Current implementation does not give an even amount of space to each r, g, b unit of a cell
      // Fix/hack this by multiplying subCoord.x by cellSize at cellSizes below 6
      let ind = floor( subcoord.x ) % 3;

      var maskColor = vec3<f32>(
        f32( ind == 0.0 ),
        f32( ind == 1.0 ),
        f32( ind == 2.0 )
      ) * 3.0;

      let cellUV = fract( subcoord + offset ) * 2.0 - 1.0;
      var border: vec2<f32> = 1.0 - cellUV * cellUV * borderMask;

      maskColor *= vec3f( clamp( border.x, 0.0, 1.0 ) * clamp( border.y, 0.0, 1.0) );

      color *= maskColor;

      color.r *= 1.0 + pulseIntensity * sin( pixel.y / pulseWidth + time * pulseRate );
      color.b *= 1.0 + pulseIntensity * sin( pixel.y / pulseWidth + time * pulseRate );
      color.g *= 1.0 + pulseIntensity * sin( pixel.y / pulseWidth + time * pulseRate );

      return color;
    }
  `);

  const textureLoader = new THREE.TextureLoader();
  const planetTexture = textureLoader.load(
    "/assets/textures/earth_lights_2048.png"
  );
  planetTexture.wrapS = THREE.RepeatWrapping;
  planetTexture.wrapT = THREE.RepeatWrapping;

  const cellOffsetUniform = uniform(0.5);
  const cellSizeUniform = uniform(6);
  const borderMaskUniform = uniform(1);
  const pulseIntensityUniform = uniform(0.06);
  const pulseWidthUniform = uniform(60);
  const pulseRateUniform = uniform(20);
  const wgslShaderSpeedUniform = uniform(0.05);
  const tslShaderSpeedUniform = uniform(0.05);

  const wgslShaderMaterial = new THREE.MeshBasicMaterial();

  wgslShaderMaterial.positionNode = wgslVertexShader({
    position: attribute("position"),
    uv: attribute("uv"),
  });

  wgslShaderMaterial.fragmentNode = wgslFragmentShader({
    vUv: vUv,
    tex: texture(planetTexture),
    texSampler: sampler(planetTexture),
    crtWidth: crtWidthUniform,
    crtHeight: crtHeightUniform,
    cellOffset: cellOffsetUniform,
    cellSize: cellSizeUniform,
    borderMask: borderMaskUniform,
    time: timerLocal(),
    speed: wgslShaderSpeedUniform,
    pulseIntensity: pulseIntensityUniform,
    pulseWidth: pulseWidthUniform,
    pulseRate: pulseRateUniform,
  });

  const tslVertexShader = tslFn(() => {
    vUv.assign(uv());
    return positionGeometry;
  });

  const tslFragmentShader = tslFn(() => {
    const dimensions = vec2(crtWidthUniform, crtHeightUniform);
    const translatedUV = vUv.mul(0.5).add(0.5);
    const pixel = translatedUV.mul(dimensions);

    const coord = pixel.div(cellSizeUniform);
    const subCoord = coord.mul(vec2(3.0, 1.0));

    const cellOffset = vec2(0.0, fract(floor(coord.x).mul(cellOffsetUniform)));

    const maskCoord = floor(coord.add(cellOffset)).mul(cellSizeUniform);
    const samplePoint = maskCoord.div(dimensions);
    const time = timerLocal().mul(tslShaderSpeedUniform);
    samplePoint.x = samplePoint.x.add(fract(time.div(20)));
    samplePoint.y = samplePoint.y.sub(1.5);

    let color = texture(planetTexture, samplePoint);

    const ind = floor(subCoord.x).mod(3);

    let maskColor = vec3(ind.equal(0.0), ind.equal(1.0), ind.equal(2.0)).mul(
      3.0
    );

    const subCoordOffset = fract(subCoord.add(cellOffset));
    let cellUV = subCoordOffset.mul(2.0);
    cellUV = cellUV.sub(1.0);

    const border = float(1.0).sub(cellUV.mul(cellUV).mul(borderMaskUniform));

    const clampX = clamp(border.x, 0.0, 1.0);
    const clampY = clamp(border.y, 0.0, 1.0);
    const borderClamp = clampX.mul(clampY);
    maskColor = maskColor.mul(borderClamp);

    color = color.mul(maskColor);

    const pixelDampen = pixel.y.div(pulseWidthUniform);
    let pulse = sin(pixelDampen.add(time.mul(pulseRateUniform)));
    pulse = pulse.mul(pulseIntensityUniform);
    color = color.mul(float(1.0).add(pulse));

    return color;
  });

  const tslShaderMaterial = new THREE.MeshBasicMaterial();
  tslShaderMaterial.positionNode = tslVertexShader();
  tslShaderMaterial.colorNode = tslFragmentShader();

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const listener = new THREE.AudioListener();
  camera.add(listener);

  const sound = new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("/assets/songs/first day in heaven.mp3", function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.play();
  });

  scene = new THREE.Scene();

  const geometry = new THREE.PlaneGeometry(2, 1);

  const wgslQuad = new THREE.Mesh(geometry, wgslShaderMaterial);
  wgslQuad.position.y += 0.5;
  scene.add(wgslQuad);

  const tslQuad = new THREE.Mesh(geometry, tslShaderMaterial);
  tslQuad.position.y -= 0.5;
  scene.add(tslQuad);

  renderer = new THREE.WebGPURenderer({ antialias: true, canvas: canvas });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", onWindowResize);
}

init();
