require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 5173;
const API_BASE_URL = (process.env.API_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
const MODEL_NAME = process.env.MODEL_NAME || "deepseek-v4-flash";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const rateLimitMap = new Map();

function simpleRateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 30;

  const record = rateLimitMap.get(ip) || {
    count: 0,
    startTime: now
  };

  if (now - record.startTime > windowMs) {
    record.count = 0;
    record.startTime = now;
  }

  record.count += 1;
  rateLimitMap.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      error: "请求过于频繁，请稍后再试"
    });
  }

  next();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AI 拾事提醒",
    model: MODEL_NAME
  });
});

app.post("/api/analyze", simpleRateLimit, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "请输入需要解析的消息"
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        error: "输入内容过长，请控制在 2000 字以内"
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: "服务器未配置 API_KEY"
      });
    }

    const today = new Date().toLocaleDateString("zh-CN");

    const systemPrompt = `
你是一个手机 AI 提醒助手。你的任务是从用户输入的聊天消息、通知、邮件或备忘文本中，提取可以执行的提醒事项。

请严格返回 JSON，不要输出解释性文字。

字段必须包括：
{
  "title": "任务标题，简洁明确",
  "deadline": "截止时间或发生时间，保留自然语言表达",
  "remind_time": "建议提醒时间，保留自然语言表达",
  "event_datetime": "任务发生或截止的具体时间，格式必须是 YYYY-MM-DD HH:mm，如果无法确定则为空字符串",
  "remind_datetime": "建议提醒的具体时间，格式必须是 YYYY-MM-DD HH:mm，如果无法确定则为空字符串",
  "people": ["相关人物"],
  "materials": ["需要准备的材料"],
  "location": "地点，没有则为空字符串",
  "priority": "高 / 中 / 低",
  "summary": "一句话总结任务"
}

规则：
1. 如果用户给出了明确时间，必须保留原始时间表达。
2. 如果用户没有给出提醒时间，请根据任务自动建议一个合理提醒时间。
3. 如果没有地点、人物或材料，对应字段返回空字符串或空数组。
4. priority 只能是 高、中、低 三个值之一。
5. 只输出合法 JSON，不要输出 markdown，不要输出代码块。
6. 今天的日期是 ${today}，请根据今天日期推算“今天、明天、下周五”等相对时间。
7. event_datetime 和 remind_datetime 必须使用 24 小时制，例如 2026-05-10 15:30。
8. 如果用户只说“明天下午”，没有具体小时，可以合理推测为 15:00。
`;

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `请把下面这段消息解析成提醒 JSON：\n${text}`
          }
        ],
        response_format: {
          type: "json_object"
        },
        temperature: 0.2,
        max_tokens: 800,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API 调用失败：", errorText);

      return res.status(500).json({
        error: "AI 服务调用失败",
        detail: errorText
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "AI 没有返回内容"
      });
    }

    content = cleanJsonText(content);

    let task;

    try {
      task = JSON.parse(content);
    } catch (error) {
      console.error("AI 返回内容不是合法 JSON：", content);

      return res.status(500).json({
        error: "AI 返回内容不是合法 JSON",
        raw: content
      });
    }

    const normalizedTask = {
      title: task.title || "处理消息中的待办事项",
      deadline: task.deadline || "待确认",
      remind_time: task.remind_time || "建议稍后提醒",
      event_datetime: task.event_datetime || "",
      remind_datetime: task.remind_datetime || "",
      people: Array.isArray(task.people) ? task.people : [],
      materials: Array.isArray(task.materials) ? task.materials : [],
      location: task.location || "",
      priority: ["高", "中", "低"].includes(task.priority) ? task.priority : "中",
      summary: task.summary || "AI 已识别出这条消息可能包含待办事项。"
    };

    res.json(normalizedTask);
  } catch (error) {
    console.error("服务器错误：", error);

    res.status(500).json({
      error: "服务器内部错误",
      detail: error.message
    });
  }
});

function cleanJsonText(text) {
  return String(text)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI 拾事提醒已启动：http://127.0.0.1:${PORT}`);
  console.log(`当前模型：${MODEL_NAME}`);
  console.log(`API 地址：${API_BASE_URL}`);
});
