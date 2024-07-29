import * as THREE from "three";

let camera, scene, renderer;

let uniforms;

init();

function init() {
  const container = document.getElementById("container");

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const listener = new THREE.AudioListener();
  camera.add(listener);

  const sound = new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("/assets/songs/fallen angel.mp3", function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.play();
  });

  scene = new THREE.Scene();

  const geometry = new THREE.PlaneGeometry(2, 2);

  uniforms = {
    time: { value: 1.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: document.getElementById("vertexShader").textContent,
    fragmentShader: document.getElementById("fragmentShader").textContent,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  container.appendChild(renderer.domElement);

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  uniforms["time"].value = performance.now() / 10000;

  renderer.render(scene, camera);
}
