export const resizeUcarecdnImage = (imageStr: string, newSize: { width: number; height: number }) => {
    // ["https:", "", "ucarecdn.com", "25629a3c-1ebe-4d49-8560-9df3b92ade3a", "-", "resize", "80x80", ""]
    const [, , , ucareImageID] = imageStr.split('/');
    return `ttps://ucarecdn.com/${ucareImageID}/-/resize/${newSize.width}x${newSize.height}/`;
};
