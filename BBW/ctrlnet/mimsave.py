# FFMPEG:  pip install imageio[ffmpeg]
# pyav:  pip install imageio[pyav]

import imageio.v2 as imageio
import os

image_dir = "../../stable-diffusion-webui/outputs/img2img-images/2023-07-23/"

video_filename = "output.webm"

image_filenames = sorted([f for f in os.listdir(image_dir) if f.endswith('.png')])

images = [imageio.imread(os.path.join(image_dir, f)) for f in image_filenames]

imageio.mimsave(video_filename, images, format='WEBM', fps=30, codec='vp9', quality=10, bitrate='8000k')