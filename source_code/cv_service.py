"""Baseline CV service. The algorithm team can extend this function with YOLO scoring."""

from pathlib import Path
from typing import Any


def extract_highlights(video_path: str | Path, output_dir: str | Path) -> dict[str, Any]:
    """Read video metadata and return the report contract expected by the Flask API."""
    try:
        import cv2
    except ImportError as error:
        raise RuntimeError("缺少 OpenCV，请安装 requirements.txt 中的依赖") from error

    source = Path(video_path)
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError("无法读取视频文件，请确认文件未损坏且编码受支持")
    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if fps <= 0 or frame_count <= 0:
            raise ValueError("视频不包含可用帧")
    finally:
        capture.release()

    return {
        "video": {
            "duration": round(frame_count / fps, 3),
            "fps": round(fps, 3),
            "width": width,
            "height": height,
        },
        "keyframes": [],
        "recommended_segments": [],
        "message": "基础视频信息已生成；可在此函数中接入 YOLO 关键帧评分与片段提取。",
    }
