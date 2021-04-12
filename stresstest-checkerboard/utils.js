function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    success = gl.getShaderParameter(shader, gl.DELETE_STATUS);
    if (!success) {
        console.log("Failed to delete unsuccessfully created shader.");
    }
}

function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    success = gl.getProgramParameter(shader, gl.DELETE_STATUS);
    if (!success) {
        console.log("Failed to delete unsuccessfully created program.");
    }
}

function createProgramFromSources(gl, vertexSource, fragmentSource) {
    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = createProgram(gl, vertexShader, fragmentShader);
    return program;
}

function rescaleCanvas(canv, dpi) {
    if (!dpi) {
        dpi = window.devicePixelRatio;
    }
    var width = window.innerWidth;
    var height = window.innerHeight;
    canv.width = dpi * width;
    canv.height = dpi * height;
    canv.style.width = width + "px";
    canv.style.height = height + "px";
}

// makes an inputState object which maintains boolean press-state of each of holdKeys,
// and fires a function on press of each of pressKeys.
function watchKeys(holdKeys) {
    function cmp(s1, s2) {
        return s1.toLowerCase() == s2.toLowerCase();
    }

    const inputState = {};
    function setAllFalse() {
        for (let key of holdKeys) {
            inputState[key] = false;
        }
    }
    setAllFalse();
    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement == null) {
            setAllFalse();
        }
    });
    window.addEventListener("keydown", e => {
        for (let key of holdKeys) {
            if (cmp(key, e.key)) {
                inputState[key] = true;
            }
        }
        if (holdKeys.includes("shift")) {
            holdKeys["shift"] = e.shiftKey;
        }
    });
    window.addEventListener("keyup", e => {
        for (let key of holdKeys) {
            if (cmp(key, e.key)) {
                inputState[key] = false;
            }
        }
    });
    return inputState;
}

// returns mouse X and Y as delta from center of client
// using up is positive for Y
function watchAndHideMouse(maxAbsY) {
    // track mouse position: use a fixed system if no pointer lock, and infinite with pointer lock.
    const mouseState = { x: 0, y: 0 };
    canv.addEventListener("mousemove", e => {
        if (document.pointerLockElement == canv) {
            mouseState.x += e.movementX;
            mouseState.y -= e.movementY;
        } else {
            mouseState.x = e.clientX - window.innerWidth / 2;
            mouseState.y = window.innerHeight / 2 - e.clientY;
        }
        if (Math.abs(mouseState.y) > maxAbsY) {
            mouseState.y = Math.sign(mouseState.y) * maxAbsY;
        }
    });
    return mouseState;
}

// update takes a time delta and updates the relevant game state according to delta
// draw takes the game state and draws next frame to canvas
// also supplies an FPS-tracker, output each frame to the fpsFunc callback
// returns cancel method
function runGameLoop(update, draw, fpsOut) {
    // supplies the FPS averaged over last few seconds 
    const frameTracker = {
        frameQueue: [],
        pushFrame(currTime) {
            this.frameQueue.push(currTime);
            while (this.frameQueue.length > 0 && this.frameQueue[0] <= currTime - 2000) {
                this.frameQueue.shift();
            }
            return 1000 * this.frameQueue.length / (currTime - this.frameQueue[0]);
        },
    };

    let prevTime = 0;
    let reqId;
    function frame(currTime) {
        reqId = requestAnimationFrame(frame);

        update(currTime - prevTime);

        draw();

        let fps = frameTracker.pushFrame(currTime);
        fpsOut(fps);
        prevTime = currTime;
    }
    redId = requestAnimationFrame(frame);

    function cancelFrames() {
        cancelAnimationFrame(reqId);
    }
    return cancelFrames;
}
