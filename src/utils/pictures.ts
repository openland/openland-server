import { Context } from "../models/Context";
import { STREET_VIEW_KEY } from "../keys";

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

export function resolveStreetView(context: Context, address: string, height: number, width: number) {
    var location = encodeURIComponent(address + " San Francisco, CA, USA") //40.720032,-73.988354
    if (context.isRetina) {
        height = height * 2
        width = width * 2
    }
    return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${location}&fov=90&key=${STREET_VIEW_KEY}`
}