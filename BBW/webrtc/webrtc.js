// https://github.com/skyway/js-sdk/blob/main/examples/core/src/main.js
const {
  SkyWayChannel,
  SkyWayContext,
  SkyWayStreamFactory
} = skyway_core;
import { token } from './token.js';


(async () => {
  const localVideo = document.getElementById('local-video');
  const buttonArea = document.getElementById('button-area');
  const remoteMediaArea = document.getElementById('remote-media-area');
  const channelNameInput = document.getElementById('channel-name');
  const dataStreamInput = document.getElementById('data-stream');
  const myId = document.getElementById('my-id');
  const joinButton = document.getElementById('join');
  const writeButton = document.getElementById('write');

  let audio, video;
  try {
    ({ audio, video } =
      await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream());
    video.attach(localVideo);
    await localVideo.play();
  } catch (error) {
    console.error('Error creating audio/video stream:', error);
  }

  const data = await SkyWayStreamFactory.createDataStream();
  writeButton.onclick = () => {
    data.write(dataStreamInput.value);
    dataStreamInput.value = '';
  };

  joinButton.onclick = async () => {
    if (channelNameInput.value === '') return;

    const context = await SkyWayContext.Create(token);
    const channel = await SkyWayChannel.FindOrCreate(context, {
      name: channelNameInput.value,
    });
    const me = await channel.join();

    myId.textContent = me.id;

    if (audio) {
      await me.publish(audio);
    }
    if (video) {
      await me.publish(video);
    }
    if (data) {
      await me.publish(data);
    }

    const subscribeAndAttach = (publication) => {
      if (publication.publisher.id === me.id) return;

      const subscribeButton = document.createElement('button');
      subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
      buttonArea.appendChild(subscribeButton);

      subscribeButton.onclick = async () => {
        const { stream } = await me.subscribe(publication.id);

        switch (stream.contentType) {
          case 'video':
            {
              const elm = document.createElement('video');
              elm.playsInline = true;
              elm.autoplay = true;
              elm.width = 400;
              stream.attach(elm);
              remoteMediaArea.appendChild(elm);
            }
            break;
          case 'audio':
            {
              const elm = document.createElement('audio');
              elm.controls = true;
              elm.autoplay = true;
              stream.attach(elm);
              remoteMediaArea.appendChild(elm);
            }
            break;
          case 'data':
            {
              const elm = document.createElement('div');
              remoteMediaArea.appendChild(elm);
              elm.innerText = 'data\n';
              stream.onData.add((data) => {
                elm.innerText += data + '\n';
              });
            }
            break;
        }
      };
    };

    channel.publications.forEach(subscribeAndAttach);
    channel.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
  };
})();