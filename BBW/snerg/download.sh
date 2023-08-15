#!/bin/bash

TARGET="ficus"

mkdir -p scenes/${TARGET}

cd scenes/${TARGET}

wget https://storage.googleapis.com/snerg/750/${TARGET}/scene_params.json
wget https://storage.googleapis.com/snerg/750/${TARGET}/atlas_indices.png

for i in $(seq -f "%03g" 0 50)
do
    wget https://storage.googleapis.com/snerg/750/${TARGET}/feature_${i}.png
    wget https://storage.googleapis.com/snerg/750/${TARGET}/rgba_${i}.png
done

