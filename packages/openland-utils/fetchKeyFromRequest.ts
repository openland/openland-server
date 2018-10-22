import * as express from 'express';
export function fetchKeyFromRequest(req: express.Request, name: string) {
    let value = req.headers[name];
    if (value) {
        if (typeof value === 'string') {
            return value;
        } else if (Array.isArray(value)) {
            return value[0];
        }
    }
    let cookie = req.headers.cookie;
    if (cookie && typeof cookie === 'string') {
        let valCookie = cookie.split(';').find((c: string) => c.trim().startsWith(name + '='));
        if (valCookie) {
            return valCookie.split('=')[1];
        }
    }
    return null;
}