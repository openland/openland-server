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
    if (req.headers.cookie && typeof req.headers.cookie === 'string') {
        let cookie = req.headers.cookie;
        let valCookie = cookie.split(';').find((c: string) => c.trim().startsWith(name + '='));
        if (valCookie) {
            return valCookie.split('=')[1];
        }
    }
    return null;
}