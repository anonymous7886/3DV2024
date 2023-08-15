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

  let width = 768;
  let height = 768;
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
  canvas.width = width;
  canvas.height = height;
  view.appendChild(canvas);

  const view2 = create('div', 'view');
  setDims(view2, width/2, height/2);
  view2.textContent = '';

  const viewSpaceContainer2 = document.getElementById('viewspacecontainer2');
  viewSpaceContainer2.style.display = 'inline-block';

  const viewSpace2 = document.querySelector('.viewspace2');
  viewSpace2.textContent = '';
  viewSpace2.appendChild(view2);

  let canvas2 = document.createElement('canvas');
  canvas2.width = width / 2;
  canvas2.height = height / 2;
  view2.appendChild(canvas2);

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
  gOrbitControls.target.set( 0., 0., 0. );

  // original attribute
  gCamera.needsUpdate = true;
  gCamera.dist = 1.;

  socket = new WebSocket("ws://localhost:" + port.toString());

  // socket.binaryType = 'arraybuffer';
  socket.binaryType = 'blob';

  socket.onopen = function(e) {
    console.log("[open] Connection established");
    flag_ws = true;
  };

  socket.onmessage = function(e) {
    // var arrayBuffer = e.data;
    // var uint8Array = new Uint8Array(arrayBuffer);
    // var uint8Array = new Uint8ClampedArray(arrayBuffer);
    // let ctx = canvas.getContext('2d');
    // var imgData = new ImageData(uint8Array, width, height);
    // console.log('r', imgData.data[800*400*4 + 400*4])
    // ctx.putImageData(imgData, 0, 0);

    // var blob = new Blob([e.data], {type: "image/jpeg"});
    // var img = new Image();

    // img.onload = function() {
    //     let ctx = canvas.getContext('2d');
    //     ctx.clearRect(0, 0, canvas.width, canvas.height);
    //     ctx.drawImage(img, 0, 0);
    // };
    // img.src = URL.createObjectURL(blob);
    var reader = new FileReader();
    reader.onload = function() {
        var buffer = this.result;
        var view = new DataView(buffer);

        var length_rgb = view.getUint32(0);
        var data_rgb = new Blob([buffer.slice(4, 4 + length_rgb)], {type: "image/jpeg"});
        var img_rgb = new Image();
        img_rgb.onload = function() {
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img_rgb, 0, 0);
        };
        img_rgb.src = URL.createObjectURL(data_rgb);

        var length_alp = view.getUint32(4 + length_rgb);
        var data_alp = new Blob([buffer.slice(4 + length_rgb + 4, 4 + length_rgb + 4 + length_alp)], {type: "image/jpeg"});
        var img_alp = new Image();
        img_alp.onload = function() {
            let ctx = canvas2.getContext('2d');
            ctx.clearRect(0, 0, canvas2.width, canvas2.height);
            ctx.drawImage(img_alp, 0, 0);
        };
        img_alp.src = URL.createObjectURL(data_alp);
    };
    reader.readAsArrayBuffer(e.data);
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
  pubStream(tokenS, gCamera, true);

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

  // if (gOrbitControls.enabled) {
  gOrbitControls.update();
  // }
  gCamera.updateMatrix();
  gRenderer.setRenderTarget(null);
  gRenderer.clear();
  gRenderer.render(gRayMarchScene, gCamera);
  if (flag_ws) {
    // world coordinate
    // x,y,z (js) -> z,x,y (physX)
    // camera coordinate
    // x,y,z (js) -> x,-y,-z (physX) ???
    let pos = gCamera.position.toArray();
    pos = [pos[2]*15, pos[0]*15, pos[1]*15];
    let quat = gCamera.quaternion.toArray();
    quat = [quat[2], quat[0], quat[1], quat[3]];
    quat = [-quat[2], quat[1], -quat[0], quat[3]];
    let pose = pos.concat(quat)
    socket.send(pose.toString());
  }

  updateFPSCounter();
  timeLast = timeNow  - (timeDiff % interval);
}


function start() {
  initFromParameters();
}

start();
