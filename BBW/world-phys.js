import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { OculusHandModel } from 'three/addons/webxr/OculusHandModel.js';
const { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } = skyway_room;
import { token } from './webrtc/token.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
const { WebXRPolyfill } = 'webxr-polyfill';
import { alphaShader } from './shader.js';


// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.xr.enabled = true;
document.body.appendChild( renderer.domElement );
document.body.appendChild( VRButton.createButton(renderer) );

// const polyfill = new WebXRPolyfill();

// camera
const camera = new THREE.PerspectiveCamera( 30.0, window.innerWidth / window.innerHeight, 0.1, 10000.0 );
camera.position.set( 20.0, 10.0, 20.0 );

// camera controls
const controls = new OrbitControls( camera, renderer.domElement );
controls.screenSpacePanning = true;
controls.target.set( 0.0, 0.0, 0.0 );
controls.update();

// define clock
const clock = new THREE.Clock();

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF);
// scene.background = new THREE.Color(0xF0F0F0);

// helpers
const gridHelper = new THREE.GridHelper( 10, 1 );
scene.add( gridHelper );

const axesHelper = new THREE.AxesHelper( 1 );
scene.add( axesHelper );

// drag controls
const dragControls = new DragControls([], camera, renderer.domElement);
dragControls.addEventListener('drag', function (event) {
  controls.enabled = false;
});
dragControls.addEventListener('dragend', function (event) {
  controls.enabled = true;
});

window.addEventListener('resize', function (event) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});

let isHandShown = {left: false, right: false};
let isSnowing = false;
let snowInterval;

// load PLY
function getPlyMesh() {
  return new Promise((resolve, reject) => {
    const loader = new PLYLoader();
    loader.load( './lego.ply', ( geometry ) => {
      let material = new THREE.MeshLambertMaterial( { color: 0xaaffff } );
      material.wireframe = false;
      let plyMesh = new THREE.Mesh( geometry, material);
      plyMesh.position.set(-1., 1., 0.);
      plyMesh.scale.set(0.09, 0.09, 0.09);
      plyMesh.rotation.set(-90 * Math.PI / 180, 0, 180 * Math.PI / 180);
      plyMesh.castShadow = true;
      // Set the mesh to invisible
      plyMesh.visible = false;
      scene.add(plyMesh);
      // dragControls.getObjects().push(plyMesh);

      resolve(plyMesh);
    }, undefined, reject);
  })
}

// create XRHandModelFactor instance
const leftHand = renderer.xr.getHand(0);
leftHand.add(new OculusHandModel(leftHand));
scene.add(leftHand);

const rightHand = renderer.xr.getHand(1);
rightHand.add(new OculusHandModel(rightHand));
scene.add(rightHand);

let meshStreamMap = new Map();


// declare variables
let physicsWorld, rigidBodies = [];
const gravityConstant = - 9.8;
const margin = 0.01;
let hinge;
let cloth;
let armMovement = 0;
let tmpPos = new THREE.Vector3(), tmpQuat = new THREE.Quaternion();
let tmpTrans = null, ammoTmpPos = null, ammoTmpQuat = null;

const STATE = { DISABLE_DEACTIVATION : 4 }

const FLAGS = { CF_KINEMATIC_OBJECT: 2 }

// Init Ammo
Ammo().then( () => {
  start();
})

function start (){

  tmpTrans = new Ammo.btTransform();
  ammoTmpPos = new Ammo.btVector3();
  ammoTmpQuat = new Ammo.btQuaternion();

  // Initialize physics engine
  setupPhysicsWorld();

  createGround();

  createCloth();

  // createSnow();
  document.addEventListener('keydown',(event) => {
    if (event.key === 's') {
      isSnowing = !isSnowing; // if it's snowing, stop it; if it's stopped, let it fall.
      if (isSnowing) {
        snowInterval = setInterval(() => {
          let range = 0.66;
          let x = Math.random() * range - range / 2 - 1.0;
          let z = Math.random() * range - range / 2 - 0.;
          createSnow({x: x, y: 3, z: z});
        }, 100);
      } else {
        // stop snowing
        clearInterval(snowInterval);
      }
    }
  })

  animate();
}

function setupPhysicsWorld(){
  const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const softBodySolver = new Ammo.btDefaultSoftBodySolver();
  physicsWorld = new Ammo.btSoftRigidDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration, softBodySolver );
  physicsWorld.setGravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
  physicsWorld.getWorldInfo().set_m_gravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
}

function createGround(){

  let pos = {x: 0, y: -0.5, z: 0};
  let scale = {x: 10, y: 1, z: 10};
  let quat = {x: 0, y: 0, z: 0, w: 1};
  let mass = 0;

  let ground = new THREE.Mesh(new THREE.BoxBufferGeometry(), new THREE.MeshBasicMaterial({color: 0xFFFFFF}));
  ground.scale.set(scale.x, scale.y, scale.z);
  let colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
  createRigidBody( ground, colShape, mass, pos, quat );
}

function createCloth() {
  // Cloth graphic object
  let pos = new THREE.Vector3();
  let quat = new THREE.Quaternion();

  const textureLoader = new THREE.TextureLoader();

  const clothWidth = 1.5;
  const clothHeight = 1.5;
  const clothNumSegmentsZ = clothWidth * 30;
  const clothNumSegmentsY = clothHeight * 30;
  const clothPos = new THREE.Vector3( 0, 1, clothWidth / 2 );

  const clothGeometry = new THREE.PlaneGeometry( clothWidth, clothHeight, clothNumSegmentsZ, clothNumSegmentsY );
  clothGeometry.rotateY( Math.PI * 0.5 );
  clothGeometry.translate( clothPos.x, clothPos.y + clothHeight * 0.5, clothPos.z - clothWidth * 0.5 );

  const clothMaterial = new THREE.MeshBasicMaterial( { color: 0xFFFFFF, side: THREE.DoubleSide } );
  cloth = new THREE.Mesh( clothGeometry, clothMaterial );
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  scene.add( cloth );
  textureLoader.load( 'textures/grid.png', function ( texture ) {

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set( clothNumSegmentsZ, clothNumSegmentsY );
    cloth.material.map = texture;
    cloth.material.needsUpdate = true;

  } );

  // Cloth physic object
  const softBodyHelpers = new Ammo.btSoftBodyHelpers();
  const clothCorner00 = new Ammo.btVector3( clothPos.x, clothPos.y + clothHeight, clothPos.z );
  const clothCorner01 = new Ammo.btVector3( clothPos.x, clothPos.y + clothHeight, clothPos.z - clothWidth );
  const clothCorner10 = new Ammo.btVector3( clothPos.x, clothPos.y, clothPos.z );
  const clothCorner11 = new Ammo.btVector3( clothPos.x, clothPos.y, clothPos.z - clothWidth );
  const clothSoftBody = softBodyHelpers.CreatePatch( physicsWorld.getWorldInfo(), clothCorner00, clothCorner01, clothCorner10, clothCorner11, clothNumSegmentsZ + 1, clothNumSegmentsY + 1, 0, true );
  const sbConfig = clothSoftBody.get_m_cfg();
  sbConfig.set_viterations( 10 );
  sbConfig.set_piterations( 10 );

  clothSoftBody.setTotalMass( 0.9, false );
  Ammo.castObject( clothSoftBody, Ammo.btCollisionObject ).getCollisionShape().setMargin( margin * 3 );
  physicsWorld.addSoftBody( clothSoftBody, 1, - 1 );
  cloth.userData.physicsBody = clothSoftBody;
  // Disable deactivation
  clothSoftBody.setActivationState( 4 );

  // The base
  const armMass = 2;
  const armLength = 3 + clothWidth;
  const pylonHeight = clothPos.y + clothHeight;
  const baseMaterial = new THREE.MeshBasicMaterial( { color: 0x606060 } );
  pos.set( clothPos.x, 0.1, clothPos.z - armLength );
  quat.set( 0, 0, 0, 1 );
  const base = createParalellepiped( 1, 0.2, 1, 0, pos, quat, baseMaterial );
  base.castShadow = true;
  base.receiveShadow = true;
  pos.set( clothPos.x, 0.5 * pylonHeight / 3, clothPos.z - armLength );
  const pylon = createParalellepiped( 0.4, pylonHeight, 0.4, 0, pos, quat, baseMaterial );
  pylon.castShadow = true;
  pylon.receiveShadow = true;
  pos.set( clothPos.x, pylonHeight + 0.2, clothPos.z - 0.5 * armLength );
  const arm = createParalellepiped( 0.4, 0.4, armLength + 0.4, armMass, pos, quat, baseMaterial );
  arm.castShadow = true;
  arm.receiveShadow = true;

  // Glue the cloth to the arm
  const influence = 1.5;
  clothSoftBody.appendAnchor( 0, arm.userData.physicsBody, false, influence );
  clothSoftBody.appendAnchor( clothNumSegmentsZ, arm.userData.physicsBody, false, influence );

  // Hinge constraint to move the arm
  const pivotA = new Ammo.btVector3( 0, pylonHeight * 0.5, 0 );
  const pivotB = new Ammo.btVector3( 0, - 0.2, - armLength * 0.5 );
  const axis = new Ammo.btVector3( 0, 1, 0 );
  hinge = new Ammo.btHingeConstraint( pylon.userData.physicsBody, arm.userData.physicsBody, pivotA, pivotB, axis, axis, true );
  physicsWorld.addConstraint( hinge, true );

  // keyboard control
  window.addEventListener( 'keydown', function ( event ) {
    switch ( event.keyCode ) {
      // D
      case 68:
        armMovement = 0.5;
        break;
      // A
      case 65:
        armMovement = - 0.5;
        break;
    }
  } );

  window.addEventListener( 'keyup', function () {
    armMovement = 0;
  } );
}

function createParalellepiped( sx, sy, sz, mass, pos, quat, material ) {

  const threeObject = new THREE.Mesh( new THREE.BoxGeometry( sx, sy, sz, 1, 1, 1 ), material );
  const shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
  shape.setMargin( margin );

  createRigidBody( threeObject, shape, mass, pos, quat );

  return threeObject;
}

function createSnow(position){
  let radius = 0.01;
  let quat = {x: 0, y: 0, z: 0, w: 1};
  let mass = 0.001;

  let ball = new THREE.Mesh(new THREE.SphereBufferGeometry(radius), new THREE.MeshBasicMaterial({color: 0xFFD400}));
  let colShape = new Ammo.btSphereShape( radius );
  createRigidBody(ball, colShape, mass, position, quat);
}

function createRigidBody( threeObject, physicsShape, mass, pos, quat ) {

  threeObject.position.copy( pos );
  threeObject.quaternion.copy( quat );

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
  transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
  const motionState = new Ammo.btDefaultMotionState( transform );

  const localInertia = new Ammo.btVector3( 0, 0, 0 );
  physicsShape.calculateLocalInertia( mass, localInertia );

  const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
  const body = new Ammo.btRigidBody( rbInfo );

  body.setFriction(4);
  body.setRollingFriction(10);

  threeObject.userData.physicsBody = body;

  scene.add( threeObject );

  if ( mass > 0 ) {
    rigidBodies.push( threeObject );

    // Disable deactivation
    body.setActivationState( 4 );
  }

  physicsWorld.addRigidBody( body );
}

function moveKinematicHand(ball){
  ball.getWorldPosition(tmpPos);
  ball.getWorldQuaternion(tmpQuat);

  let physicsBody = ball.userData.physicsBody;

  let ms = physicsBody.getMotionState();
  if ( ms ) {
      ammoTmpPos.setValue(tmpPos.x, tmpPos.y, tmpPos.z);
      ammoTmpQuat.setValue( tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w);

      tmpTrans.setIdentity();
      tmpTrans.setOrigin( ammoTmpPos );
      tmpTrans.setRotation( ammoTmpQuat );

      ms.setWorldTransform(tmpTrans);
  }
}

function isEmpty(obj){
  return !Object.keys(obj).length;
}

function updatePhysics( deltaTime ){

  // update hinge by keyboard input
  hinge.enableAngularMotor( true, 0.8 * armMovement, 50 );

  // Advance the world computation in the physics engine
  physicsWorld.stepSimulation( deltaTime, 10 );

  // Update cloth
  const softBody = cloth.userData.physicsBody;
  const clothPositions = cloth.geometry.attributes.position.array;
  const numVerts = clothPositions.length / 3;
  const nodes = softBody.get_m_nodes();
  let indexFloat = 0;

  for ( let i = 0; i < numVerts; i ++ ) {

    const node = nodes.at( i );
    const nodePos = node.get_m_x();
    clothPositions[ indexFloat ++ ] = nodePos.x();
    clothPositions[ indexFloat ++ ] = nodePos.y();
    clothPositions[ indexFloat ++ ] = nodePos.z();

  }

  cloth.geometry.computeVertexNormals();
  cloth.geometry.attributes.position.needsUpdate = true;
  cloth.geometry.attributes.normal.needsUpdate = true;

  // Update rigid body status
  for ( let i = 0; i < rigidBodies.length; i++ ) {
      let objThree = rigidBodies[ i ];
      let objAmmo = objThree.userData.physicsBody;
      let ms = objAmmo.getMotionState();
      if ( ms ) {

          ms.getWorldTransform( tmpTrans );
          let p = tmpTrans.getOrigin();
          let q = tmpTrans.getRotation();
          objThree.position.set( p.x(), p.y(), p.z() );
          objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );

      }
  }

}

// webrtc
(async () => {
  const buttonArea = document.getElementById('button-area');
  const joinButton = document.getElementById('join');
  const channelNameInput = document.getElementById('channel-name');
  const remoteMediaArea = document.getElementById('remote-media-area');

  joinButton.onclick = async () => {
    if (channelNameInput.value === '') return;
    joinButton.disabled = true;

    const context = await SkyWayContext.Create(token);
    const room = await SkyWayRoom.FindOrCreate(context, {
      type: 'p2p',
      name: channelNameInput.value,
    });
    const me = await room.join();

    const subscribeAndAttach = (publication) => {
      // if (publication.publisher.id === me.id) return;

      let subscribeButton;
      if (publication.contentType === 'video') {
        subscribeButton = document.createElement('button');
        subscribeButton.textContent = `${publication.publisher.id}`;
        buttonArea.appendChild(subscribeButton);
      } else {
        return;
      }

      subscribeButton.onclick = async () => {
        const { stream } = await me.subscribe(publication.id);

        let newMedia;
        console.log('creating new billboard...');

        newMedia = document.createElement('video');
        newMedia.playsInline = true;
        newMedia.autoplay = true;
        newMedia.width = 100;
        newMedia.height = 100;

        // stream is `RemoteVideoStream` class
        // newMedia.srcObject = stream; // NG
        stream.attach(newMedia);
        remoteMediaArea.appendChild(newMedia);
        // const geometry = new THREE.PlaneGeometry(0.3, 0.3);
        const geometry = new THREE.PlaneGeometry(1.0, 1.0);
        const texture = new THREE.VideoTexture(newMedia);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        scene.add(mesh);

        const mass = 1;

        // load PLY
        let plyMesh = await getPlyMesh();
        // let colShape = new Ammo.btBoxShape( new Ammo.btVector3( 0.12, 0.12, 0.12 ) );
        let colShape = new Ammo.btBoxShape( new Ammo.btVector3( 0.24, 0.24, 0.24 ) );

        createRigidBody( plyMesh, colShape, mass, plyMesh.position, plyMesh.quaternion );

        // publish billboard's pose
        const room2 = await SkyWayRoom.FindOrCreate(context, {
          type: 'p2p',
          name: publication.publisher.id,
        });
        const me2 = await room2.join();
        const stream2 = await SkyWayStreamFactory.createDataStream();
        await me2.publish(stream2);

        meshStreamMap.set(publication.publisher.id, {
            mesh: mesh,
            plyMesh: plyMesh,
            room: room2,
            stream: stream2,
            pos: new THREE.Vector3().copy(camera.position).sub(mesh.position),
            posVel: new THREE.Vector3()
        });

        // alpha
        (async () => {
          const room3 = await SkyWayRoom.FindOrCreate(context, {
            type: 'p2p',
            name: publication.publisher.id + '_alpha',
          });
          const me3 = await room3.join();

          const subscribeAndAttach3 = (publication3) => {
            // if (publication3.publisher.id === me3.id) return;

            let subscribeButton3;
            if (publication3.contentType === 'video') {
              subscribeButton3 = document.createElement('button');
              subscribeButton3.textContent = `${publication3.publisher.id}`;
              // buttonArea.appendChild(subscribeButton3);
            } else {
              return;
            }

            subscribeButton3.onclick = async () => {
              const { stream } = await me3.subscribe(publication3.id);

              let newMedia;
              console.log('updating billboard...');

              newMedia = document.createElement('video');
              newMedia.playsInline = true;
              newMedia.autoplay = true;
              newMedia.width = 100;
              newMedia.height = 100;

              // stream is `RemoteVideoStream` class
              // newMedia.srcObject = stream; // NG
              stream.attach(newMedia);
              remoteMediaArea.appendChild(newMedia);

              // meshStreamMap
              const texture = new THREE.VideoTexture(newMedia);
              const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
              let item = meshStreamMap.get(publication.publisher.id);
              let mesh = item.mesh;
              mesh.material.dispose();
              mesh.material = new THREE.ShaderMaterial({
                uniforms: {
                  baseTexture: { value: mesh.material.map },
                  alphaTexture: { value: texture }
                },
                vertexShader: alphaShader.vertexShader,
                fragmentShader: alphaShader.fragmentShader,
                transparent: true
              });
            };
            subscribeButton3.click();
          };
          room3.publications.forEach(subscribeAndAttach3);
          room3.onStreamPublished.add((e) => subscribeAndAttach3(e.publication));
        })();  // alpha

      };
      subscribeButton.click();
    };
    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
  };
  const params = new URL(window.location.href).searchParams;
  const channelName = params.get('channel');
  if (channelName) {
      document.getElementById('channel-name').value = channelName;
      // document.getElementById('join').click();
  }
})();

renderer.setAnimationLoop(animate);

let landmarkList = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip'
]

let landmarkBallList = new Map();

function createLandmarkBall(landmark, hand) {
  // Create a sphere mesh for each landmark
  let radius = 0.005;
  let mass = 1;

  let ball = new THREE.Mesh(new THREE.SphereBufferGeometry(radius), new THREE.MeshBasicMaterial({color: 0x00ff00}));
  if (hand === 'left') {
    ball.position.set(leftHand.joints[landmark].position.x, leftHand.joints[landmark].position.y, leftHand.joints[landmark].position.z);
  } else {
    ball.position.set(rightHand.joints[landmark].position.x, rightHand.joints[landmark].position.y, rightHand.joints[landmark].position.z);
  }
  

  ball.castShadow = true;
  ball.receiveShadow = true;

  scene.add(ball);

  let transform = new Ammo.btTransform();

  transform.setIdentity();

  if (hand === 'left') {
    transform.setOrigin( new Ammo.btVector3( leftHand.joints[landmark].position.x, leftHand.joints[landmark].position.y, leftHand.joints[landmark].position.z ) );
    transform.setRotation( new Ammo.btQuaternion( leftHand.joints[landmark].quaternion.x, leftHand.joints[landmark].quaternion.y, leftHand.joints[landmark].quaternion.z, leftHand.joints[landmark].quaternion.w ) );
  } else {
    transform.setOrigin( new Ammo.btVector3( rightHand.joints[landmark].position.x, rightHand.joints[landmark].position.y, rightHand.joints[landmark].position.z ) );
    transform.setRotation( new Ammo.btQuaternion( rightHand.joints[landmark].quaternion.x, rightHand.joints[landmark].quaternion.y, rightHand.joints[landmark].quaternion.z, rightHand.joints[landmark].quaternion.w ) );
  }
  let motionState = new Ammo.btDefaultMotionState( transform );

  let colShape = new Ammo.btSphereShape( radius );
  colShape.setMargin( 0.05 );

  let localInertia = new Ammo.btVector3( 0, 0, 0 );
  colShape.calculateLocalInertia( mass, localInertia );

  let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
  let body = new Ammo.btRigidBody( rbInfo );

  body.setFriction(4);
  body.setRollingFriction(10);

  body.setActivationState( STATE.DISABLE_DEACTIVATION );
  body.setCollisionFlags( FLAGS.CF_KINEMATIC_OBJECT );

  physicsWorld.addRigidBody( body );
  ball.userData.physicsBody = body;

  let landmarkBallObj = landmarkBallList.get(landmark) || {};
  if (hand === 'left') {
    landmarkBallObj.left = ball;
  } else {
    landmarkBallObj.right = ball;
  }
  landmarkBallList.set(landmark, landmarkBallObj);
}

function animate() {
  for (let [id, item] of meshStreamMap) {

    let mesh = item.mesh;
    let plyMesh = item.plyMesh;
    let stream = item.stream;
    mesh.lookAt(camera.position);
    mesh.updateMatrixWorld(true);

    // Copy billboard position to ply mesh
    mesh.position.copy(plyMesh.position);


    let position = new THREE.Vector3().copy(camera.position).sub(mesh.position);
    let matrix2 = new THREE.Matrix4().copy(mesh.matrixWorld).setPosition(position);
    stream.write(matrix2.toArray().toString());
  }

  let deltaTime = clock.getDelta();

  // update landmark balls
  if (isHandShown.left === true) {
    for (let [id, balls] of landmarkBallList) {
      moveKinematicHand(balls.left);
      moveKinematicHand(balls.right);
    }
  }

  // When a hand is displayed
  if (!isEmpty(leftHand.joints) & !isEmpty(rightHand.joints)) {
    if (isHandShown.left === false && isHandShown.right === false) {
      // When a hand is displayed for the first time
      for (let i = 0; i < landmarkList.length; i++) {
        createLandmarkBall(landmarkList[i], 'left');
        createLandmarkBall(landmarkList[i], 'right');
      }
    } else {
      for (let [id, balls] of landmarkBallList) {
        balls.left.position.copy(leftHand.joints[id].position);
        balls.right.position.copy(rightHand.joints[id].position);
      }
    }

    // toggle flag to true
    isHandShown.left = true;
    isHandShown.right = true;
  }

  // Perform physical operations and screen rendering
  updatePhysics( deltaTime );

  renderer.render( scene, camera );
}
