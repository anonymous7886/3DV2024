// webrtc
const { SkyWayContext, SkyWayRoom, LocalVideoStream } = skyway_room;
// import { token } from '../webrtc/token.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


const settings = {
    // distance correction factor
    factor: 3.
};

const gui = new GUI();
gui.add(settings, 'factor', 0, 100);


export async function pubStream(token, gCamera, alpha=false) {
  const roomNameInput = document.getElementById('room-name');

  const myId = document.getElementById('my-id');
  const pubButton = document.getElementById('pub');

  pubButton.onclick = async () => {
    if (roomNameInput.value === '') return;

    const context = await SkyWayContext.Create(token);

    // rgb
    const room = await SkyWayRoom.FindOrCreate(context, {
      type: 'p2p',
      name: roomNameInput.value,
    });
    const me = await room.join();
    myId.textContent = me.id;

    let canvas = document.getElementsByTagName("canvas")[0];
    const canvasStream = canvas.captureStream(30);
    const [videoTrack] = canvasStream.getVideoTracks();
    const videoStream = new LocalVideoStream(videoTrack);

    // alpha
    if (alpha) {
      const room2 = await SkyWayRoom.FindOrCreate(context, {
        type: 'p2p',
        name: me.id + '_alpha',
      });
      const me2 = await room2.join();
      // myId.textContent = me2.id;

      let canvas2 = document.getElementsByTagName("canvas")[1];
      const canvasStream2 = canvas2.captureStream(30);
      const [videoTrack2] = canvasStream2.getVideoTracks();
      const videoStream2 = new LocalVideoStream(videoTrack2);

      // publish alpha first
      await me2.publish(videoStream2, {
          codecCapabilities: [{ mimeType: 'video/vp9' }, { mimeType: 'video/vp8' }],
      });
    }
    await me.publish(videoStream, {
        codecCapabilities: [{ mimeType: 'video/vp9' }, { mimeType: 'video/vp8' }],
    });

    subStream(token, gCamera);
  };
}

export async function subStream(token, gCamera) {
  const myId = document.getElementById('my-id');
  const subButton = document.getElementById('sub');

  const context = await SkyWayContext.Create(token);
  const room = await SkyWayRoom.FindOrCreate(context, {
    type: 'p2p',
    name: myId.textContent,
  });
  const me = await room.join();

  const subscribeAndAttach = (publication) => {
    if (publication.publisher.id === me.id) return;
    if (publication.contentType !== 'data') return;

    subButton.disabled = null;
    subButton.onclick = async () => {
      const { stream } = await me.subscribe(publication.id);
      stream.onData.add((data) => {
        let matrixArray = data.split(',').map(Number);
        let matrix = new THREE.Matrix4().fromArray(matrixArray);
        let pCamera = new THREE.Vector3().setFromMatrixPosition(matrix);
        matrix.setPosition(pCamera.multiplyScalar(settings.factor));
        pCamera = new THREE.Vector3().setFromMatrixPosition(matrix);
        let dist = pCamera.length();
        if (gCamera.matrixWorld.equals(matrix)) {
            gCamera.needsUpdate = false;
        } else {
            gCamera.needsUpdate = true;
        }
        gCamera.matrixWorld.copy(matrix);
        gCamera.matrixWorld.decompose(
            gCamera.position,
            gCamera.quaternion,
            gCamera.scale
        )
        gCamera.setFocalLength(50.5 * dist / gCamera.dist);
        gCamera.matrixWorldNeedsUpdate = true;
      });
    };
    subButton.click();
  };

  room.publications.forEach(subscribeAndAttach);
  room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
}
