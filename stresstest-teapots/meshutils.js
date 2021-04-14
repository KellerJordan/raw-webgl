// gets a vector normal to the triangle described by THREE.Vector3's
// assumes culling of clockwise triangles.
function getNormal(v1, v2, v3) {
    const s1 = new THREE.Vector3().add(v1).sub(v2);
    const s2 = new THREE.Vector3().add(v2).sub(v3);
    return new THREE.Vector3().crossVectors(s2, s1);
}

function positionArrayToNormalArray(positionArray) {
    const normalArray = new Float32Array(positionArray.length);
    const numTriangles = positionArray.length/9;
    for (let i = 0; i < numTriangles; i++) {
        const offset = 9*i
        const [x1, y1, z1, x2, y2, z2, x3, y3, z3] = positionArray.slice(offset, offset+9);
        const v1 = new THREE.Vector3(x1, y1, z1);
        const v2 = new THREE.Vector3(x2, y2, z2);
        const v3 = new THREE.Vector3(x3, y3, z3);
        const n = getNormal(v1, v2, v3);
        n.normalize();
        const [xn, yn, zn] = n.toArray();
        normalArray.set([xn, yn, zn, xn, yn, zn, xn, yn, zn], offset);
    }
    return normalArray;
}

// returns positionArray, normalArray, colorArray cooresponding to a cube of sidelength 2 at (x, y, z) and color rgb.
function makeCube() {
    const positionArray = new Float32Array([
        -1, -1, 1,
        1, 1, 1,
        1, -1, 1,
        1, 1, 1,
        -1, -1, 1,
        -1, 1, 1,

        -1, -1, -1,
        1, -1, -1,
        1, 1, -1,
        1, 1, -1,
        -1, 1, -1,
        -1, -1, -1,

        -1, 1, -1,
        1, 1, 1,
        -1, 1, 1,
        1, 1, 1,
        -1, 1, -1,
        1, 1, -1,

        -1, -1, -1,
        -1, -1, 1,
        1, -1, 1,
        1, -1, 1,
        1, -1, -1,
        -1, -1, -1,

        1, -1, -1,
        1, 1, 1,
        1, 1, -1,
        1, 1, 1,
        1, -1, -1,
        1, -1, 1,

        -1, -1, -1,
        -1, 1, -1,
        -1, 1, 1,
        -1, 1, 1,
        -1, -1, 1,
        -1, -1, -1,
    ]);
    const normalArray = positionArrayToNormalArray(positionArray);
    return [positionArray, normalArray];
}

function makePyramid() {
    const y0 = Math.sqrt(3/2);
    const y1 = y0 - Math.sqrt(8/3);
    const z0 = Math.sqrt(4/3);
    const z1 = -z0/2;
    const v1 = new THREE.Vector3(-1, y1, z1);
    const v2 = new THREE.Vector3(1, y1, z1);
    const v3 = new THREE.Vector3(0, y1, z0);
    const v0 = new THREE.Vector3(0, y0, 0);
    const positionArray = new Float32Array([
        v1, v3, v2,
        v1, v2, v0,
        v2, v3, v0,
        v3, v1, v0,
    ].map(v => v.toArray()).flat());
    const normalArray = positionArrayToNormalArray(positionArray);
    return [positionArray, normalArray];
}
