export interface Chart {
    labels: string[];
    datasets: ChartData[];
}

export interface ChartData {
    label: string;
    values: number[];
}

export interface HistogramRecord {
    count: number;
    value: number;
}

export function reformatHistogram(src: HistogramRecord[], maxBuckets: number = 15): HistogramRecord[] {
    if (src.length === 0) {
        return [];
    }
    let min = src[0].value;
    let max = src[0].value;
    let bucketCount = Math.min(maxBuckets, src.length);
    for (let s of src) {
        if (s.value < min) {
            min = s.value;
        }
        if (s.value > max) {
            max = s.value;
        }
    }

    let buckets: HistogramRecord[] = [];
    let step = (max - min) / bucketCount;
    for (let i = 0; i < bucketCount; i++) {
        let start = min + step * i;
        let end = start + step;
        let v = 0;
        for (let s of src) {
            if (s.value >= start && s.value < end) {
                v += s.count;
            }
        }
        buckets.push({count: v, value: Math.floor(start)});
    }
    return buckets;
}