# ref
# camera: https://docs.omniverse.nvidia.com/py/isaacsim/source/extensions/omni.isaac.sensor/docs/index.html#module-omni.isaac.sensor.scripts.camera

from omni.isaac.kit import SimulationApp
import omni
import argparse
import carb
import os
import sys

# Set up command line arguments
parser = argparse.ArgumentParser("Usd Load sample")
parser.add_argument("--usd_path", type=str, required=True)
parser.add_argument("--headless", default=False, action="store_true", help="Run stage headless")
parser.add_argument("--test", default=False, action="store_true", help="Run in test mode")
args, unknown = parser.parse_known_args()

size = 512

# This sample loads a usd stage and starts simulation
CONFIG = {"width": 1280, "height": 720, "sync_loads": True, "headless": False, "renderer": "RayTracedLighting"}
CONFIG["headless"] = args.headless
simulation_app = SimulationApp(launch_config=CONFIG)

# ref: isaac_sim-2022.2.1/site/sitecustomize.py
p = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
os.environ["PATH"] += os.pathsep + f"{p}/extscache/omni.flowusd-104.2.4+104.2.wx64.r.cp37/bin"

# ref: https://docs.omniverse.nvidia.com/isaacsim/latest/manual_standalone_python.html
from omni.isaac.core.utils.extensions import enable_extension
import omni.kit
import carb.settings

enable_extension("omni.flowusd")
simulation_app.update()

settings = carb.settings.get_settings()
rttepath = "/rtx/flow/rayTracedTranslucencyEnabled"

from omni.isaac.core.utils.nucleus import get_assets_root_path, is_file

assets_root_path = get_assets_root_path()
if assets_root_path is None:
    carb.log_error("Could not find Isaac Sim assets folder")
    simulation_app.close()
    sys.exit()
# usd_path = assets_root_path + args.usd_path
usd_path = args.usd_path

try:
    result = is_file(usd_path)
except:
    result = False

if result:
    omni.usd.get_context().open_stage(usd_path)
else:
    carb.log_error(
        f"the usd path {usd_path} could not be opened, please make sure that {args.usd_path} is a valid usd file in {assets_root_path}"
    )
    simulation_app.close()
    sys.exit()

# Wait two frames so that stage starts loading
simulation_app.update()
simulation_app.update()

print("Loading stage...")
from omni.isaac.core.utils.stage import is_stage_loading

while is_stage_loading():
    simulation_app.update()
print("Loading Complete")


from omni.isaac.core import World
from omni.isaac.sensor import Camera
from omni.isaac.core.objects import DynamicCuboid, DynamicCapsule, DynamicCone
from omni.isaac.core.objects import DynamicCylinder, DynamicSphere, FixedCuboid
import omni.isaac.core.utils.numpy.rotations as rot_utils
import numpy as np
import io
from PIL import Image

my_world = World(stage_units_in_meters=0.01)

camera = Camera(
    prim_path="/World/camera",
    position=np.array([0.0, 0.0, 500.0]),
    frequency=20,
    resolution=(size, size),
    orientation=rot_utils.euler_angles_to_quats(np.array([-90, 90, 0]), degrees=True),
)
# print(camera.get_focal_length())  # => 5.0
# camera.initialize()

omni.timeline.get_timeline_interface().play()
omni.kit.commands.execute("ChangeSetting", path=rttepath, value=False)


import asyncio
import websockets

t = 0
send_rgb = np.zeros([size,size,4]).astype(np.uint8)
send_alp = np.zeros([size//2,size//2]).astype(np.uint8)

async def echo(websocket):
    async for message in websocket:
        num_list = [float(x) for x in message.split(',')]
        pose = np.array(num_list)
        a, b = 5.0, 200.  # a*b = 1000
        camera.set_world_pose(position=pose[:3] * a, orientation=pose[3:])
        camera.set_focal_length(5.0 * np.linalg.norm(pose[:3]) / b)

        # img = Image.fromarray(send_rgba, 'RGBA')
        byte_arr = io.BytesIO()
        send_rgb.save(byte_arr, format='JPEG')
        rgb = byte_arr.getvalue()

        byte_arr = io.BytesIO()
        send_alp.save(byte_arr, format='JPEG')
        alp = byte_arr.getvalue()

        len_rgb = len(rgb).to_bytes(4, 'big')
        len_alp = len(alp).to_bytes(4, 'big')
        combined = len_rgb + rgb + len_alp + alp

        # await websocket.send(message)
        # await websocket.send(send_rgb.tobytes())
        # await websocket.send(compressed_rgb)
        await websocket.send(combined)

async def main():
    server = await websockets.serve(echo, 'localhost', 8764)
    await server.wait_closed()

asyncio.ensure_future(main())


if True:
    while simulation_app.is_running():
        img = camera.get_rgba()
        # if img.shape == (size,size,4) and t % 100 == 0:
        if img.shape == (size,size,4) and img.dtype == np.uint8:
            alp = np.mean(img[...,:3],axis=2).astype(np.uint8)
            img[...,-1] = alp
            img, mask = img[...,:3], img[...,3:] / 255.
            rgb = (img * mask + np.ones(img.shape)*255 * (1.-mask)).astype(np.uint8)
            send_rgb = Image.fromarray(rgb, 'RGB')
            send_alp = Image.fromarray(alp, 'L').resize((size//2, size//2))
        t += 1
        # Run in realtime mode, we don't specify the step size
        simulation_app.update()

omni.timeline.get_timeline_interface().stop()
simulation_app.close()
