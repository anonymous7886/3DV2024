import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation.js';
import { pubStream, subStream } from '../webrtc/bbstream.js'
import { token } from '../webrtc/token.js';

let gScene = null;
let gRenderer = null;
let gCamera = null;
let gOrbitControls = null;

// for alpha
let textureOrig = null;
let gRenderer2 = null;
let gRayMarchScene2 = null;
let gBlitCamera2 = null;
let gRenderer3 = null;
let gRayMarchScene3 = null;
let gBlitCamera3 = null;

// const defaultModelUrl = './models/VRM1_Constraint_Twist_Sample.vrm';
const defaultModelUrl = './models/HatsuneMikuNT.vrm';
const defaultAnimationUrl = './mixamo/Texting.fbx';
let currentVrm = undefined;
let currentAnimationUrl = undefined;
let currentMixer = undefined;

const clock = new THREE.Clock();

const interval = 1000 / 60;  // fps
let timeLast = Date.now();
let gLastFrame = window.performance.now();


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

function loadVRM( modelUrl ) {
  const loader = new GLTFLoader();
  loader.crossOrigin = 'anonymous';

  const helperRoot = new THREE.Group();
  helperRoot.renderOrder = 10000;
  helperRoot.clear();
  // gScene.add( helperRoot );

  loader.register( ( parser ) => {
    return new VRMLoaderPlugin( parser, { helperRoot: helperRoot, autoUpdateHumanBones: true } );
  } );

  loader.load(
    // URL of the VRM you want to load
    modelUrl,

    // called when the resource is loaded
    ( gltf ) => {
      const vrm = gltf.userData.vrm;
      if ( currentVrm ) {
        gScene.remove( currentVrm.scene );
        VRMUtils.deepDispose( currentVrm.scene );
      }

      // put the model to the scene
      currentVrm = vrm;
      gScene.add( vrm.scene );

      // Disable frustum culling
      vrm.scene.traverse( ( obj ) => {
        obj.frustumCulled = false;
      } );

      const scale = 0.5; // for example
      vrm.scene.scale.setScalar( scale );

      // scale joints
      for ( const joint of vrm.springBoneManager.joints ) {
        joint.settings.stiffness *= scale;
        joint.settings.hitRadius *= scale;
      }

      // scale colliders
      for ( const collider of vrm.springBoneManager.colliders ) {
        const shape = collider.shape;
        // if ( shape instanceof VRMSpringBoneColliderShapeCapsule ) {
          shape.radius *= scale;
          if (shape.tail) {
          shape.tail.multiplyScalar( scale );}
        // } else if ( shape instanceof VRMSpringBoneColliderShapeSphere ) {
        //   shape.radius *= scale;
        // }
      }

      if ( currentAnimationUrl ) {
        loadFBX( currentAnimationUrl );
      }

      if ( defaultAnimationUrl ) {
        loadFBX( defaultAnimationUrl );
      }

      // rotate if the VRM is VRM0.0
      VRMUtils.rotateVRM0( vrm );

      // console.log( vrm );
    },

    // called while loading is progressing
    ( progress ) => console.log( 'Loading model...', 100.0 * ( progress.loaded / progress.total ), '%' ),

    // called when loading has errors
    ( error ) => console.error( error ),
  );

}


// mixamo animation
function loadFBX( animationUrl ) {
  currentAnimationUrl = animationUrl;

  // create AnimationMixer for VRM
  currentMixer = new THREE.AnimationMixer( currentVrm.scene );

  // Load animation
  loadMixamoAnimation( animationUrl, currentVrm ).then( ( clip ) => {
    // Apply the loaded animation to mixer and play
    currentMixer.clipAction( clip ).play();
    // currentMixer.timeScale = params.timeScale;
  } );
}


function loadScene() {
  gScene = new THREE.Scene();
  const light = new THREE.DirectionalLight( 0xffffff );
  light.position.set( 1.0, 1.0, 1.0 ).normalize();
  gScene.add( light );

  loadVRM( defaultModelUrl );
}

function init() {
  const params = new URL(window.location.href).searchParams;
  const dirUrl = params.get('dir');
  const size = params.get('s');
  const channelName = params.get('channel');
  const gNearPlane = parseFloat(params.get('near') || 0.01);
  const vfovy = parseFloat(params.get('vfovy') || 35);
  let width = 768;
  let height = 768;
  if (size) {
    const match = size.match(/([\d]+),([\d]+)/);
    width = parseInt(match[1], 10);
    height = parseInt(match[2], 10);
  }
  if (channelName) {
      document.getElementById('room-name').value = channelName;
  }

  // rgba (do not send this)
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

  // rgb (no alpha)
  const view2 = create('div', 'view');
  setDims(view2, width, height);
  view2.textContent = '';

  const viewSpaceContainer2 = document.getElementById('viewspacecontainer2');
  viewSpaceContainer2.style.display = 'inline-block';

  const viewSpace2 = document.querySelector('.viewspace2');
  viewSpace2.textContent = '';
  viewSpace2.appendChild(view2);

  let canvas2 = document.createElement('canvas');
  view2.appendChild(canvas2);

  // alpha
  const view3 = create('div', 'view');
  setDims(view3, width / 2, height / 2);
  view3.textContent = '';

  const viewSpaceContainer3 = document.getElementById('viewspacecontainer3');
  viewSpaceContainer3.style.display = 'inline-block';

  const viewSpace3 = document.querySelector('.viewspace3');
  viewSpace3.textContent = '';
  viewSpace3.appendChild(view3);

  let canvas3 = document.createElement('canvas');
  view3.appendChild(canvas3);

  loadScene();

  // `antialias: true` is not recommended
  gRenderer = new THREE.WebGLRenderer({ canvas: canvas });
  gRenderer.setSize(width, height);
  gRenderer.setClearColor(0xFFFFFF, 0.01);  // 0.01 magic! (TODO)
  gRenderer.setPixelRatio(window.devicePixelRatio);

  gCamera = new THREE.PerspectiveCamera(
      72, canvas.offsetWidth / canvas.offsetHeight, gNearPlane, 100.0);
  gCamera.aspect = view.offsetWidth / view.offsetHeight;
  gCamera.fov = vfovy;
  gCamera.position.set( 0.0, 0.5, 2.0 );
  gCamera.updateProjectionMatrix();

  gOrbitControls = new OrbitControls(gCamera, view);
  gOrbitControls.screenSpacePanning = true;
  gOrbitControls.zoomSpeed = 0.5;
  gOrbitControls.position = gCamera.position;
  gOrbitControls.position0 = gCamera.position;
  gOrbitControls.update();

  // original attribute
  gCamera.needsUpdate = true;
  gCamera.dist = 2.0;

  textureOrig = new THREE.Texture(canvas);

  // for rgb (no alpha)
  gRenderer2 = new THREE.WebGLRenderer({ canvas: canvas2 });
  gRenderer2.setSize(width, height);
  gRayMarchScene2 = new THREE.Scene();
  gBlitCamera2 = new THREE.OrthographicCamera(
      width / -2, width / 2, height / 2, height / -2, -10000, 10000);
  gBlitCamera2.position.z = 100;

  let material2 = new THREE.ShaderMaterial({
    uniforms: {
      myTexture: { type: 't', value: textureOrig },
      resolution: { type: 'v2', value: new THREE.Vector2(canvas2.width, canvas2.height) }
    },
    fragmentShader: `
      uniform sampler2D myTexture;
      uniform vec2 resolution;
      void main() {
        vec4 color = texture2D(myTexture, gl_FragCoord.xy / resolution);
        gl_FragColor = vec4(color.r, color.g, color.b, 1.0);
      }
    `
  });

  let fullScreenPlane2 = new THREE.PlaneGeometry(width, height);
  let fullScreenPlaneMesh2 = new THREE.Mesh(fullScreenPlane2, material2);
  fullScreenPlaneMesh2.position.z = -100;
  fullScreenPlaneMesh2.frustumCulled = false;
  gRayMarchScene2.add(fullScreenPlaneMesh2);
  gRayMarchScene2.matrixWorldAutoUpdate = false;

  // for alpha
  gRenderer3 = new THREE.WebGLRenderer({ canvas: canvas3 });
  gRenderer3.setSize(width / 2, height / 2);
  gRayMarchScene3 = new THREE.Scene();
  gBlitCamera3 = new THREE.OrthographicCamera(
      width / -4, width / 4, height / 4, height / -4, -10000, 10000);
  gBlitCamera3.position.z = 100;

  let material3 = new THREE.ShaderMaterial({
    uniforms: {
      myTexture: { type: 't', value: textureOrig },
      resolution: { type: 'v2', value: new THREE.Vector2(canvas3.width, canvas3.height) }
    },
    fragmentShader: `
      uniform sampler2D myTexture;
      uniform vec2 resolution;
      void main() {
        vec4 color = texture2D(myTexture, gl_FragCoord.xy / resolution);
        gl_FragColor = vec4(color.a, color.a, color.a, 1.0);
      }
    `
  });

  let fullScreenPlane3 = new THREE.PlaneGeometry(width / 2, height / 2);
  let fullScreenPlaneMesh3 = new THREE.Mesh(fullScreenPlane3, material3);
  fullScreenPlaneMesh3.position.z = -100;
  fullScreenPlaneMesh3.frustumCulled = false;
  gRayMarchScene3.add(fullScreenPlaneMesh3);
  gRayMarchScene3.matrixWorldAutoUpdate = false;
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

  const timeNow = Date.now();
  const timeDiff = timeNow - timeLast;
  if (timeDiff < interval) return;
  // if (!gCamera.needsUpdate) return;

  const deltaTime = clock.getDelta();
  if ( currentVrm ) {
    currentVrm.update( deltaTime );
  }
  if ( currentMixer ) {
    currentMixer.update( deltaTime );
  }

  gOrbitControls.update();
  gCamera.updateMatrix();
  gRenderer.render(gScene, gCamera);

  // for rgb, alpha
  if (textureOrig) {
      textureOrig.needsUpdate = true;
  }
  gRenderer2.render(gRayMarchScene2, gBlitCamera2);
  gRenderer3.render(gRayMarchScene3, gBlitCamera3);

  updateFPSCounter();
  timeLast = timeNow  - (timeDiff % interval);
}

function start() {
  init();
  requestAnimationFrame(render);
  pubStream(token, gCamera, true);
}

start();

window.addEventListener( 'dragover', function ( event ) {
  event.preventDefault();
} );

window.addEventListener( 'drop', function ( event ) {
  event.preventDefault();

  // read given file then convert it to blob url
  const files = event.dataTransfer.files;
  if ( ! files ) return;

  const file = files[ 0 ];
  if ( ! file ) return;

  const fileType = file.name.split( '.' ).pop();
  const blob = new Blob( [ file ], { type: 'application/octet-stream' } );
  const url = URL.createObjectURL( blob );

  if ( fileType === 'fbx' ) {
    loadFBX( url );
  } else {
    loadVRM( url );
  }
} );
