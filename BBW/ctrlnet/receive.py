import asyncio
import websockets
import base64
from PIL import Image
from io import BytesIO
import os

if not os.path.exists('capture'):
    os.mkdir('capture')


async def handler(websocket, path):
    while True:
        data = await websocket.recv()
        number, image_data = data.split(":", 1)
        i = int(number.split("-")[1])
        j = int(number.split("-")[2])

        image_data = image_data.split(",")[1]

        im = Image.open(BytesIO(base64.b64decode(image_data)))
        path = f"capture/output_{i:04}_{j:04}.png"
        print(path)
        im.save(path)

start_server = websockets.serve(handler, "localhost", 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
