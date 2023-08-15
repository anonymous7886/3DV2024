import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
const { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } = skyway_room;
import { token } from './webrtc/token.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
const { WebXRPolyfill } = 'webxr-polyfill';
import { alphaShader } from './shader.js';


// renderer
const renderer = new THREE.WebGLRenderer();
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


let meshStreamMap = new Map();


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
        const geometry = new THREE.PlaneGeometry(1, 1);
        const texture = new THREE.VideoTexture(newMedia);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        dragControls.getObjects().push(mesh);

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


function animate() {
  for (let [id, item] of meshStreamMap) {

    let mesh = item.mesh;
    let stream = item.stream;
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    mesh.position.x = Math.sin(seconds * (Math.PI / 3)) * 2;
    mesh.lookAt(camera.position);
    mesh.updateMatrixWorld(true);

    let position = new THREE.Vector3().copy(camera.position).sub(mesh.position);
    let matrix2 = new THREE.Matrix4().copy(mesh.matrixWorld).setPosition(position);
    stream.write(matrix2.toArray().toString());
  }
  renderer.render( scene, camera );
}

animate();
