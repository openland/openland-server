import { Context } from "../models/Context";

export function resolvePicture(context: Context, src?: string, height?: number, width?: number) {
    if (src) {
        var url = `https://ucarecdn.com/${src}/`;
        if (height && width) {
            if (context.isRetina) {
                url += `-/resize/${width * 2}x${height * 2}/`
            } else {
                url += `-/resize/${width * 2}x${height * 2}/`
            }
        } else if (width) {
            if (context.isRetina) {
                url += `-/resize/${width * 2}x/`
            } else {
                url += `-/resize/${width}x/`
            }
        } else if (height) {
            if (context.isRetina) {
                url += `-/resize/x${height * 2}/`
            } else {
                url += `-/resize/x${height}/`
            }
        }
        return url
    } else {
        return null
    }
}