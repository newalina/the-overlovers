import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const hdriURL =
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr";

let container;
let camera, scene, renderer;
let controls, mesh, uniforms;
let clock;
let elapsedTime = 0;
let params = {
  roughness: 0.1,
  iterations: 32,
  depth: 0.6,
  smoothing: 0.2,
  colourA: "#5c6164",
  colourB: "#000000",
  displacement: 0.1,
};

init();
animate();

function init() {
  container = document.getElementById("container");

  container.style.background = `radial-gradient(circle, transparent, ${params.colourB}, ${params.colourA})`;

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 2);

  const listener = new THREE.AudioListener();
  camera.add(listener);

  const sound = new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("/assets/songs/meet me.mp3", function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.play();
  });

  clock = new THREE.Clock();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enableZoom = false;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const hdriLoader = new RGBELoader();
  hdriLoader.load("/assets/hdri/poly_haven_studio_4k.hdr", function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    scene.environment = envMap;
  });

  const geometry = new THREE.SphereGeometry(1, 64, 32);
  const material = new THREE.MeshStandardMaterial({
    roughness: params.roughness,
  });

  const loader = new THREE.TextureLoader();

  const heightMap = loader.load("/assets/noise/noise.jpg");
  const displacementMap = loader.load("/assets/noise/noise3D.jpg");

  heightMap.minFilter = THREE.NearestFilter;
  displacementMap.minFilter = THREE.NearestFilter;
  displacementMap.wrapS = THREE.RepeatWrapping;
  displacementMap.wrapT = THREE.RepeatWrapping;

  uniforms = {
    iterations: { value: params.iterations },
    depth: { value: params.depth },
    smoothing: { value: params.smoothing },
    colourA: { value: new THREE.Color(params.colourA) },
    colourB: { value: new THREE.Color(params.colourB) },
    heightMap: { value: heightMap },
    displacementMap: { value: displacementMap },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ...uniforms };

    shader.vertexShader =
      /* glsl */ `
      varying vec3 v_pos;
      varying vec3 v_dir;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      /void main\(\) {/,
      (match) =>
        match +
        /* glsl */ `
        v_dir = position - cameraPosition; // Points from camera to vertex
        v_pos = position;
        `
    );

    shader.fragmentShader =
      /* glsl */ `
      #define FLIP vec2(1., -1.)
      
      uniform vec3 colourA;
      uniform vec3 colourB;
      uniform sampler2D heightMap;
      uniform sampler2D displacementMap;
      uniform int iterations;
      uniform float depth;
      uniform float smoothing;
      uniform float displacement;
      uniform float time;
      
      varying vec3 v_pos;
      varying vec3 v_dir;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      /void main\(\) {/,
      (match) =>
        /* glsl */ `
       	/**
         * @param p - Point to displace
         * @param strength - How much the map can displace the point
         * @returns Point with scrolling displacement applied
         */
        vec3 displacePoint(vec3 p, float strength) {
        	vec2 uv = equirectUv(normalize(p));
          vec2 scroll = vec2(time, 0.);
          vec3 displacementA = texture(displacementMap, uv + scroll).rgb; // Upright
					vec3 displacementB = texture(displacementMap, uv * FLIP - scroll).rgb; // Upside down
          
          // Center the range to [-0.5, 0.5], note the range of their sum is [-1, 1]
          displacementA -= 0.5;
          displacementB -= 0.5;
          
          return p + strength * (displacementA + displacementB);
        }
        
				/**
          * @param rayOrigin - Point on sphere
          * @param rayDir - Normalized ray direction
          * @returns Diffuse RGB color
          */
        vec3 marchMarble(vec3 rayOrigin, vec3 rayDir) {
          float perIteration = 1. / float(iterations);
          vec3 deltaRay = rayDir * perIteration * depth;

          // Start at point of intersection and accumulate volume
          vec3 p = rayOrigin;
          float totalVolume = 0.;

          for (int i=0; i<iterations; ++i) {
            // Read heightmap from spherical direction of displaced ray position
            vec3 displaced = displacePoint(p, displacement);
            vec2 uv = equirectUv(normalize(displaced));
            float heightMapVal = texture(heightMap, uv).r;

            // Take a slice of the heightmap
            float height = length(p); // 1 at surface, 0 at core, assuming radius = 1
            float cutoff = 1. - float(i) * perIteration;
            float slice = smoothstep(cutoff, cutoff + smoothing, heightMapVal);

            // Accumulate the volume and advance the ray forward one step
            totalVolume += slice * perIteration;
            p += deltaRay;
          }
          return mix(colourA, colourB, totalVolume);
        }
      ` + match
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      /vec4 diffuseColor.*;/,
      /* glsl */ `
      vec3 rayDir = normalize(v_dir);
      vec3 rayOrigin = v_pos;
      
      vec3 rgb = marchMarble(rayOrigin, rayDir);
      vec4 diffuseColor = vec4(rgb, 1.);      
      `
    );
  };

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;

  window.addEventListener("resize", onWindowResize);
}

function tick() {
  controls.update();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  elapsedTime += clock.getDelta();

  const cycleSpeed = 0.05;
  const hue = (elapsedTime * cycleSpeed) % 1;

  const mysterious = new THREE.Color().setHSL(hue, 0.5, 0.4);
  const introspective = new THREE.Color().setHSL(hue + 0.2, 0.3, 0.6);

  const mixFactor = 0.5 + 0.5 * Math.sin(elapsedTime * 0.5);
  const interpolated = mysterious.clone().lerp(introspective, mixFactor);

  params.colourB = interpolated;

  render();
}

function render() {
  const delta = clock.getDelta();
  tick(clock.elapsedTime, delta);

  uniforms.colourB.value = new THREE.Color(params.colourB);

  container.style.background = `radial-gradient(circle, transparent, ${params.colourB.getStyle()}, ${
    params.colourA
  })`;

  renderer.render(scene, camera);
}
