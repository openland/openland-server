import { SearchResponse } from 'elasticsearch';

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

export function prepareHistogram(src: HistogramRecord[], buckets: number[]): HistogramRecord[] {
    if (src.length === 0) {
        return [];
    }
    let res: HistogramRecord[] = [];
    for (let i = 0; i < buckets.length; i++) {
        let start = buckets[i];
        let end = (i !== buckets.length - 1) ? buckets[i + 1] : Number.MAX_SAFE_INTEGER;
        let v = 0;
        for (let s of src) {
            if (s.value >= start && s.value < end) {
                v += s.count;
            }
        }
        res.push({ count: v, value: Math.floor(start) });
    }
    return res;
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
        buckets.push({ count: v, value: Math.floor(start) });
    }
    return buckets;
}

export function elasticChart(title: string, src: SearchResponse<any>): Chart {
    let chart = src.aggregations.main as { buckets: { key: number, key_as_string: string, value: { value: number } }[] };
    return {
        labels: chart.buckets.map((v) => new Date(v.key).getUTCFullYear().toString()),
        datasets: [{
            label: title,
            values: chart.buckets.map((v) => v.value.value)
        }]
    };
}

export function elasticMontlyChart(title: string, src: SearchResponse<any>): Chart {
    let chart = src.aggregations.main as { buckets: { key: number, key_as_string: string, value: { value: number } }[] };
    return {
        labels: chart.buckets.map((v) => new Date(v.key).getUTCFullYear().toString().substring(2) + '\'' + new Date(v.key).getMonth()),
        datasets: [{
            label: title,
            values: chart.buckets.map((v) => v.value.value)
        }]
    };
}

export function elasticQuarterChart(title: string, src: SearchResponse<any>): Chart {
    let chart = src.aggregations.main as { buckets: { key: number, key_as_string: string, value: { value: number } }[] };

    // console.warn(chart.buckets.map((v) => v.key));
    // console.warn(chart.buckets.map((v) => new Date(v.key).toUTCString()));
    // console.warn(chart.buckets.map((v) => new Date(v.key).getUTCMonth()));
    // console.warn(chart.buckets.map((v) => new Date(v.key).getMonth()));
    return {
        labels: chart.buckets.map((v) => {
            let date = new Date(v.key);
            let year = date.getUTCFullYear().toString().substring(2);
            let quarter = date.getUTCMonth() < 3 ? 'Q1' : date.getMonth() < 5 ? 'Q2' : date.getMonth() < 7 ? 'Q3' : 'Q4';
            return year + '\'' + quarter;
        }),
        datasets: [{
            label: title,
            values: chart.buckets.map((v) => v.value.value)
        }]
    };
}