import * as THREE from "three";

let container;
let camera, scene, renderer;
let uniforms;
let time;

init();
animate();

function init() {
  container = document.getElementById("container");

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.autoClearColor = false;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

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

  const plane = new THREE.PlaneGeometry(2, 2);

  const fragmentShader = `
  #include <common>

  uniform vec3 iResolution;
  uniform float iTime;
  uniform vec2 iMouse;
  
  void mainImage(out vec4 fragColor, in vec2 fragCoord)
  {
    vec2 uv = fragCoord / iResolution.xy;

    float time = iTime * 0.5;
    vec2 p = uv * 2.0 - 1.0;

    float mouseEffect = 0.8 * length(iMouse);
    vec3 color = vec3(0.5, 0.5, 0.5) + 0.4 * cos(time + vec3(p, 0.0)) + vec3(mouseEffect, 0.0, 0.0);

    p = mod(p * 3.0, 2.0) - 1.0;
    float m = length(p);
    color *= smoothstep(0.8, 0.5, m);

    vec3 gradient = mix(vec3(0.3, 0.4, 0.5), vec3(0.2, 0.3, 0.4), uv.y);
    color += gradient * 0.4;

    fragColor = vec4(color, 1.0);
  }
  
  void main()
  {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
  `;

  uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
    iMouse: { value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    fragmentShader: fragmentShader,
    uniforms: uniforms,
  });

  scene.add(new THREE.Mesh(plane, material));

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  // Normalize mouse coordinates to range [0, 1]
  uniforms.iMouse.value.x = event.clientX / window.innerWidth;
  uniforms.iMouse.value.y = event.clientY / window.innerHeight;
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  time = performance.now() * 0.001;

  uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
  uniforms.iTime.value = time;

  renderer.render(scene, camera);
}
