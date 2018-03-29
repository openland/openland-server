const WORLD_RADIUS = 6378137;

function rad(src: number) {
    return src * Math.PI / 180;
}

function unprojectFromCartesian(x: number, y: number, z: number) {
    let latitude = Math.asin(z / WORLD_RADIUS) * 180 / Math.PI;
    let longitude;
    if (x > 0) {
        longitude = Math.atan(y / x) * 180 / Math.PI;
    } else if (y > 0) {
        longitude = Math.atan(y / x) * 180 / Math.PI + 180;
    } else {
        longitude = Math.atan(y / x) * 180 / Math.PI - 180;
    }
    return { latitude, longitude };
}

function projectToCartesian(latitude: number, longitude: number) {
    let x = WORLD_RADIUS * Math.cos(rad(latitude)) * Math.cos(rad(longitude));
    let y = WORLD_RADIUS * Math.cos(rad(latitude)) * Math.sin(rad(longitude));
    let z = WORLD_RADIUS * Math.sin(rad(latitude));
    return { x, y, z };
}

function rotateY(src: { x: number, y: number, z: number }, angleSin: number, angleCos: number) {
    // https://en.wikipedia.org/wiki/Rotation_matrix#Basic_rotations
    let rotatedX = angleCos * src.x + 0 * src.y + angleSin * src.z;
    let rotatedY = 0 * src.x + 1 * src.y + 0 * src.z;
    let rotatedZ = -angleSin * src.x + 0 * src.y + angleCos * src.z;
    return { x: rotatedX, y: rotatedY, z: rotatedZ };
}

function rotateZ(src: { x: number, y: number, z: number }, angleSin: number, angleCos: number) {
    // https://en.wikipedia.org/wiki/Rotation_matrix#Basic_rotations
    let rotatedX = angleCos * src.x - angleSin * src.y + 0 * src.z;
    let rotatedY = angleSin * src.x + angleCos * src.y + 0 * src.z;
    let rotatedZ = 0 * src.x + 0 * src.y + 1 * src.z;
    return { x: rotatedX, y: rotatedY, z: rotatedZ };
}

function rotate2D(src: { x: number, y: number }, angle: number) {
    let length = Math.sqrt(src.x * src.x + src.y * src.y);
    let resAngle = Math.atan2(src.x, src.y) + angle;
    return { x: Math.sin(resAngle) * length, y: Math.cos(resAngle) * length };
}

export function createRectangle(latitude: number, longitude: number, angle: number, width: number, height: number) {

    let points = [];
    points.push({ x: -width / 2, y: height / 2 });
    points.push({ x: width / 2, y: height / 2 });
    points.push({ x: width / 2, y: -height / 2 });
    points.push({ x: -width / 2, y: -height / 2 });

    let center = projectToCartesian(latitude, longitude);
    let cosNLon = Math.cos(rad(longitude));
    let sinNLon = Math.sin(rad(longitude));
    let cosNLat = Math.cos(rad(-latitude));
    let sinNLat = Math.sin(rad(-latitude));

    let translated = [];
    for (let p of points) {

        // Rotate points
        let rotatePoint = rotate2D(p, angle);

        // Rotate plane
        let transformed = { x: 0, y: rotatePoint.x, z: rotatePoint.y };
        transformed = rotateY(transformed, sinNLat, cosNLat);
        transformed = rotateZ(transformed, sinNLon, cosNLon);
        
        // Tranform
        transformed.x = transformed.x + center.x;
        transformed.y = transformed.y + center.y;
        transformed.z = transformed.z + center.z;
        // Normalize
        let l = Math.sqrt(transformed.x * transformed.x + transformed.y * transformed.y + transformed.z * transformed.z);
        transformed.x = WORLD_RADIUS * (transformed.x / l);
        transformed.y = WORLD_RADIUS * (transformed.y / l);
        transformed.z = WORLD_RADIUS * (transformed.z / l);
        // Unproject
        let unprojected = unprojectFromCartesian(transformed.x, transformed.y, transformed.z);
        translated.push([unprojected.longitude, unprojected.latitude]);
    }

    return [[[...translated, translated[0]]]];
}