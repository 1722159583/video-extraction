# API 接口说明

服务默认地址：`http://127.0.0.1:7880`。所有接口响应都包含 `ok`；错误响应还包含可读的 `error`。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 服务与 OpenCV 可用性检查 |
| POST | `/api/jobs` | 上传视频并创建任务 |
| GET | `/api/jobs` | 获取历史任务列表 |
| GET | `/api/jobs/<job_id>` | 查询一个任务状态 |
| POST | `/api/jobs/<job_id>/analyze` | 将任务加入后台分析队列 |
| PATCH | `/api/jobs/<job_id>/review` | 保存关键帧保留/忽略、标签和备注 |
| POST | `/api/jobs/<job_id>/rough-cut` | 预留的 FFmpeg 粗剪接口 |
| GET | `/api/jobs/<job_id>/report` | 读取分析报告 |
| DELETE | `/api/jobs/<job_id>` | 删除未运行任务 |

## 创建任务

`POST /api/jobs` 使用 `multipart/form-data`：

- `file`：必填，支持 `mp4`、`mov`、`avi`、`mkv`、`webm`。
- `project_name`：可选，项目名称。
- `settings`：可选，JSON 字符串，保存算法参数。

任务创建仅保存上传文件并返回 `201`，不会同步执行分析。随后调用分析接口，并轮询任务详情：

```json
{"ok": true, "job": {"job_id": "20260718_100000_a1b2c3d4", "status": "created"}}
```

## 审核关键帧

`PATCH /api/jobs/<job_id>/review`：

```json
{"keyframe_id": "frame_0001", "action": "keep", "label": "战斗", "note": "保留开场"}
```

`action` 只能为 `keep` 或 `ignore`。修改会直接写回该任务的 `analysis_report.json`。

## 状态与错误

状态流转：`created -> queued -> running -> completed`，分析异常转为 `failed`。每次状态变更和异常都会保存至 `outputs/<job_id>/job.json`；详细堆栈保存在失败任务的 `error.json`。运行或排队中的任务删除会返回 `409`。
