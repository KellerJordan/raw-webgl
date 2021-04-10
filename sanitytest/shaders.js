const vertexShaderSource = `
varying vec3 v_color;

attribute vec4 a_position;
attribute vec3 a_color;

void main() {
    v_color = a_color;
    gl_Position = a_position;
}
`;

const fragmentShaderSource = `
precision mediump float;

varying vec3 v_color;

void main() {
    gl_FragColor = vec4(v_color, 1);
}
`;

