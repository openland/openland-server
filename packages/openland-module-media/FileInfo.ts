export interface FileInfo {
    isImage: boolean;
    isStored: boolean;
    imageWidth: number | null;
    imageHeight: number | null;
    imageFormat: string | null;
    mimeType: string;
    name: string;
    size: number;
}