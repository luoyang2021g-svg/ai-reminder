const messageInput = document.getElementById("messageInput");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");

const taskTitle = document.getElementById("taskTitle");
const deadline = document.getElementById("deadline");
const remindTime = document.getElementById("remindTime");
const eventDatetime = document.getElementById("eventDatetime");
const remindDatetime = document.getElementById("remindDatetime");
const materials = document.getElementById("materials");
const people = document.getElementById("people");
const locationText = document.getElementById("location");
const summary = document.getElementById("summary");
const priorityTag = document.getElementById("priorityTag");

const copyBtn = document.getElementById("copyBtn");
const calendarBtn = document.getElementById("calendarBtn");
const saveBtn = document.getElementById("saveBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const historyList = document.getElementById("historyList");

const calendarDownloadBox = document.getElementById("calendarDownloadBox");
const calendarDownloadLink = document.getElementById("calendarDownloadLink");

let currentTask = null;

generateBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();

  if (!text) {
    alert("请先粘贴一条消息");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "AI 正在识别...";

  try {
    currentTask = await analyzeWithAI(text);
    renderTask(currentTask);
  } catch (error) {
    console.error(error);
    alert("AI 识别失败，已使用本地备用解析。你可以查看终端错误信息。");

    currentTask = mockAnalyze(text);
    renderTask(currentTask);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "生成提醒";
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentTask) {
    alert("请先生成提醒");
    return;
  }

  const todoText = `任务：${currentTask.title}
截止时间：${currentTask.deadline}
建议提醒：${currentTask.remind_time}
准备材料：${formatArray(currentTask.materials)}
相关人物：${formatArray(currentTask.people)}
地点：${currentTask.location || "无"}
优先级：${currentTask.priority}
日历时间：${currentTask.event_datetime || "待确认"}
提醒时间：${currentTask.remind_datetime || "待确认"}
备注：${currentTask.summary}`;

  try {
    await navigator.clipboard.writeText(todoText);
    alert("已复制待办内容");
  } catch (error) {
    alert("复制失败，请手动复制页面内容");
  }
});

calendarBtn.addEventListener("click", () => {
  if (!currentTask) {
    alert("请先生成提醒");
    return;
  }

  const eventTime = getCalendarTime();

  const title = currentTask.title;

  const description = `截止时间：${currentTask.deadline}
建议提醒：${currentTask.remind_time}
准备材料：${formatArray(currentTask.materials)}
相关人物：${formatArray(currentTask.people)}
地点：${currentTask.location || "无"}
备注：${currentTask.summary}`;

  const icsContent = createICS({
    title,
    description,
    location: currentTask.location || "",
    startTime: eventTime.start,
    endTime: eventTime.end
  });

  downloadICS(icsContent, "ai-reminder.ics");
});

saveBtn.addEventListener("click", () => {
  if (!currentTask) {
    alert("请先生成提醒");
    return;
  }

  const history = JSON.parse(localStorage.getItem("taskHistory") || "[]");

  const taskWithTime = {
    ...currentTask,
    saved_at: new Date().toLocaleString()
  };

  history.unshift(taskWithTime);
  localStorage.setItem("taskHistory", JSON.stringify(history));

  renderHistory();
  alert("已保存到历史记录");
});

clearHistoryBtn.addEventListener("click", () => {
  const confirmClear = confirm("确定要清空所有历史记录吗？");

  if (!confirmClear) {
    return;
  }

  localStorage.removeItem("taskHistory");
  renderHistory();
});

async function analyzeWithAI(text) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "AI 识别失败");
  }

  return data;
}


function renderTask(task) {
  taskTitle.textContent = task.title;
  deadline.textContent = task.deadline;
  remindTime.textContent = task.remind_time;
  eventDatetime.textContent = task.event_datetime || "待确认";
  remindDatetime.textContent = task.remind_datetime || "待确认";
  materials.textContent = formatArray(task.materials);
  people.textContent = formatArray(task.people);
  locationText.textContent = task.location || "无";
  summary.textContent = task.summary;
  priorityTag.textContent = `${task.priority}优先级`;

  resultCard.classList.remove("hidden");
  calendarDownloadBox.classList.add("hidden");
}


function renderHistory() {
  const history = JSON.parse(localStorage.getItem("taskHistory") || "[]");

  historyList.innerHTML = "";

  if (history.length === 0) {
    historyList.innerHTML = `<p class="empty-text">暂无历史记录</p>`;
    return;
  }

  history.forEach((task) => {
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <strong>${task.title}</strong>
      <span>
        截止：${task.deadline}<br />
        提醒：${task.remind_time}<br />
        保存时间：${task.saved_at || "未知"}
      </span>
    `;

    historyList.appendChild(item);
  });
}

function formatArray(arr) {
  if (!arr || arr.length === 0) {
    return "无";
  }

  return arr.join("、");
}

function mockAnalyze(text) {
  if (text.includes("报名表")) {
    return {
      title: "发送报名表",
      deadline: "明天下午4点前",
      remind_time: "明天下午3点",
      people: [],
      materials: ["学生证照片"],
      location: "",
      priority: "中",
      summary: "需要在明天下午4点前发送报名表，并附上学生证照片。"
    };
  }

  if (text.includes("会议") || text.includes("开会")) {
    return {
      title: "参加会议",
      deadline: "消息中提到的会议时间",
      remind_time: "会议开始前30分钟",
      people: [],
      materials: ["相关资料"],
      location: "线上或指定地点",
      priority: "中",
      summary: "需要按时参加会议，并提前准备相关资料。"
    };
  }

  if (text.includes("作业") || text.includes("论文")) {
    return {
      title: "完成学习任务",
      deadline: "消息中提到的截止时间",
      remind_time: "截止前一天晚上8点",
      people: [],
      materials: ["作业材料", "相关文档"],
      location: "",
      priority: "中",
      summary: "这条消息可能包含学习任务，请在截止时间前完成并提交。"
    };
  }

  if (text.includes("快递")) {
    return {
      title: "处理快递事项",
      deadline: "尽快处理",
      remind_time: "今天晚上7点",
      people: [],
      materials: [],
      location: "快递点",
      priority: "低",
      summary: "这条消息可能与快递领取或处理有关，建议稍后提醒自己完成。"
    };
  }

  return {
    title: "处理消息中的待办事项",
    deadline: "待确认",
    remind_time: "建议今天稍后提醒",
    people: [],
    materials: [],
    location: "",
    priority: "中",
    summary: "AI 已识别出这条消息可能包含待办事项，建议进一步确认具体时间。"
  };
}

function getCalendarTime() {
  if (currentTask && currentTask.remind_datetime) {
    const parsedStart = parseDateTime(currentTask.remind_datetime);

    if (parsedStart) {
      const end = new Date(parsedStart);
      end.setMinutes(end.getMinutes() + 30);

      return {
        start: parsedStart,
        end
      };
    }
  }

  if (currentTask && currentTask.event_datetime) {
    const parsedEventTime = parseDateTime(currentTask.event_datetime);

    if (parsedEventTime) {
      const start = new Date(parsedEventTime);
      start.setMinutes(start.getMinutes() - 30);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      return {
        start,
        end
      };
    }
  }

  const now = new Date();

  let start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(15, 0, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  return {
    start,
    end
  };
}


function parseDateTime(dateTimeText) {
  if (!dateTimeText) {
    return null;
  }

  const normalizedText = dateTimeText.replace(/\//g, "-").trim();

  const match = normalizedText.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  return new Date(year, month, day, hour, minute, 0, 0);
}



function createICS({ title, description, location, startTime, endTime }) {
  const formatLocalDate = (date) => {
    const pad = (num) => String(num).padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());

    return `${year}${month}${day}T${hour}${minute}${second}`;
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AI Reminder//CN
BEGIN:VEVENT
UID:${Date.now()}@ai-reminder
DTSTAMP:${formatLocalDate(new Date())}
DTSTART:${formatLocalDate(startTime)}
DTEND:${formatLocalDate(endTime)}
SUMMARY:${escapeICS(title)}
DESCRIPTION:${escapeICS(description)}
LOCATION:${escapeICS(location)}
END:VEVENT
END:VCALENDAR`;
}


function escapeICS(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function downloadICS(content, filename) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/calendar;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  calendarDownloadLink.href = url;
  calendarDownloadLink.download = filename;
  calendarDownloadBox.classList.remove("hidden");

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert("日历文件已生成。如果没有自动下载，请点击页面下方的备用下载链接。");
}

renderHistory();
