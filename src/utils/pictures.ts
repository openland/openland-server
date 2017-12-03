export function resolvePicture(src?: string, height?: number, width?: number) {
    if (src) {
        var url = `https://ucarecdn.com/${src}`;
        if (height && width) {
            url += `-/resize/${width}x${height}/`
        } else if (width) {
            url += `-/resize/${width}x/`
        } else if (height) {
            url += `-/resize/x${height}/`
        }
        return url
    } else {
        return null
    }
}