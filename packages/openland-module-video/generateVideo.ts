import fetch, { Request } from 'node-fetch';
export async function generateVideo(name: string, args: any) {
    let res = await fetch(new Request('http://openland-videos-service.default.svc/create', {
        method: 'POST',
        headers: ['Content-Type: application/json'],
        body: JSON.stringify({ name, arguments: args })
    }));
    return (await res.json()).file as string;
}