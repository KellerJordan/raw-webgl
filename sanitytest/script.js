const canv = document.querySelector("canvas");
rescaleCanvas(canv);
const gl = canv.getContext("webgl");
gl.enable(gl.DEPTH_TEST);

const program = createProgramFromSources(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();

var positionArray = [];
var colorArray = [];
// why won't this render if set w >= 0.5?
positionArray.push(...[
    0, 0, 0.5, 1,
    1, 1, 0.5, 1,
    1, 0, 0.5, 1,
]);
const r = Math.random;
colorArray.push(...Array(9).fill(0.0));
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionArray), gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionAttributeLocation);
const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
gl.enableVertexAttribArray(colorAttributeLocation);

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionAttributeLocation, 4, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);

gl.viewport(0, 0, canv.width, canv.height);
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.drawArrays(gl.TRIANGLES, 0, 3);
