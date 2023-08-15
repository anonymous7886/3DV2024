import { pubStream, subStream } from '../webrtc/bbstream.js'
import { tokenS } from '../webrtc/token.js';

let gRayMarchScene = null;
let gRenderer = null;
let gCamera = null;
let gOrbitControls = null;
let loadingTextures = false;
let gLastFrame = window.performance.now();

let socket;
let flag_ws = false;


function create(what, classname) {
  const e = /** @type {!HTMLElement} */(document.createElement(what));
  if (classname) {
    e.className = classname;
  }
  return e;
}

function setDims(element, width, height) {
  element.style.width = width.toFixed(2) + 'px';
  element.style.height = height.toFixed(2) + 'px';
}

function hideLoading() {
  let loading = document.getElementById('Loading');
  loading.style.display = 'none';

  let loadingContainer = document.getElementById('loading-container');
  loadingContainer.style.display = 'none';
}

function loadScene(width, height) {
  requestAnimationFrame(render);

  gRayMarchScene = new THREE.Scene();
  gRayMarchScene.background = new THREE.Color(0xFFFFFF);
  const axesHelper = new THREE.AxesHelper( 0.5 );
  gRayMarchScene.add( axesHelper );
  const gridHelper = new THREE.GridHelper( 20, 1 );
  gRayMarchScene.add( gridHelper );
  gRayMarchScene.autoUpdate = false;
}

function initFromParameters() {
  const params = new URL(window.location.href).searchParams;
  const dirUrl = params.get('dir');
  const size = params.get('s');
  const port = params.get('port');
  const channelName = params.get('channel');

  const usageString = 'usage';

  let width = 800;
  let height = 800;
  if (size) {
    const match = size.match(/([\d]+),([\d]+)/);
    width = parseInt(match[1], 10);
    height = parseInt(match[2], 10);
  }

  const gNearPlane = parseFloat(params.get('near') || 0.33);
  const vfovy = parseFloat(params.get('vfovy') || 35);

  if (channelName) {
      document.getElementById('room-name').value = channelName;
  }

  loadScene(width, height);

  const view = create('div', 'view');
  setDims(view, width, height);
  view.textContent = '';

  const viewSpaceContainer = document.getElementById('viewspacecontainer');
  viewSpaceContainer.style.display = 'inline-block';

  const viewSpace = document.querySelector('.viewspace');
  viewSpace.textContent = '';
  viewSpace.appendChild(view);

  let canvas = document.createElement('canvas');
  view.appendChild(canvas);

  gRenderer = new THREE.WebGLRenderer();

  gCamera = new THREE.PerspectiveCamera(
      72, canvas.offsetWidth / canvas.offsetHeight, gNearPlane, 100.0);
  gCamera.aspect = view.offsetWidth / view.offsetHeight;
  gCamera.fov = vfovy;
  gRenderer.autoClear = false;
  gRenderer.setSize(view.offsetWidth, view.offsetHeight);

  gOrbitControls = new THREE.OrbitControls(gCamera, view);
  gOrbitControls.screenSpacePanning = true;
  gOrbitControls.zoomSpeed = 0.5;
  gOrbitControls.target.set( 0.5, 0.5, 0.5 );

  // original attribute
  gCamera.needsUpdate = true;
  gCamera.dist = 1.;

  socket = new WebSocket("ws://localhost:" + port.toString());
  socket.binaryType = 'arraybuffer';

  socket.onopen = function(e) {
    console.log("[open] Connection established");
    flag_ws = true;
  };

  socket.onmessage = function(e) {
    var arrayBuffer = e.data;
    var uint8Array = new Uint8Array(arrayBuffer);
    var width = 800;
    var height = 800;

    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(width, height);
    for (var i = 0; i < uint8Array.length; i++) {
        imageData.data[i] = uint8Array[i];
    }
    ctx.putImageData(imageData, 0, 0);
  };
}

function loadOnFirstFrame() {
  if (loadingTextures) return;

  gCamera.position.set( 0.0, 1.0, 4.0 );
  gOrbitControls.position = gCamera.position;
  gOrbitControls.position0 = gCamera.position;

  gCamera.updateProjectionMatrix();
  gOrbitControls.update();

  hideLoading();
  pubStream(tokenS, gCamera);

  loadingTextures = true;
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

const interval = 1000 / 30;  // fps
let timeLast = Date.now();

function render(t) {
  loadOnFirstFrame();
  requestAnimationFrame(render);
  const timeNow = Date.now();
  const timeDiff = timeNow - timeLast;
  if (timeDiff < interval) return;
  // if (!gCamera.needsUpdate) return;

  if (gOrbitControls.enabled) {
    gOrbitControls.update();
  }
  gCamera.updateMatrix();
  gRenderer.setRenderTarget(null);
  gRenderer.clear();
  gRenderer.render(gRayMarchScene, gCamera);
  if (flag_ws) {
    var flipMatrix = new THREE.Matrix4();
    flipMatrix.set(
        1,  0,  0,  0,
        0, -1,  0,  0,
        0,  0, -1,  0,
        0,  0,  0,  1
    );
    var mat = gCamera.matrixWorld.clone();
    mat.multiply(flipMatrix);
    socket.send(mat.toArray().toString());
  }

  updateFPSCounter();
  timeLast = timeNow  - (timeDiff % interval);
}


function start() {
  initFromParameters();
}

start();
