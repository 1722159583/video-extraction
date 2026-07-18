const $ = (selector) => document.querySelector(selector);
const form = $("#upload-form");
const fileInput = $("#video-file");
const createButton = $("#create-button");
const currentJob = $("#current-job-id");
let pollTimer = null;

function statusText(status) {
  return ({ created: "待分析", queued: "已排队", running: "分析中", completed: "已完成", failed: "处理失败" })[status] || status;
}

function showMessage(message, isError = false) {
  const target = $("#upload-message");
  target.textContent = message;
  target.style.color = isError ? "#a63a31" : "#55646a";
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "请求失败");
  return data;
}

function renderJob(job) {
  $("#result-empty").hidden = true;
  $("#result-content").hidden = false;
  currentJob.textContent = job.job_id;
  const status = $("#task-status");
  status.className = `status ${job.status}`;
  status.textContent = statusText(job.status);
  $("#task-time").textContent = job.completed_at || job.started_at || job.created_at || "";
  $("#task-error").hidden = !job.error;
  $("#task-error").textContent = job.error || "";
}

function renderReport(report) {
  const video = report.video || {};
  const values = [
    ["时长", video.duration !== undefined ? `${video.duration} 秒` : "-"],
    ["分辨率", video.width && video.height ? `${video.width} x ${video.height}` : "-"],
    ["帧率", video.fps !== undefined ? `${video.fps} fps` : "-"],
    ["关键帧", `${(report.keyframes || []).length} 个`],
  ];
  $("#video-info").innerHTML = values.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("#report-message").textContent = report.message || "分析报告已生成。";
  $("#report-json").textContent = JSON.stringify(report, null, 2);
}

async function selectJob(jobId) {
  clearInterval(pollTimer);
  try {
    const { job } = await request(`/api/jobs/${jobId}`);
    renderJob(job);
    if (job.status === "completed") {
      const { report } = await request(`/api/jobs/${jobId}/report`);
      renderReport(report);
    }
    if (["queued", "running"].includes(job.status)) {
      pollTimer = setInterval(() => selectJob(jobId), 1500);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadJobs() {
  try {
    const { jobs } = await request("/api/jobs");
    const list = $("#job-list");
    if (!jobs.length) {
      list.innerHTML = '<p class="no-jobs">暂无历史任务</p>';
      return;
    }
    list.innerHTML = "";
    jobs.forEach((job) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "job-card";
      card.innerHTML = `<strong>${job.asset_name}</strong><span class="status ${job.status}">${statusText(job.status)}</span><span class="job-meta">${job.created_at}</span>`;
      card.addEventListener("click", () => selectJob(job.job_id));
      list.appendChild(card);
    });
  } catch (error) {
    $("#job-list").innerHTML = `<p class="no-jobs">无法读取任务：${error.message}</p>`;
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  $("#file-name").textContent = file.name;
  const preview = $("#video-preview");
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!fileInput.files[0]) return;
  createButton.disabled = true;
  showMessage("正在上传...");
  try {
    const created = await request("/api/jobs", { method: "POST", body: new FormData(form) });
    showMessage("任务已创建，正在提交分析...");
    await request(`/api/jobs/${created.job.job_id}/analyze`, { method: "POST" });
    await loadJobs();
    await selectJob(created.job.job_id);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    createButton.disabled = false;
  }
});

async function checkHealth() {
  const label = $("#service-status");
  try {
    await request("/api/health");
    label.textContent = "服务正常";
    label.className = "service-status online";
  } catch (_) {
    label.textContent = "服务不可用";
    label.className = "service-status offline";
  }
}

$("#refresh-button").addEventListener("click", loadJobs);
checkHealth();
loadJobs();
