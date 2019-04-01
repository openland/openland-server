export function parseCookies(cookie: string) {
    let values = cookie.split(';');
    let res: any = {};

    for (let value of values) {
        let [key, v] = value.split('=');
        res[key.trim()] = v.trim();
    }

    return res;
}