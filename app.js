let state = {
  documents: [],
  dashboard: {},
  user: {},
  prefix: CONFIG.DOC_PREFIX,
  editMode: false,
  monthlyChart: null
};

function apiCall(action, data = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "jsonp_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    let finished = false;

    window[callbackName] = function(response) {
      finished = true;

      try {
        delete window[callbackName];
      } catch (e) {}

      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }

      if (!response || !response.success) {
        reject(new Error(response?.message || "API Error"));
        return;
      }

      resolve(response.result);
    };

    const params = new URLSearchParams();
    params.set("action", action);
    params.set("callback", callbackName);

    if (data && Object.keys(data).length > 0) {
      params.set("data", JSON.stringify(data));
    }

    params.set("_", Date.now());

    const script = document.createElement("script");
    script.src = CONFIG.API_URL + "?" + params.toString();
    script.referrerPolicy = "no-referrer";

    script.onerror = function() {
      console.warn("JSONP redirect detected:", script.src);
    };

    document.body.appendChild(script);

    setTimeout(() => {
      if (!finished) {
        try {
          delete window[callbackName];
        } catch (e) {}

        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }

        reject(new Error("API ไม่ตอบกลับภายใน 20 วินาที"));
      }
    }, 20000);
  });
}

window.onload = function () {
  bindEvents();
  loadApp();
};

function bindEvents() {
  const form = document.getElementById("docForm");
  if (form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      saveDocument();
    });
  }
}

async function loadApp() {
  try {
    showLoading(true);

    const res = await apiCall("init");

    state.documents = res.documents || [];
    state.dashboard = res.dashboard || {};
    state.user = res.user || {};
    state.prefix = res.app?.prefix || CONFIG.DOC_PREFIX;

    document.getElementById("userName").innerText = state.user.name || "-";
    document.getElementById("userRole").innerText = state.user.role || "-";

    resetForm();
    renderDashboard();
    renderMonthlyChart();
    renderRecent();
    renderDocuments();

    showLoading(false);
  } catch (err) {
    showLoading(false);
    showToast("โหลดระบบไม่สำเร็จ: " + err.message, true);
  }
}

function showLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function showView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  if (view === "dashboard") {
    document.getElementById("dashboardView").classList.remove("hidden");
    document.querySelectorAll(".nav-item")[0].classList.add("active");
    setTimeout(renderMonthlyChart, 100);
  }

  if (view === "create") {
    document.getElementById("createView").classList.remove("hidden");
    document.querySelectorAll(".nav-item")[1].classList.add("active");
  }

  if (view === "documents") {
    document.getElementById("documentsView").classList.remove("hidden");
    document.querySelectorAll(".nav-item")[2].classList.add("active");
  }
}

function openCreateForm() {
  resetForm();
  showView("create");
}

function resetForm() {
  state.editMode = false;

  document.getElementById("formTitle").innerText = "ออกเลขหนังสือใหม่";
  document.getElementById("docId").value = "";
  document.getElementById("docNo").value = state.prefix;
  document.getElementById("docDate").valueAsDate = new Date();
  document.getElementById("subject").value = "";
  document.getElementById("requester").value = "";
  document.getElementById("recipient").value = "";
  document.getElementById("status").value = "ACTIVE";
  document.getElementById("fileLink").value = "";
}

async function saveDocument() {
  const payload = {
    id: document.getElementById("docId").value,
    docNo: document.getElementById("docNo").value.trim(),
    docDate: document.getElementById("docDate").value,
    subject: document.getElementById("subject").value.trim(),
    requester: document.getElementById("requester").value.trim(),
    recipient: document.getElementById("recipient").value.trim(),
    status: document.getElementById("status").value,
    fileLink: document.getElementById("fileLink").value.trim()
  };

  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;

  try {
    const action = state.editMode ? "updateDocument" : "createDocument";
    const res = await apiCall(action, payload);

    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล`;

    if (res.status === "success") {
      state.documents = res.documents || [];
      state.dashboard = res.dashboard || {};

      showToast(res.message);
      resetForm();
      renderDashboard();
      renderMonthlyChart();
      renderRecent();
      renderDocuments();
      showView("documents");
    } else {
      showToast(res.message, true);
    }

  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล`;
    showToast(err.message, true);
  }
}

function renderDashboard() {
  document.getElementById("kpiTotal").innerText = state.dashboard.total || 0;
  document.getElementById("kpiMonth").innerText = state.dashboard.monthCount || 0;
  document.getElementById("kpiToday").innerText = state.dashboard.todayCount || 0;
  document.getElementById("kpiActive").innerText = state.dashboard.activeCount || 0;

  document.getElementById("statusActive").innerText = state.dashboard.activeCount || 0;
  document.getElementById("statusPending").innerText = state.dashboard.pendingCount || 0;
  document.getElementById("statusCancel").innerText = state.dashboard.cancelCount || 0;
  document.getElementById("latestDocNo").innerText = state.dashboard.latestDocNo || "-";
}

function renderMonthlyChart() {
  const canvas = document.getElementById("monthlyChart");
  if (!canvas || typeof Chart === "undefined") return;

  const monthly = state.dashboard.monthly || [];
  const labels = monthly.map(m => `${m.label} ${String(m.year).slice(-2)}`);
  const data = monthly.map(m => m.count);

  if (state.monthlyChart) {
    state.monthlyChart.destroy();
  }

  state.monthlyChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "จำนวนเอกสาร",
        data,
        borderWidth: 1,
        borderRadius: 10,
        backgroundColor: "rgba(109, 40, 217, 0.75)"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function renderRecent() {
  const el = document.getElementById("recentList");
  const recent = state.documents.slice(0, 5);

  if (!recent.length) {
    el.innerHTML = `<p style="color:#94a3b8;">ยังไม่มีข้อมูล</p>`;
    return;
  }

  el.innerHTML = recent.map(d => `
    <div class="recent-item" onclick="openDetail('${d.id}')">
      <strong>${escapeHtml(d.docNo)}</strong>
      <p style="margin:6px 0;color:#475569;">${escapeHtml(d.subject)}</p>
      <span class="badge ${d.status}">${d.status}</span>
    </div>
  `).join("");
}

function renderDocuments() {
  const tbody = document.getElementById("documentTable");
  const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const status = document.getElementById("statusFilter")?.value || "";

  let docs = [...state.documents];

  if (keyword) {
    docs = docs.filter(d =>
      Object.values(d).join(" ").toLowerCase().includes(keyword)
    );
  }

  if (status) {
    docs = docs.filter(d => d.status === status);
  }

  if (!docs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#94a3b8;padding:28px;">
          ไม่พบข้อมูล
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = docs.map(d => `
    <tr>
      <td><strong style="color:#6d28d9;cursor:pointer;" onclick="openDetail('${d.id}')">${escapeHtml(d.docNo)}</strong></td>
      <td>${formatThaiDate(d.docDate)}</td>
      <td>${escapeHtml(d.subject)}</td>
      <td>${escapeHtml(d.requester)}</td>
      <td>${escapeHtml(d.recipient)}</td>
      <td><span class="badge ${d.status}">${d.status}</span></td>
      <td>
        <button class="action-btn" onclick="openDetail('${d.id}')" title="ดูรายละเอียด"><i class="fa-solid fa-eye"></i></button>
        <button class="action-btn" onclick="editDoc('${d.id}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn" onclick="cancelDoc('${d.id}')" title="ยกเลิก"><i class="fa-solid fa-ban"></i></button>
      </td>
    </tr>
  `).join("");
}

function openDetail(id) {
  const d = state.documents.find(x => x.id === id);
  if (!d) return;

  document.getElementById("modalBody").innerHTML = `
    <p><strong>เลขที่:</strong> ${escapeHtml(d.docNo)}</p>
    <p><strong>วันที่:</strong> ${formatThaiDate(d.docDate)}</p>
    <p><strong>เรื่อง:</strong> ${escapeHtml(d.subject)}</p>
    <p><strong>ผู้ขอ:</strong> ${escapeHtml(d.requester)}</p>
    <p><strong>ส่งถึง:</strong> ${escapeHtml(d.recipient)}</p>
    <p><strong>สถานะ:</strong> <span class="badge ${d.status}">${d.status}</span></p>
    <p><strong>ผู้สร้าง:</strong> ${escapeHtml(d.createdBy)}</p>
    <p><strong>วันที่บันทึก:</strong> ${escapeHtml(d.createdAt)}</p>
    ${d.fileLink ? `<p><strong>ไฟล์แนบ:</strong> <a href="${escapeHtml(d.fileLink)}" target="_blank">เปิดไฟล์</a></p>` : ""}
  `;

  document.getElementById("detailModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
}

function editDoc(id) {
  const d = state.documents.find(x => x.id === id);
  if (!d) return;

  state.editMode = true;

  document.getElementById("formTitle").innerText = "แก้ไขข้อมูลเอกสาร";
  document.getElementById("docId").value = d.id;
  document.getElementById("docNo").value = d.docNo;
  document.getElementById("docDate").value = d.docDate;
  document.getElementById("subject").value = d.subject;
  document.getElementById("requester").value = d.requester;
  document.getElementById("recipient").value = d.recipient;
  document.getElementById("status").value = d.status;
  document.getElementById("fileLink").value = d.fileLink || "";

  showView("create");
}

async function cancelDoc(id) {
  if (!confirm("ต้องการยกเลิกเอกสารนี้ใช่หรือไม่?")) return;

  try {
    const res = await apiCall("cancelDocument", { id });

    if (res.status === "success") {
      state.documents = res.documents || [];
      state.dashboard = res.dashboard || {};
      showToast(res.message);
      renderDashboard();
      renderMonthlyChart();
      renderRecent();
      renderDocuments();
    } else {
      showToast(res.message, true);
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

function exportCSV() {
  if (!state.documents.length) {
    showToast("ไม่มีข้อมูลสำหรับ Export", true);
    return;
  }

  const headers = ["เลขที่", "วันที่", "เรื่อง", "ผู้ขอ", "ส่งถึง", "สถานะ", "ผู้สร้าง", "วันที่บันทึก"];

  const rows = state.documents.map(d => [
    d.docNo,
    d.docDate,
    d.subject,
    d.requester,
    d.recipient,
    d.status,
    d.createdBy,
    d.createdAt
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "PEA_DMS_DOCUMENTS.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.background = isError ? "#dc2626" : "#16a34a";
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

function formatThaiDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);

  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
