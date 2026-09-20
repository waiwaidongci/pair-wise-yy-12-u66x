/**
 * 图片工具：把蹄底照片压缩为小尺寸 JPEG dataURL 存 localStorage，保证刷新后可查看。
 */

const MAX_SIZE = 480;

export function fileToSolePhoto(file: File): Promise<{
  name: string;
  dataUrl: string;
  uploadedAt: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("照片解析失败"));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ name: file.name, dataUrl: String(reader.result), uploadedAt: new Date().toISOString() });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          name: file.name,
          dataUrl: canvas.toDataURL("image/jpeg", 0.72),
          uploadedAt: new Date().toISOString(),
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
