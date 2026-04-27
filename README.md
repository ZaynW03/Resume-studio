# 📄 Resume Studio

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**Your AI-Powered End-to-End Career Agent | 你的专属 AI 求职智能体**

[English](#english) | [中文](#chinese)

</div>

---

<a name="english"></a>
## 🇬🇧 English

**Resume Studio** is an open-source, local-first resume builder inspired by FlowCV. It provides a WYSIWYG editing experience, intelligent PDF importing, and AI-assisted tailoring capabilities.

> **🚀 Project Vision: The End-to-End Job Agent**
> This project is currently in **Phase 1** (Resume Editing & Display Platform). 
> Our ultimate goal is to evolve into a fully autonomous job-seeking agent that will:
> - Search for matching job roles across the web automatically.
> - Tailor your resume 1-on-1 based on Job Descriptions (JD).
> - Automate job applications and monitor your email.
> - Auto-schedule interviews on your calendar.

### ✨ Features (Phase 1)
- **Smart Import**: Upload a PDF or image, and automatically parse it into structured JSON.
- **Visual Editing**: Edit with per-module shape-aware forms and a TipTap rich-text editor.
- **Deep Customization**: Customize templates, layouts, spacing, fonts, section headings, and photos.
- **WYSIWYG Preview**: The preview is the *exact* HTML that WeasyPrint will render to PDF.
- **Profile Library**: A persistent pool of your career history, reusable across different resumes.
- **Optional AI Assistant**: Paste a JD to get a match score, or use the LLM to write and improve your bullet points. Everything runs locally without external database lock-in.

### 🚀 Quick Start

#### 1. System Prerequisites
You will need to install a few system dependencies for PDF parsing and rendering. Install once, and you are good to go:

| Tool | macOS (Homebrew) | Ubuntu / Debian | Purpose |
|---|---|---|---|
| **Tesseract OCR** | `brew install tesseract tesseract-lang` | `sudo apt install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng` | OCR fallback for scanned PDFs |
| **Poppler** | `brew install poppler` | `sudo apt install poppler-utils` | PDF to Image extraction |
| **WeasyPrint** | `brew install pango cairo gdk-pixbuf libffi` | `sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libffi-dev` | High-quality PDF rendering |

*Note: Requires **Python 3.10+** and **Node.js 18+**.*

#### 2. Start the Application (One Command)
Run the startup script from the project root:
```bat
start.bat
```
This script sets up the Python virtual environment, installs dependencies, and boots both servers:
- **Backend (FastAPI)**: http://localhost:8000
- **Frontend (Vite)**: http://localhost:5173

#### 3. Manual Start
If you prefer running them separately:

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit for LLM features if needed
uvicorn app.main:app --reload --port 8000
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

#### 4. (Optional) Enable AI Features
To use AI resume tailoring, add your LLM API keys in `backend/.env`:
```env
LLM_PROVIDER=openai  # or anthropic
OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=http://localhost:11434/v1  # optional, for Ollama/LM Studio
OPENAI_MODEL=gpt-4o-mini
```

### 🛠️ Architecture & API
- **Frontend**: React + Vite + Zustand + TailwindCSS
- **Backend**: Python + FastAPI + Pydantic + WeasyPrint
- **Storage**: Plain JSON files under `backend/data/` (No SQL DB required).
- Check `http://localhost:8000/docs` for the interactive OpenAPI docs.

---

<a name="chinese"></a>
## 🇨🇳 中文

**Resume Studio** 是一个开源的、本地优先的简历生成器（受 FlowCV 启发）。它提供了所见即所得（WYSIWYG）的编辑体验、简历解析导入功能以及 AI 辅助的简历润色定制。

> **🚀 项目愿景：端到端求职 Agent**
> 当前项目处于 **第一阶段**（简历展示与修改平台）。
> 后续我们将致力于把它打造成端到端求职智能体（Agent），实现：
> - 自动化全网搜寻匹配的工作岗位（Job Role）。
> - 根据目标职位描述（JD）一对一定制修改和优化简历。
> - 自动化投递简历并持续监控邮箱反馈。
> - 自动安排面试日历。

### ✨ 功能介绍 (第一阶段)
- **智能导入**：支持上传 PDF 或图片格式的简历，自动解析为结构化 JSON 数据。
- **可视化编辑**：提供模块化的表单编辑与 TipTap 富文本编辑器，操作流畅。
- **深度定制**：自由定制模板、排版、间距、字体以及各模块布局，支持个人照片上传。
- **所见即所得**：预览界面即是最终生成的 HTML，通过 WeasyPrint 精准渲染为高质量 PDF。
- **个人档案库**：建立持久化的个人经历库，可在不同版本简历间一键复用。
- **AI 智能辅助**：粘贴 JD 即可获取匹配评分、优化建议；可针对单条经历进行 AI 智能润色（纯本地数据管理，可选接入大模型）。

### 🚀 快速开始

#### 1. 系统依赖
处理 PDF 和图像解析需要安装以下底层依赖（只需安装一次）：

| 工具 | macOS (Homebrew) | Ubuntu / Debian | 作用 |
|---|---|---|---|
| **Tesseract OCR** | `brew install tesseract tesseract-lang` | `sudo apt install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng` | 扫描版 PDF 和图片的 OCR 识别 |
| **Poppler** | `brew install poppler` | `sudo apt install poppler-utils` | PDF 转图片底层支持 |
| **WeasyPrint** | `brew install pango cairo gdk-pixbuf libffi` | `sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libffi-dev` | 核心 PDF 渲染器 |

*注意：环境需要 **Python 3.10+** 及 **Node.js 18+**。*

#### 2. 一键启动
在项目根目录下运行启动脚本：
```bat
start.bat
```
该脚本会自动创建 Python 虚拟环境、安装依赖，并启动前后端服务：
- **后端 (FastAPI)**: http://localhost:8000
- **前端 (Vite)**: http://localhost:5173

#### 3. 手动启动
如果你习惯于在不同终端中分别启动服务：

**启动后端:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 如果需要 AI 功能，请在此配置
uvicorn app.main:app --reload --port 8000
```
**启动前端:**
```bash
cd frontend
npm install
npm run dev
```

#### 4. (可选) 开启 AI 功能
如需使用 AI 简历匹配和润色功能，请在 `backend/.env` 文件中配置 API Key：
```env
LLM_PROVIDER=openai  # 或使用 anthropic
OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=http://localhost:11434/v1  # 可选，用于 Ollama/LM Studio
OPENAI_MODEL=gpt-4o-mini
```

### 🛠️ 架构与 API
- **前端技术栈**: React + Vite + Zustand + TailwindCSS
- **后端技术栈**: Python + FastAPI + Pydantic + WeasyPrint
- **数据存储**: 所有数据以纯 JSON 形式保存在 `backend/data/` 目录下（无需数据库）。
- 启动后可访问 `http://localhost:8000/docs` 查看交互式 API 文档。

---

<div align="center">
  <i>Built with ❤️ for better careers.</i>
</div>
