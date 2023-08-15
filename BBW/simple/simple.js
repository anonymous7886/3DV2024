import { pubStream, subStream } from '../webrtc/bbstream.js'
import { token } from '../webrtc/token.js';

let gScene = null;
let gRenderer = null;
let gCamera = null;
let gOrbitControls = null;

const interval = 1000 / 60;  // fps
let timeLast = Date.now();
let gLastFrame = window.performance.now();
let gLastFrame2 = window.performance.now();


function loadScene(width, height) {
  gScene = new THREE.Scene();
  gScene.background = new THREE.Color(0xFFFFFF);
  const axesHelper = new THREE.AxesHelper( 0.5 );
  gScene.add( axesHelper );
  const gridHelper = new THREE.GridHelper( 20, 1 );
  gScene.add( gridHelper );
  const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshNormalMaterial()
  );
  gScene.add(box);
  gScene.autoUpdate = false;
}

function init() {
  const params = new URL(window.location.href).searchParams;
  const dirUrl = params.get('dir');
  const size = params.get('s');
  const channelName = params.get('channel');
  const gNearPlane = parseFloat(params.get('near') || 0.33);
  const vfovy = parseFloat(params.get('vfovy') || 35);
  let width = 800;
  let height = 800;
  if (size) {
    const match = size.match(/([\d]+),([\d]+)/);
    width = parseInt(match[1], 10);
    height = parseInt(match[2], 10);
  }
  if (channelName) {
      document.getElementById('room-name').value = channelName;
  }

  loadScene(width, height);

  const view = document.createElement('div');
  view.className = 'view';
  view.style.width = width.toFixed(2) + 'px';
  view.style.height = height.toFixed(2) + 'px';

  const viewSpaceContainer = document.getElementById('viewspacecontainer');
  viewSpaceContainer.style.display = 'inline-block';

  const viewSpace = document.querySelector('.viewspace');
  viewSpace.appendChild(view);

  let canvas = document.createElement('canvas');
  view.appendChild(canvas);

  gRenderer = new THREE.WebGLRenderer({canvas: canvas});
  gRenderer.autoClear = false;
  gRenderer.setSize(view.offsetWidth, view.offsetHeight);

  gCamera = new THREE.PerspectiveCamera(
      72, canvas.offsetWidth / canvas.offsetHeight, gNearPlane, 100.0);
  gCamera.aspect = view.offsetWidth / view.offsetHeight;
  gCamera.fov = vfovy;
  gCamera.position.set( 0.0, 1.0, 4.0 );
  gCamera.updateProjectionMatrix();

  gOrbitControls = new THREE.OrbitControls(gCamera, view);
  gOrbitControls.screenSpacePanning = true;
  gOrbitControls.zoomSpeed = 0.5;
  gOrbitControls.position = gCamera.position;
  gOrbitControls.position0 = gCamera.position;
  gOrbitControls.update();

  // original attribute
  gCamera.needsUpdate = true;
  gCamera.dist = 1.;

}

function updateFPSCounter() {
  let currentFrame = window.performance.now();
  let milliseconds = currentFrame - gLastFrame;
  let oldMilliseconds = 1000 /
      (parseFloat(document.getElementById('fpsdisplay').innerHTML) || 1.0);

  // Prevent the FPS from getting stuck by ignoring frame times over 2 seconds.
  if (oldMilliseconds > 2000 || oldMilliseconds < 0) {
    oldMilliseconds = milliseconds;
  }
  let smoothMilliseconds = oldMilliseconds * (0.75) + milliseconds * 0.25;
  let smoothFps = 1000 / smoothMilliseconds;
  gLastFrame = currentFrame;
  document.getElementById('fpsdisplay').innerHTML = smoothFps.toFixed(1);
}

function render(t) {
  requestAnimationFrame(render);

  let currentFrame = window.performance.now();
  let milliseconds = currentFrame - gLastFrame2;
  if (milliseconds < interval) return;
  if (!gCamera.needsUpdate) return;

  gOrbitControls.update();
  gCamera.updateMatrix();
  gRenderer.render(gScene, gCamera);

  updateFPSCounter();
  gLastFrame2 = currentFrame;
}

function start() {
  init();
  requestAnimationFrame(render);
  pubStream(token, gCamera);
}

start();
