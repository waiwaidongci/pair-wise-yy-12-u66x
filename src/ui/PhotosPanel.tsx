import { useState } from "react";
import { addPhoto } from "../rules/engine";
import type { HoofArchive, ShoeingTask } from "../rules/types";
import { apply } from "./actions";
import { getStore } from "./useArchiveStore";
import { fileToDataUrl } from "./photo";
import { Banner } from "./components";

export function PhotosPanel({ archive, task }: { archive: HoofArchive; task: ShoeingTask }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined, kind: "sole" | "other") {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = addPhoto(getStore().getState(), {
        horseId: archive.horseId,
        hoof: archive.hoof,
        taskId: task.id,
        name: file.name,
        kind,
        dataUrl,
      });
      if (result.errors.length > 0) setError(result.errors.join("；"));
      else apply(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片处理失败");
    } finally {
      setBusy(false);
    }
  }

  const soleCount = task.photos.filter((p) => p.kind === "sole").length;

  return (
    <div className="sub-panel">
      <h3>照片留档</h3>
      <div className="photo-upload-row">
        <label className="upload-btn">
          ＋ 上传蹄底照片{soleCount > 0 ? `（已 ${soleCount} 张）` : "（复查闭环必需）"}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files?.[0], "sole");
              e.target.value = "";
            }}
          />
        </label>
        <label className="upload-btn upload-btn-ghost">
          ＋ 上传现场照片
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files?.[0], "other");
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      {task.photos.length === 0 ? (
        <p className="empty-hint">暂无照片。复查准入闭环前必须至少补齐一张蹄底照片。</p>
      ) : (
        <div className="photo-grid">
          {task.photos.map((p) => (
            <figure key={p.id} className="photo-item">
              {p.dataUrl ? (
                <img src={p.dataUrl} alt={p.name} />
              ) : (
                <div className="photo-placeholder">示例照片</div>
              )}
              <figcaption>
                <span className={p.kind === "sole" ? "photo-tag-sole" : "photo-tag-other"}>
                  {p.kind === "sole" ? "蹄底" : "现场"}
                </span>
                {p.name}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
