# Bug 记录

| 编号 | 问题现象 | 复现步骤 | 原因 | 修复方案 | 验证结果 |
|---|---|---|---|---|---|
| BUG-001 | 上传视频时服务返回 500 错误，无法创建任务目录 | 1. 启动 Flask 服务<br>2. 调用 `POST /api/jobs` 上传视频文件<br>3. 服务返回 500 错误 | `app.py` 第 174 行使用 `input_dir.mkdir(parents=True)` 创建目录时，在 Windows 环境下，先创建子目录 `input` 时，父目录 `outputs/<job_id>` 尚未创建，导致权限拒绝错误 | 修改目录创建逻辑，先创建父目录 `directory.mkdir(parents=True, exist_ok=True)`，再创建子目录 `input_dir.mkdir(exist_ok=True)`，并添加 try-except 异常处理 | ✅ 修复后，视频上传正常，任务目录成功创建，API 返回 201 |
| BUG-002 | `run_analysis` 函数在输入目录为空时抛出 `StopIteration` 异常 | 1. 创建任务后，手动清空 `outputs/<job_id>/input/` 目录<br>2. 调用 `POST /api/jobs/<job_id>/analyze`<br>3. 服务抛出未捕获的 `StopIteration` 异常 | `app.py` 第 130 行使用 `next((directory / "input").iterdir())` 获取视频文件，当输入目录为空时，迭代器没有元素，抛出 `StopIteration` 异常，虽然被外层 try-except 捕获，但错误信息不够清晰 | 将 `next((directory / "input").iterdir())` 改为 `list((directory / "input").iterdir())`，检查列表是否为空，若为空则抛出明确的错误信息 `RuntimeError("输入目录为空，未找到视频文件")` | ✅ 修复后，输入目录为空时任务状态正确设置为 `failed`，错误信息清晰明确 |