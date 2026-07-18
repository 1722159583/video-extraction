# 系统设计文档

## 一、系统架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     前端工作台 (HTML/CSS/JS)                 │
├─────────────────────────────────────────────────────────────┤
│  页面: index.html  │  样式: app.css  │  逻辑: app.js       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Flask 后端服务 (app.py)                    │
├─────────────────────────────────────────────────────────────┤
│  /api/health        │  /api/jobs        │  /api/jobs/<id>   │
│  /api/jobs/<id>/analyze  │  /api/jobs/<id>/review           │
│  /api/jobs/<id>/rough-cut  │  /api/jobs/<id>/report         │
└──────────────────────┬──────────────────────────────────────┘
                       │ 调用
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   CV 算法模块 (source_code/)                 │
├─────────────────────────────────────────────────────────────┤
│  cv_service.py      │  cv_config.py     │  test_cv.py       │
│  extract_highlights │  配置参数         │  算法测试         │
└──────────────────────┬──────────────────────────────────────┘
                       │ 加载
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    YOLO 模型 (models/yolo11n.pt)            │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    文件系统存储                              │
├─────────────────────────────────────────────────────────────┤
│  outputs/<job_id>/input/     │  outputs/<job_id>/evidence/  │
│  outputs/<job_id>/job.json   │  outputs/<job_id>/analysis_report.json │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层次 | 技术 | 版本 |
|---|---|---|
| 前端 | HTML/CSS/JavaScript | - |
| 后端框架 | Flask | 3.0+ |
| 视频处理 | OpenCV | 4.8+ |
| 目标检测 | Ultralytics YOLO | 8.3+ |
| 视频剪辑 | FFmpeg | 预留 |
| 数据存储 | JSON + 本地文件系统 | - |
| 测试 | unittest | - |

---

## 二、目录结构

```
video-extraction-main/
├── app.py                    # Flask 主应用
├── requirements.txt          # 依赖列表
├── README.md                 # 项目说明
├── .gitignore                # Git 忽略配置
├── models/                   # YOLO 模型文件
│   └── yolo11n.pt
├── source_code/              # CV 算法模块
│   ├── __init__.py
│   ├── cv_config.py          # 算法参数配置
│   ├── cv_service.py         # 核心算法逻辑
│   ├── test_cv.py            # 算法测试脚本
│   └── 算法验证记录.md
├── static/                   # 静态资源
│   ├── app.css               # 样式文件
│   └── app.js                # 前端逻辑
├── templates/                # 模板文件
│   └── index.html            # 主页面
├── tests/                    # 测试目录
│   ├── test_api.py           # API 单元测试
│   └── test_full_api.py      # 完整 API 测试
├── docs/                     # 文档目录
│   ├── PRD.md
│   ├── SYSTEM_DESIGN.md
│   ├── API.md
│   ├── TEST_REPORT.md
│   └── BUG_RECORD.md
├── outputs/                  # 输出目录
│   └── <job_id>/             # 任务目录
│       ├── input/            # 上传的视频文件
│       ├── evidence/         # 证据帧图片
│       ├── job.json          # 任务状态
│       └── analysis_report.json  # 分析报告
├── assets/                   # 测试素材
├── screenshots/              # 页面截图
└── demo/                     # 演示脚本
```

---

## 三、核心模块设计

### 3.1 后端模块 (app.py)

#### 3.1.1 任务管理

| 函数 | 功能 | 参数 | 返回值 |
|---|---|---|---|
| `create_job` | 创建任务 | file, project_name, settings | job 对象 |
| `list_jobs` | 获取任务列表 | - | jobs 数组 |
| `get_job_endpoint` | 获取单个任务 | job_id | job 对象 |
| `analyze_job` | 启动分析 | job_id | job 对象 |
| `review_job` | 审核关键帧 | job_id, keyframe_id, action | keyframe 对象 |
| `delete_job` | 删除任务 | job_id | job_id |
| `run_analysis` | 后台分析线程 | job_id | - |

#### 3.1.2 任务状态管理

任务状态流转：`created -> queued -> running -> completed/failed`

每个任务目录必须保存 `job.json`，包含：
- job_id: 任务编号
- project_name: 项目名称
- asset_name: 素材名称
- status: 当前状态
- created_at: 创建时间
- started_at: 开始时间
- completed_at: 完成时间
- settings: 配置参数
- result_file: 结果文件路径
- error: 错误信息（失败时）

### 3.2 CV 算法模块 (source_code/)

#### 3.2.1 cv_config.py

| 参数 | 值 | 说明 |
|---|---|---|
| MODEL_PATH | models/yolo11n.pt | YOLO 模型路径 |
| CONFIDENCE_THRESHOLD | 0.35 | 置信度阈值 |
| SAMPLE_INTERVAL | 15 | 采样间隔（帧） |
| TOP_N_SEGMENTS | 5 | 返回前 N 个精彩片段 |
| SEGMENT_MIN_DURATION | 2.0 | 片段最小时长（秒） |
| SEGMENT_MAX_DURATION | 10.0 | 片段最大时长（秒） |
| WEIGHT_OBJECT_COUNT | 0.3 | 目标数量权重 |
| WEIGHT_OBJECT_TYPE | 0.4 | 目标类型权重 |
| WEIGHT_MOTION | 0.3 | 运动强度权重 |

#### 3.2.2 cv_service.py

| 函数 | 功能 | 参数 | 返回值 |
|---|---|---|---|
| `load_model` | 加载 YOLO 模型 | model_path | YOLO 模型对象 |
| `sample_frames` | 视频帧采样 | video_path, sample_interval | frames, fps, duration |
| `detect_frame` | 单帧检测 | model, frame | detections 数组 |
| `calc_excitement_score` | 计算精彩度分数 | detections, prev_detections | score (0-1) |
| `merge_segments` | 合并相邻高分帧为片段 | segments, fps, min_duration, max_duration | highlights 数组 |
| `extract_highlights` | 主函数：提取精彩片段 | video_path, output_dir | 分析结果 |

#### 3.2.3 精彩度评分算法

```
highlight_score =
    object_score * WEIGHT_OBJECT_COUNT
  + type_score * WEIGHT_OBJECT_TYPE
  + motion_score * WEIGHT_MOTION
```

- **object_score**: 目标数量归一化分数，`min(len(detections) / 5.0, 1.0)`
- **type_score**: 高价值目标类型分数，根据 HIGH_VALUE_CLASSES 配置
- **motion_score**: 帧间变化分数，`min(abs(len(detections) - len(prev_detections)) * 0.15, 1.0)`

---

## 四、数据库与文件存储设计

### 4.1 任务目录结构

```
outputs/<job_id>/
├── input/
│   └── <uploaded_video>.mp4    # 上传的原始视频
├── evidence/
│   └── evidence_<segment_id>.jpg  # 证据帧图片（最多3张）
├── job.json                    # 任务状态
├── analysis_report.json        # 分析报告
└── error.json                  # 错误信息（失败时）
```

### 4.2 job.json 结构

```json
{
  "job_id": "20260718_162441_8e9f9863",
  "project_name": "视频精彩片段提取",
  "asset_name": "test_video.mp4",
  "status": "completed",
  "created_at": "2026-07-18T16:24:41+08:00",
  "started_at": "2026-07-18T16:24:42+08:00",
  "completed_at": "2026-07-18T16:24:46+08:00",
  "settings": {},
  "result_file": "analysis_report.json",
  "error": null
}
```

### 4.3 analysis_report.json 结构

```json
{
  "job_id": "20260718_162441_8e9f9863",
  "asset_name": "test_video.mp4",
  "status": "completed",
  "video": {
    "duration": 3.0,
    "fps": 30.0,
    "total_frames": 90,
    "sampled_frames": 6
  },
  "highlights": [
    {
      "segment_id": 1,
      "start_time": 1.0,
      "end_time": 4.0,
      "duration": 3.0,
      "score": 0.82,
      "reason": "检测到 person×2"
    }
  ],
  "keyframes": [
    {
      "id": "segment_1",
      "segment_id": 1,
      "timestamp": 2.5,
      "score": 0.82,
      "label": "检测到 person×2",
      "note": "",
      "review": "pending",
      "image_url": "/outputs/.../evidence/evidence_1.jpg"
    }
  ],
  "model": "yolo11n",
  "parameters": {},
  "processing_time": 4.2,
  "message": "分析完成，可查看并审核推荐精彩片段。"
}
```

---

## 五、API 接口设计

### 5.1 响应格式

成功响应：
```json
{"ok": true, "data": {...}}
```

失败响应：
```json
{"ok": false, "error": "错误信息"}
```

### 5.2 接口详情

#### GET /api/health

**响应：**
```json
{"ok": true, "status": "ok", "model_ready": true}
```

#### POST /api/jobs

**请求：** `multipart/form-data`
- file: 视频文件（必填）
- project_name: 项目名称（可选）
- settings: JSON 字符串（可选）

**响应：**
```json
{"ok": true, "job": {...}}
```

#### GET /api/jobs

**响应：**
```json
{"ok": true, "jobs": [...]}
```

#### GET /api/jobs/<job_id>

**响应：**
```json
{"ok": true, "job": {...}}
```

#### POST /api/jobs/<job_id>/analyze

**响应：**
```json
{"ok": true, "job": {...}}
```

#### PATCH /api/jobs/<job_id>/review

**请求：**
```json
{"keyframe_id": "segment_1", "action": "keep", "label": "", "note": ""}
```

**响应：**
```json
{"ok": true, "keyframe": {...}}
```

#### DELETE /api/jobs/<job_id>

**响应：**
```json
{"ok": true, "job_id": "..."}
```

#### GET /api/jobs/<job_id>/report

**响应：**
```json
{"ok": true, "report": {...}}
```

---

## 六、安全设计

### 6.1 文件路径安全

- 使用 `secure_filename` 对上传文件名进行清理
- 使用 UUID 生成任务 ID，避免路径遍历攻击
- 验证 job_id 只包含数字、小写字母和下划线

### 6.2 错误处理

- 所有异常都被捕获并记录到 `error.json`
- 接口参数错误返回 400，不导致服务进程退出
- 正在运行的任务不能删除（返回 409）

### 6.3 资源限制

- 文件大小限制：2GB
- 支持的文件格式：mp4、mov、avi、mkv、webm

---

## 七、部署与运行

### 7.1 环境要求

- Python 3.13+
- Conda 环境：yolo
- 依赖：Flask、opencv-python、ultralytics、dill、requests

### 7.2 启动命令

```powershell
conda activate yolo
python -m pip install -r requirements.txt
python app.py --host 127.0.0.1 --port 7880
```

### 7.3 访问地址

- 前端页面：`http://127.0.0.1:7880`
- 健康检查：`http://127.0.0.1:7880/api/health`