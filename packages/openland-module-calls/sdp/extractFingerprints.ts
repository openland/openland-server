import { SDP } from './SDP';

export function extractFingerprints(src: SDP): { algorithm: string, value: string }[] {
    let res: { algorithm: string, value: string }[] = [];
    if (src.fingerprint) {
        res.push({
            algorithm: src.fingerprint.type,
            value: src.fingerprint.hash
        });
    } else {
        for (let m of src.media) {
            if (m.fingerprint) {
                if (res.find((v) => v.algorithm === m.fingerprint!.type && v.value === m.fingerprint!.hash)) {
                    continue;
                }
                res.push({
                    algorithm: m.fingerprint.type,
                    value: m.fingerprint.hash
                });
            }
        }
    }
    return res;
}