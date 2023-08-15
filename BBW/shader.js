// normal
// export const alphaShader = {
//     vertexShader: `
//       varying vec2 vUv;

//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform sampler2D baseTexture;
//       uniform sampler2D alphaTexture;

//       varying vec2 vUv;

//       void main() {
//         vec4 baseColor = texture2D(baseTexture, vUv);
//         float alpha = texture2D(alphaTexture, vUv).r;
//         gl_FragColor = vec4(baseColor.rgb, alpha);
//       }
//     `
// };

// frame
export const alphaShader = {
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D alphaTexture;

      varying vec2 vUv;

      void main() {
        vec4 baseColor = texture2D(baseTexture, vUv);
        float alpha = texture2D(alphaTexture, vUv).r;
        vec3 color = baseColor.rgb;
        float edgeWidth = 0.01;
        if (((vUv.y < edgeWidth || vUv.y > 1.-edgeWidth) && mod(floor(vUv.x*100.), 10.0) > 2.0) || ((vUv.x < edgeWidth || vUv.x > 1.-edgeWidth) && mod(trunc(vUv.y*100.), 10.0) > 2.0)) {
          color = vec3(0.67);
          alpha = 0.8;
        }
        alpha = clamp(alpha + 0.67, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `
};

// green
// export const alphaShader = {
//     vertexShader: `
//       varying vec2 vUv;

//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform sampler2D baseTexture;
//       uniform sampler2D alphaTexture;

//       varying vec2 vUv;

//       void main() {
//         vec4 baseColor = texture2D(baseTexture, vUv);
//         float alpha = texture2D(alphaTexture, vUv).r;
//         vec3 color = baseColor.rgb;
//         float edgeWidth = 0.01;
//         if ((1.-vUv.y) + vUv.x > 1.0) {
//           color = mix(vec3(0.0, 1.0, 0.0), color, alpha);
//           alpha = clamp(alpha + 0.5, 0.0, 1.0);
//         }
//         gl_FragColor = vec4(color, alpha);
//       }
//     `
// };