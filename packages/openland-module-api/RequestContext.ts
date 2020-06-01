import { Context, createContextNamespace } from '@openland/context';

export const RequestContext = createContextNamespace<{ ip?: string, latLong?: { long: number, lat: number } }>('request', {});

export const setRequestContextFrom = (ctx: Context, ipHeader?: string, latLongHeader?: string) => {
    let ip: string | undefined = undefined;
    if (ipHeader) {
        ip = ipHeader.split(',')[0].trim();
    }
    let latLong: { lat: number, long: number } | undefined = undefined;
    if (latLongHeader) {
        let latLongData = latLongHeader.split(',').map(a => parseFloat(a.trim()));
        if (latLongData.every(a => !Number.isNaN(a))) {
            latLong = {
                lat: latLongData[0],
                long: latLongData[1]
            };
        }
    }
    return RequestContext.set(ctx, { ip, latLong });
};