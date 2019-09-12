export interface FileInfo {
    name: string;
    size: number;
    isImage: boolean;
    isStored: boolean;
    imageWidth: number | null;
    imageHeight: number | null;
    imageFormat: string | null;
    mimeType: string;
}