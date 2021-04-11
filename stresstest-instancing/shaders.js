const vertexShaderSource = `
varying vec3 v_color;

attribute vec4 a_position;
attribute vec3 a_color;

attribute vec4 a_offset;
uniform mat4 u_transform;

void main() {
    v_color = a_color;
    gl_Position = u_transform * (a_position + a_offset);
}
`;

const fragmentShaderSource = `
precision mediump float;

varying vec3 v_color;

void main() {
    gl_FragColor = vec4(v_color, 1);
}
`;
