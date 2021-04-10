const canv = document.querySelector("canvas");
rescaleCanvas(canv);
window.addEventListener("resize", () => rescaleCanvas(canv));
const gl = canv.getContext("webgl", {
    antialias: true,
});
gl.enable(gl.DEPTH_TEST);
//gl.disable(gl.DITHER);

const PARAMS = {
    inChunkReps: 20,
    chunkReps: 4,
};

function makeScene1() {
    const reps = PARAMS.inChunkReps;
    const positionArray = [];
    const colorArray = [];
    function pushSquare(x, y, s) {
        positionArray.push(...[
            x, 0, y,
            x+1, 0, y,
            x, 0, y+1,
            x, 0, y+1,
            x+1, 0, y,
            x+1, 0, y+1,
        ]);
        colorArray.push(...Array(18).fill(s));
    }
    for (let x = 0; x < reps; x++) {
        for (let y = 0; y < reps; y++) {
            var shade = Math.abs(x + y) % 2;
            pushSquare(x, y, shade);
        }
    }
    return [new Float32Array(positionArray), new Float32Array(colorArray)];
}

function makeScene2() {
    var positionArray = [
        0, 0,
        1, 1,
        1, 0,
    ];
    var colorArray = [
        1, 1, 1,
        0, 1, 0,
        1, 0, 0,
    ];
    return [new Float32Array(positionArray), new Float32Array(colorArray)];
}

const program = createProgramFromSources(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);
{
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();

    const [positionArray, colorArray] = makeScene1();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorArray, gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorAttributeLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);
}

const transformUniformLocation = gl.getUniformLocation(program, "u_transform");
const offsetUniformLocation = gl.getUniformLocation(program, "u_offset");

function draw() {
    const { thetaX, thetaY, playerX, playerY, playerZ } = gameState;

    // viewing transformation matrix
    var transformMatrix = new THREE.Matrix4()
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
            0, 0, 1, 0,
            0, 0, 1, 0,
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

    gl.uniformMatrix4fv(transformUniformLocation, false, transformMatrix.toArray());

    gl.viewport(0, 0, canv.width, canv.height);
    gl.clearColor(0, 0, 0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    function drawChunk(x, y) {
        gl.uniform4f(offsetUniformLocation, x, y, 0, 0,);
        gl.drawArrays(gl.TRIANGLES, 0, 6 * PARAMS.inChunkReps**2);
    }
    const reps = PARAMS.chunkReps;
    for (let x = -reps; x < reps; x++) {
        for (let y = -reps; y < reps; y++) {
            drawChunk(PARAMS.inChunkReps*x, PARAMS.inChunkReps*y);
        }
    }
}

const gameState = {
    playerX: 30,
    playerY: 1,
    playerZ: 30,
    thetaX: 0.0,
    thetaY: 0.0,
    velocity: 20.0,
    menu: false,
};

const keyInputState = watchKeys(
    [" ", "shift", "w", "a", "s", "d"],
    {
        "escape": function() {
            gameState.menu != gameState.menu;
        }
    }
);
const mouseInputState = watchAndHideMouse();

const mouseSensitivity = 1.5 / 1000;
function update(delta) {
    // update camera direction
    gameState.thetaY = mouseSensitivity * Math.PI * mouseInputState.x;
    var thetaX = mouseSensitivity * Math.PI * mouseInputState.y;
    if (Math.abs(thetaX) > Math.PI/2) {
        thetaX = Math.sign(thetaX) * Math.PI/2;
    }
    gameState.thetaX = thetaX;

    // update player position
    const { thetaY, velocity } = gameState;

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
    gameState.playerX += direction.x;
    gameState.playerY += direction.y;
    gameState.playerZ += direction.z;
}

const dashslots = (function () {
    const dashboard = document.querySelector("#dashboard");
    const [p1, p2] = dashboard.querySelectorAll("p");
    return [p1, p2];
})();
function outFps(fps) {
    dashslots[0].innerText = `FPS: ${fps.toFixed(0)}`;
}

const cancelFrames = runGameLoop(update, draw, outFps);
