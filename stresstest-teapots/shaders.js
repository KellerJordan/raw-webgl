const vertexShaderSource = `
attribute vec3 a_position;

#ifdef LIGHTING
attribute vec3 a_normal;
#endif

attribute vec3 a_color;
attribute vec3 a_offset;

#ifdef GPUTRANSFORM
uniform float u_theta;
attribute float a_rotSpeed;
attribute float a_scale;
#endif
#ifndef GPUTRANSFORM
attribute mat3 a_transformMatrix;
#endif
mat3 transformMatrix;


#ifdef LIGHTING
varying vec3 v_normal;
#endif
varying vec3 v_color;

uniform mat4 u_viewMatrix;

vec3 position;

void main() {
    #ifdef GPUTRANSFORM
    transformMatrix = a_scale * mat3(cos(a_rotSpeed*u_theta), 0, -sin(a_rotSpeed*u_theta), 0, 1, 0, sin(a_rotSpeed*u_theta), 0, cos(a_rotSpeed*u_theta));
    #endif
    #ifndef GPUTRANSFORM
    transformMatrix = a_transformMatrix;
    #endif

    #ifdef LIGHTING
    v_normal = transformMatrix * a_normal;
    #endif

    v_color = a_color;
    position = transformMatrix * a_position + a_offset;
    gl_Position = u_viewMatrix * vec4(position, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

varying vec3 v_color;

#ifdef LIGHTING
varying vec3 v_normal;
uniform vec3 u_lightReverseDirection;

float intensity;
#endif

void main() {
    #ifdef LIGHTING
    intensity = dot(normalize(v_normal), u_lightReverseDirection);
    gl_FragColor = vec4(intensity * v_color, 1.0);
    #endif

    #ifndef LIGHTING
    gl_FragColor = vec4(v_color, 1.0);
    #endif
}
`;
