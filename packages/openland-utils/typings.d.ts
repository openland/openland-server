declare module '*/geo_ip_v4.json' {
    const value: [[number, number, string, string]];
    export default value;
}

declare module '*/countries.json' {
    const value: { [key: string]: { lat: number, long: number } };
    export default value;
}