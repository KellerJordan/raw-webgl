const canv = document.querySelector("canvas");
rescaleCanvas(canv);
window.addEventListener("resize", () => rescaleCanvas(canv));
const gl = canv.getContext("webgl", {
    antialias: true,
});
if (!gl) {
    alert("no GL");
}
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
const ext = gl.getExtension("ANGLE_instanced_arrays");
if (!ext) {
    alert("no extension");
}

// My GPU can render 800,000 of these cubes at 60FPS.
const PARAMS = {
    numInstances: 200000,
    instancing: true,
    lighting: true,
    gputransform: true,
};
if (!PARAMS.instancing && PARAMS.gputransform) {
    alert("gputransform not allowed without instancing");
}

// stack of chunk parameters
const chunkStack = [];
(function fillStack() {
    const { numInstances } = PARAMS;
    const MAX_SCALE = ((150**3 / 20) / numInstances)**(1/3);
    const r = (l, u) => Math.random() * (u - l) + l;
    for (let i = 0; i < numInstances; i++) {
        chunkStack.push([
            r(-75, 75), // x offset
            r(-75, 75), // y offset
            r(25, 175), // z offset
            r(0.1, MAX_SCALE), // scale
            r(0.25, 4), // rotation speed
            r(0, 1), // roy
            r(0, 1), // gee
            r(0, 1), // biv
        ]);
    }
})();
// single-chunk mesh
const [positionArray, normalArray] = makeCube();
// arrays for instancing -- we don't yet load the transformMatrices because these change with game state.
const transformMatrixArray = new Float32Array(9*PARAMS.numInstances);
const offsetArray = new Float32Array(3*PARAMS.numInstances);
const colorArray = new Float32Array(3*PARAMS.numInstances);
const transformMatrices = [];
if (PARAMS.instancing) {
    const offsets = [];
    const colors = [];
    for (let i = 0; i < PARAMS.numInstances; i++) {
        transformMatrices.push(new Float32Array(transformMatrixArray.buffer, i*9*4, 9));
        offsets.push(new Float32Array(offsetArray.buffer, i*3*4, 3));
        colors.push(new Float32Array(colorArray.buffer, i*3*4, 3));
    }
    chunkStack.forEach(([x, y, z, s, rs, r, g, b], i) => {
        offsets[i].set([x, y, z]);
        colors[i].set([r, g, b]);
    });
}

// load all constant data into buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);
const normalBuffer = gl.createBuffer();
if (PARAMS.lighting) {
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normalArray, gl.STATIC_DRAW);
}
// buffers for instancing
// these will be unused if we don't use instancing
const offsetBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();
// below used for no gpu transform
const transformMatrixBuffer = gl.createBuffer();
// below used for gpu transform
const rotSpeedBuffer = gl.createBuffer();
const scaleBuffer = gl.createBuffer();
if (PARAMS.instancing) {
    if (PARAMS.gputransform) {
        gl.bindBuffer(gl.ARRAY_BUFFER, rotSpeedBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(chunkStack.map(p => p[4])), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(chunkStack.map(p => p[3])), gl.STATIC_DRAW);
    } else {
        // the transform matrix buffer will be frequently changed.
        gl.bindBuffer(gl.ARRAY_BUFFER, transformMatrixBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, transformMatrixArray.byteLength, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, offsetArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorArray, gl.STATIC_DRAW);
}

// create program and get attribute/uniform locations
const shaderPrefix = Object.keys(PARAMS).filter(p => PARAMS[p] == true).map(p => `#define ${p.toUpperCase()};`).join("\n");
const program = createProgramFromSources(gl, shaderPrefix+vertexShaderSource, shaderPrefix+fragmentShaderSource);
// geometry attributes
const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
if (positionAttributeLocation == -1) {
    alert("failed position attribute lookup");
}
const normalAttributeLocation = gl.getAttribLocation(program, "a_normal");
if (PARAMS.lighting && normalAttributeLocation == -1) {
    alert("failed a geometry attribute lookup");
}
// second-level attributes
// below are non-null if using instancing
const offsetAttributeLocation = getAttribLoc(gl, program, "a_offset");
const colorAttributeLocation = getAttribLoc(gl, program, "a_color");
// if computing transform matrices on CPU
const transformMatrixAttributeLocation = getAttribLoc(gl, program, "a_transformMatrix");
// if on GPU
const thetaUniformLocation = getUniformLoc(gl, program, "u_theta");
const rotSpeedAttributeLocation = getAttribLoc(gl, program, "a_rotSpeed");
const scaleAttributeLocation = getAttribLoc(gl, program, "a_scale");
// below for non-instancing
const offsetUniformLocation = getUniformLoc(gl, program, "u_offset");
const colorUniformLocation = getUniformLoc(gl, program, "u_color");
const transformMatrixUniformLocation = getUniformLoc(gl, program, "u_transformMatrix");
// uniforms
const viewMatrixUniformLocation = getUniformLoc(gl, program, "u_viewMatrix");
const lightReverseDirectionUniformLocation = getUniformLoc(gl, program, "u_lightReverseDirection");

// track gameState and draw depending =========================================
const playerState = {
    fov: 0.6 * Math.PI,
    playerX: 0.0,
    playerY: 0.0,
    playerZ: -5.0,
    thetaX: 0,
    thetaY: 0,
    velocity: 20.0,
    menu: false,
};

const worldState = {
    thetaR: 0.0,
};

function render() {
    const { fov, thetaX, thetaY, playerX, playerY, playerZ } = playerState;
    const { thetaR } = worldState;

    function paramsToTransformMatrix(s, rs) {
        return new THREE.Matrix3()
            .multiplyScalar(s)
            .multiply(new THREE.Matrix3().set(
                Math.cos(rs * thetaR), 0, -Math.sin(rs * thetaR),
                0, 1, 0,
                Math.sin(rs * thetaR), 0, Math.cos(rs * thetaR),
            )).toArray();
    }

    // if we are using instancing with no gpu transform, then we need to update the transform matrix data
    if (PARAMS.instancing && !PARAMS.gputransform) {
        chunkStack.forEach((params, i) => {
            // slow version
            //transformMatrices[i].set(paramsToTransformMatrix(params[3], params[4]));
            // fast version
            const t = params[4] * thetaR;
            const co = params[3] * Math.cos(t);
            const si = params[3] * Math.sin(t);
            transformMatrices[i].set([
                co, 0, si,
                0, 1, 0,
                -si, 0, co,
            ]);
        });
    }

    gl.useProgram(program);
    gl.viewport(0, 0, canv.width, canv.height);

    // send mesh data
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    if (PARAMS.instancing) {
        gl.enableVertexAttribArray(offsetAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
        gl.vertexAttribPointer(offsetAttributeLocation, 3, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(offsetAttributeLocation, 1);
        gl.enableVertexAttribArray(colorAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(colorAttributeLocation, 1);
        if (PARAMS.gputransform) {
            gl.enableVertexAttribArray(rotSpeedAttributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, rotSpeedBuffer);
            gl.vertexAttribPointer(rotSpeedAttributeLocation, 1, gl.FLOAT, false, 0, 0);
            ext.vertexAttribDivisorANGLE(rotSpeedAttributeLocation, 1);
            gl.enableVertexAttribArray(scaleAttributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
            gl.vertexAttribPointer(scaleAttributeLocation, 1, gl.FLOAT, false, 0, 0);
            ext.vertexAttribDivisorANGLE(scaleAttributeLocation, 1);
            gl.uniform1f(thetaUniformLocation, thetaR);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, transformMatrixBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, transformMatrixArray);
            for (let i = 0; i < 3; i++) {
                const loc = transformMatrixAttributeLocation + i;
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 4*9, i*3*4);
                ext.vertexAttribDivisorANGLE(loc, 1);
            }
        }
    }

    // update uniforms
    const viewMatrix = new THREE.Matrix4()
        // 5. screen aspect ratio 
        .multiply(new THREE.Matrix4().set(
            Math.min(1.0, canv.height / canv.width), 0, 0, 0,
            0, Math.min(1.0, canv.width / canv.height), 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ))
        // 4. 3D-projection
        .multiply(new THREE.Matrix4().set(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 0, -0.1,
            0, 0, Math.tan(fov/2), 0,
        ))
        // 3. YZ-plane rotation
        .multiply(new THREE.Matrix4().set(
            1, 0, 0, 0,
            0, Math.cos(thetaX), -Math.sin(thetaX), 0,
            0, Math.sin(thetaX), Math.cos(thetaX), 0,
            0, 0, 0, 1,
        ))
        // 2. XZ-plane rotation
        .multiply(new THREE.Matrix4().set(
            Math.cos(thetaY), 0, -Math.sin(thetaY), 0,
            0, 1, 0, 0,
            Math.sin(thetaY), 0, Math.cos(thetaY), 0,
            0, 0, 0, 1,
        ))
        // 1. player position offset
        .multiply(new THREE.Matrix4().set(
            1, 0, 0, -playerX,
            0, 1, 0, -playerY,
            0, 0, 1, -playerZ,
            0, 0, 0, 1,
        ));
    gl.uniformMatrix4fv(viewMatrixUniformLocation, false, viewMatrix.toArray());

    if (PARAMS.lighting) {
        const light = new THREE.Vector3(0.0, 0.8, -1).normalize().toArray();
        gl.uniform3fv(lightReverseDirectionUniformLocation, light);
    }

    // draw!
    gl.clearColor(0.0, 0.8, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (PARAMS.instancing) {
        ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 36, PARAMS.numInstances);
    } else {
        chunkStack.forEach(params => {
            const [x, y, z, s, rs, r, g, b] = params;
            gl.uniform3fv(offsetUniformLocation, [x, y, z]);
            gl.uniform3fv(colorUniformLocation, [r, g, b]);
            gl.uniformMatrix3fv(transformMatrixUniformLocation, false, paramsToTransformMatrix(s, rs));
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        });
    }
}

// track user input ===========================================================
const menuElem = document.querySelector("#menu");
function tryGetPointerLock() {
    if (document.pointerLockElement != canv) {
        canv.requestPointerLock();
    }
}
canv.addEventListener("click", tryGetPointerLock);
menuElem.querySelector("#backToGame").addEventListener("click", tryGetPointerLock);
document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement != canv) {
        playerState.menu = true;
        menuElem.style.display = "block";
    } else {
        playerState.menu = false;
        menuElem.style.display = "none";
    }
});
menuElem.querySelector("#setFOV").addEventListener("click", () => {
    const fovDegrees = prompt("set FOV (in degrees):", 90);
    playerState.fov = Math.PI/180 * fovDegrees;
});

const mouseSettings = { sensitivity: 1.5/1000 };
// maxAbsY the highest mouse position s.t. looking straight up or down
const mouseInputState = watchAndHideMouse(0.5/mouseSettings.sensitivity);
const keyInputState = watchKeys([" ", "shift", "w", "a", "s", "d"]);

// respond to user input ======================================================
function update(delta) {
    // update spinning objects
    worldState.thetaR += 0.2 * (delta/1000) * (2 * Math.PI);

    // do not update player state if in menu
    if (playerState.menu) {
        return;
    }
    // update camera direction
    playerState.thetaY = mouseSettings.sensitivity * Math.PI * mouseInputState.x;
    playerState.thetaX = mouseSettings.sensitivity * Math.PI * mouseInputState.y;

    // update player position
    const { thetaY, velocity } = playerState;

    const forward = new THREE.Vector3(Math.sin(thetaY), 0, Math.cos(thetaY));
    const sideways = new THREE.Vector3(Math.cos(thetaY), 0, -Math.sin(thetaY));
    const upwards = new THREE.Vector3(0, 1, 0);

    const direction = new THREE.Vector3(0, 0, 0);

    if (keyInputState["w"]) {
        direction.add(forward);
    }
    if (keyInputState["a"]) {
        direction.sub(sideways);
    }
    if (keyInputState["s"]) {
        direction.sub(forward);
    }
    if (keyInputState["d"]) {
        direction.add(sideways);
    }
    if (Math.abs(direction.x) + Math.abs(direction.y) + Math.abs(direction.z) > 0.1) {
        direction.normalize();
    } else {
        direction.set(0, 0, 0);
    }

    if (keyInputState[" "]) {
        direction.add(upwards);
    }
    if (keyInputState["shift"]) {
        direction.sub(upwards);
    }

    direction.multiplyScalar((delta / 1000) * velocity);
    playerState.playerX += direction.x;
    playerState.playerY += direction.y;
    playerState.playerZ += direction.z;
}

const dashslots = (function () {
    const dashboard = document.querySelector("#dashboard");
    const [p1, p2] = dashboard.querySelectorAll("p");
    return [p1, p2];
})();
function outFps(fps) {
    dashslots[0].innerText = `FPS: ${fps.toFixed(0)}`;
}

// initiate game loop
const cancelLoop = runGameLoop(update, render, outFps);
