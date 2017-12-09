export const Schema = `
  type Picture {
    url: String!
    retina: String!
  }
`

function resolvePicture(src: string, isRetina: boolean, width?: number, height?: number) {
    var url = `https://ucarecdn.com/${src}/`;
    if (height && width) {
        if (isRetina) {
            return url + `-/resize/${width * 2}x${height * 2}/`
        } else {
            url + `-/resize/${width}x${height}/`
        }
    } else if (width) {
        if (isRetina) {
            url += `-/resize/${width * 2}x/`
        } else {
            url += `-/resize/${width}x/`
        }
    } else if (height) {
        if (isRetina) {
            url += `-/resize/x${height * 2}/`
        } else {
            url += `-/resize/x${height}/`
        }
    }
    return url
}

export const Resolver = {
    Picture: {
        url: function (obj: { id: string, width?: number, height?: number, url?: string }) {
            return obj.url ? obj.url : resolvePicture(obj.id, false, obj.width, obj.height)
        },
        retina: function (obj: { id: string, width?: number, height?: number, retina?: string }) {
            return obj.retina ? obj.retina : resolvePicture(obj.id, true, obj.width, obj.height)
        }
    }
}