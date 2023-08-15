import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader';
import { LineBasicMaterial, Mesh } from 'three';

// renderer
const renderer = new THREE.WebGLRenderer();
// renderer.outputEncoding = THREE.sRGBEncoding;
// renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setSize(800, 800);
// renderer.setPixelRatio( window.devicePixelRatio );
// console.log( window.devicePixelRatio );
renderer.xr.enabled = true;
document.body.appendChild( renderer.domElement );

// camera
const camera = new THREE.PerspectiveCamera( 30.0, 1, 0.1, 10000.0 );
camera.position.set( 2.0, 1.0, 2.0 );

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
// const gridHelper = new THREE.GridHelper( 10, 1 );
// scene.add( gridHelper );

// const axesHelper = new THREE.AxesHelper( 1 );
// scene.add( axesHelper );

const light = new THREE.DirectionalLight( 0xffffff, 0.75, 100);
light.position.set( 1.0, 1.0, 1.0 ).normalize();
scene.add( light );

var ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
scene.add( ambientLight );

// drag controls
const dragControls = new DragControls([], camera, renderer.domElement);
dragControls.addEventListener('drag', function (event) {
  controls.enabled = false;
});
dragControls.addEventListener('dragend', function (event) {
  controls.enabled = true;
});

// const geometry = new THREE.CircleGeometry(1, 32); 
// const textureLoader = new THREE.TextureLoader();
// const texture = textureLoader.load('texture.png');
// const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5});
// const circle = new THREE.Mesh(geometry, material);
// circle.rotation.x = -Math.PI / 2;
// circle.position.set(0.,0.08,0.)
// circle.scale.set(0.28,0.28,0.28)
// scene.add(circle);

var loader = new OBJLoader();
const material2 = new THREE.MeshNormalMaterial();

loader.load(
//   'models/bowl.obj',
//   function ( object ) {
//     object.traverse( function ( child ) {
//       if ( child instanceof THREE.Mesh ) {
//         console.log('aaa');
//         child.material.color.set( 0x8B4513 );
//         child.rotation.x = -Math.PI / 2;
//         child.position.set(0.,0.866 * 0.3 / 2., 0.);
//         child.material.side = THREE.DoubleSide;
//         child.scale.set(0.3, 0.3, 0.3);

//         // var edges = new THREE.EdgesGeometry( child.geometry );
//         // var line = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0x000000 } ) );
//         // child.add( line );
//       }
//     } );
//     scene.add( object );
    'models/bunny.obj',
    function ( object ) {
      object.traverse( function ( child ) {
        if ( child instanceof Mesh ) {
          child.scale.set(4., 4., 4.);
          child.position.set(0.08,-0.3, 0.);
          child.material = material2;
        }
      });
      scene.add( object );

    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = function () {
      for(let theta = 240, j = 40; theta < 360; theta += 6, j++) {
        for (let phi = 105, i = 0; phi >= 15; phi -= 6, i++) {
          console.log(j, i, theta, phi);
          const radian1 = THREE.MathUtils.degToRad(theta);
          const radian2 = THREE.MathUtils.degToRad(phi);

          const r = 2;
          camera.position.set(
            r * Math.sin(radian2) * Math.cos(radian1), // x
            r * Math.cos(radian2),                     // z
            r * Math.sin(radian2) * Math.sin(radian1), // y
          );

          camera.lookAt(new THREE.Vector3(0, 0, 0));

          renderer.render(scene, camera);

          const canvasDataUrl = renderer.domElement.toDataURL("image/png");
          ws.send(`image-${j}-${i}:${canvasDataUrl}`);
        }
      }
      // ws.close();
    };
  }
);


// requestAnimationFrame(callback)
function animate() {
  renderer.render( scene, camera );
}
renderer.setAnimationLoop(animate);