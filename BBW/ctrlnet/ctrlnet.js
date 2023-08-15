import { pubStream, subStream } from '../webrtc/bbstream.js'
import { token } from '../webrtc/token.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader';
import { LineBasicMaterial, Mesh } from 'three';

let gScene = null;
let gRenderer = null;
let gCamera = null;
let gOrbitControls = null;

const interval = 1000 / 60;  // fps
let timeLast = Date.now();
let gLastFrame = window.performance.now();
let gLastFrame2 = window.performance.now();

const canvas = document.createElement('canvas');
const canvas2 = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const ctx2 = canvas2.getContext('2d');

let dir = null;

function loadScene(width, height) {
  gScene = new THREE.Scene();
  gScene.background = new THREE.Color(0xFFFFFF);
  const light = new THREE.DirectionalLight( 0xffffff, 0.75, 100);
  light.position.set( 1.0, 1.0, 1.0 ).normalize();
  gScene.add( light );
  var ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
  gScene.add( ambientLight );

  const axesHelper = new THREE.AxesHelper( 0.5 );
  gScene.add( axesHelper );
  const gridHelper = new THREE.GridHelper( 20, 1 );
  gScene.add( gridHelper );

  // const geometry = new THREE.CircleGeometry(1, 32); 
  // const textureLoader = new THREE.TextureLoader();
  // const texture = textureLoader.load('texture.png');
  // const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5});
  // const circle = new THREE.Mesh(geometry, material);
  // circle.rotation.x = -Math.PI / 2;
  // circle.position.set(0.,0.08,0.)
  // circle.scale.set(0.28,0.28,0.28)
  // gScene.add(circle);

  // var loader = new OBJLoader();
  // loader.load(
  //   'models/bowl.obj',
  //   function ( object ) {
  //     object.traverse( function ( child ) {
  //       if ( child instanceof Mesh ) {
  //         child.material.color.set( 0x8B4513 );
  //         child.rotation.x = -Math.PI / 2.;
  //         child.position.set(0.,0.866 * 0.3 / 2., 0.);
  //         child.material.side = THREE.DoubleSide;
  //         child.scale.set(0.3, 0.3, 0.3);
  //       }
  //     } );
  //     gScene.add( object );
  //   }
  // );

  // var loader2 = new OBJLoader();
  // const material2 = new THREE.MeshNormalMaterial();
  // loader2.load(
  //   'models/bunny.obj',
  //   function ( object ) {
  //     object.traverse( function ( child ) {
  //       if ( child instanceof Mesh ) {
  //         child.scale.set(4., 4., 4.);
  //         child.position.set(0.08,-0.3, 0.);
  //         child.material = material2;
  //       }
  //     });
  //     gScene.add( object );
  //   }
  // );
}

function init() {
  const params = new URL(window.location.href).searchParams;
  const dirUrl = params.get('dir');
  const size = params.get('s');
  const channelName = params.get('channel');
  const gNearPlane = parseFloat(params.get('near') || 0.33);
  const vfovy = parseFloat(params.get('vfovy') || 35);
  dir = params.get('dir') || 'bunny';
  let width = 512;
  let height = 512;
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
  canvas.width = width;
  canvas.height = height;

  const viewSpaceContainer = document.getElementById('viewspacecontainer');
  viewSpaceContainer.style.display = 'inline-block';

  const viewSpace = document.querySelector('.viewspace');
  viewSpace.appendChild(view);

  view.appendChild(canvas);

  // for alpha
  const view2 = document.createElement('div');
  view2.className = 'view';
  view2.style.width = (width / 2).toFixed(2) + 'px';
  view2.style.height = (height / 2).toFixed(2) + 'px';
  canvas2.width = width / 2;
  canvas2.height = height / 2;

  const viewSpaceContainer2 = document.getElementById('viewspacecontainer2');
  viewSpaceContainer2.style.display = 'inline-block';

  const viewSpace2 = document.querySelector('.viewspace2');
  viewSpace2.appendChild(view2);

  view2.appendChild(canvas2);

  // const canvas3 = document.createElement('canvas');
  // view.appendChild(canvas3);

  // gRenderer = new THREE.WebGLRenderer({canvas: canvas3});
  // gRenderer.autoClear = false;
  // gRenderer.setSize(view.offsetWidth, view.offsetHeight);

  gCamera = new THREE.PerspectiveCamera(
      72, canvas.offsetWidth / canvas.offsetHeight, gNearPlane, 100.0);
      // 72, canvas3.offsetWidth / canvas3.offsetHeight, gNearPlane, 100.0);
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

let i_prev=0;
let j_prev=0;

function render(t) {
  requestAnimationFrame(render);

  let currentFrame = window.performance.now();
  let milliseconds = currentFrame - gLastFrame2;
  if (milliseconds < interval) return;
  if (!gCamera.needsUpdate) return;

  gOrbitControls.update();
  gCamera.updateMatrix();
  let pos = gCamera.position;
  let theta = Math.atan2(pos.z, pos.x);
  let r2 = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  let r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
  let phi = Math.asin(r2 / r);
  theta = theta * (180. / Math.PI);
  theta = (theta + 360.) % 360.;
  // phi = (phi + 360.) % 360.;
  phi = phi * (180. / Math.PI);
  let j = Math.floor(((theta + 3) % 360) / 6);
  let i = Math.floor(15 - Math.min(Math.max(phi-15., 0), 90) / 6);
  if (i != i_prev || j != j_prev){
    const filename = `generated/${dir}/color/output_${String(j).padStart(4, '0')}_${String(i).padStart(4, '0')}.png`;
    const image = new Image();
    image.src = filename; // 画像ファイルのパス
    image.onload = () => {
      ctx.drawImage(image, 0, 0);
    };
    const filename2 = `generated/${dir}/alpha/output_${String(j).padStart(4, '0')}_${String(i).padStart(4, '0')}.png`;
    const image2 = new Image();
    image2.src = filename2; // 画像ファイルのパス
    image2.onload = () => {
      ctx2.drawImage(image2, 0, 0);
    };
  
  }
  i_prev = i;
  j_prev = j;

  // gRenderer.render(gScene, gCamera);

  updateFPSCounter();
  gLastFrame2 = currentFrame;
}

function start() {
  init();
  requestAnimationFrame(render);
  pubStream(token, gCamera, true);
}

start();
