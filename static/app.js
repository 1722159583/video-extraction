const API_BASE = "/api";

// ===== DOM 引用 =====
const form = document.getElementById("upload-form");
const fileInput = document.getElementById("video-file");
const projectNameInput = document.getElementById("project_name");
const clipDurationInput = document.getElementById("clip_duration");
const submitBtn = document.getElementById("submit-btn");
const jobList = document.getElementById("job-list");
const detailSection = document.getElementById("detail-section");
const detailContent = document.getElementById("detail-content");
const closeDetailBtn = document.getElementById("close-detail");

// ===== 工具函数 =====
async function fetchJSON(url, options = {}) {
    const resp = await fetch(url, options);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "请求失败");
    return data;
}

function formatTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("zh-CN");
}

function statusLabel(status) {
    const map = {
        created: "已创建",
        queued: "排队中",
        running: "处理中",
        completed: "已完成",
        failed: "失败",
    };
    return map[status] || status;
}

// ===== 渲染任务列表 =====
async function renderJobList() {
    try {
        const data = await fetchJSON(`${API_BASE}/jobs`);
        const jobs = data.jobs || [];

        if (jobs.length === 0) {
            jobList.innerHTML = '<p class="loading-text">暂无任务，上传一个视频开始吧</p>';
            return;
        }

        jobList.innerHTML = jobs.map(job => `
            <div class="job-item" data-job-id="${job.job_id}">
                <div class="info">
                    <span class="name">${job.project_name || "未命名"}</span>
                    <span class="status status-${job.status}">${statusLabel(job.status)}</span>
                    <span class="time">${job.asset_name || "未知文件"}</span>
                </div>
                <span class="time">${formatTime(job.created_at)}</span>
            </div>
        `).join("");

        // 点击任务查看详情
        document.querySelectorAll(".job-item").forEach(el => {
            el.addEventListener("click", () => {
                const jobId = el.dataset.jobId;
                renderJobDetail(jobId);
            });
        });
    } catch (err) {
        jobList.innerHTML = `<p class="error-text">加载失败: ${err.message}</p>`;
    }
}

// ===== 渲染任务详情 =====
async function renderJobDetail(jobId) {
    try {
        const job = await fetchJSON(`${API_BASE}/jobs/${jobId}`);

        detailSection.style.display = "block";

        // 基础信息
        let html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#0b0e14;padding:16px;border-radius:8px;margin-bottom:16px;">
                <div><strong>任务ID</strong><br>${job.job_id}</div>
                <div><strong>状态</strong><br><span class="status status-${job.status}">${statusLabel(job.status)}</span></div>
                <div><strong>项目</strong><br>${job.project_name || "-"}</div>
                <div><strong>素材</strong><br>${job.asset_name || "-"}</div>
                <div><strong>创建</strong><br>${formatTime(job.created_at)}</div>
                <div><strong>完成</strong><br>${formatTime(job.completed_at)}</div>
            </div>
        `;

        // 如果出错
        if (job.error) {
            html += `<div class="error-text">错误: ${job.error}</div>`;
            detailContent.innerHTML = html;
            return;
        }

        // 如果有分析结果
        if (job.result_file) {
            const result = await fetchJSON(`${API_BASE}/jobs/${jobId}/report`);

            // 推荐视频
            if (result.clip_video_url) {
                html += `
                    <div class="video-result">
                        <h3>🎞️ 推荐片段</h3>
                        <video controls playsinline src="${result.clip_video_url}"></video>
                        <br>
                        <a class="download-link" href="${result.clip_video_url}" download>📥 下载视频</a>
                    </div>
                `;
            }

            // 关键帧列表
            const frames = result.keyframes || [];
            if (frames.length > 0) {
                html += `
                    <div>
                        <h3>🖼️ 关键帧 (点击标记保留/忽略)</h3>
                        <div class="keyframes-grid" data-job-id="${jobId}">
                            ${frames.map((f, idx) => `
                                <div class="keyframe-card" data-index="${idx}">
                                    <img src="${f.image_url}" alt="关键帧 ${idx+1}" loading="lazy" />
                                    <div class="score">⭐ ${f.score ? f.score.toFixed(3) : "-"}</div>
                                    <div class="time">${f.timestamp ? f.timestamp.toFixed(2) + "s" : "-"}</div>
                                    <div class="actions">
                                        <button class="kept" data-action="keep" data-index="${idx}">✅ 保留</button>
                                        <button class="ignored" data-action="ignore" data-index="${idx}">❌ 忽略</button>
                                    </div>
                                    <div style="font-size:12px;color:#6a7a88;margin-top:4px;">
                                        状态: ${f.review_status || "待审核"}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `;
            } else {
                html += `<p class="loading-text">暂无关键帧数据</p>`;
            }
        } else {
            html += `<p class="loading-text">任务尚未生成结果文件</p>`;
        }

        detailContent.innerHTML = html;

        // 绑定关键帧审核事件
        document.querySelectorAll(".keyframe-card .actions button").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const idx = parseInt(btn.dataset.index);
                const card = btn.closest(".keyframe-card");
                const grid = card.closest(".keyframes-grid");
                const jobId = grid.dataset.jobId;

                try {
                    await fetchJSON(`${API_BASE}/jobs/${jobId}/review`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ index: idx, action: action }),
                    });
                    // 重新加载详情
                    await renderJobDetail(jobId);
                } catch (err) {
                    alert("审核失败: " + err.message);
                }
            });
        });

    } catch (err) {
        detailContent.innerHTML = `<p class="error-text">加载详情失败: ${err.message}</p>`;
    }
}

// ===== 上传视频 =====
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        alert("请选择一个视频文件");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_name", projectNameInput.value || "未命名项目");
    formData.append("clip_duration", clipDurationInput.value || "6");

    submitBtn.disabled = true;
    submitBtn.textContent = "提交中...";

    try {
        const result = await fetchJSON(`${API_BASE}/jobs`, {
            method: "POST",
            body: formData,
        });
        alert("✅ 任务创建成功！任务ID: " + result.job_id);
        fileInput.value = "";
        renderJobList();
        // 自动打开任务详情
        setTimeout(() => renderJobDetail(result.job_id), 500);
    } catch (err) {
        alert("❌ 创建失败: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "创建任务";
    }
});

// ===== 关闭详情 =====
closeDetailBtn.addEventListener("click", () => {
    detailSection.style.display = "none";
});

// ===== 定时刷新任务列表 =====
setInterval(() => {
    renderJobList();
}, 5000);

// ===== 初始化 =====
renderJobList();