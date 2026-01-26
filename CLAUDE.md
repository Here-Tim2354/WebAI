# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebAI 是一个专注于 AI 服务集成的 Python 项目，用户目前正在学习如何使用 Google Gemini API 进行开发。


## Instructions

请优先阅读参考文档后给出回复,当用户提示使用use context7时，使用对应MCP

## Gemini API 参考文档

- 官方文档（中文）：https://ai.google.dev/gemini-api/docs?hl=zh-cn

### Gemini API 核心功能

- **文本生成**：多语言文本理解和生成
- **函数调用**：支持结构化输出和函数调用
- **长上下文**：支持长文本上下文处理
- **多模态支持**：文本、视频、文档、图片生成（Imagen）、视频生成（Veo）
- **工具集成**：Google Search、Google Maps、代码执行、文件搜索等
- **Live API**：实时交互功能


### 可用模型名称

- `gemini-3-flash-preview`：最新预览版
- `gemini-3-pro-preview`： 最新旗舰模型


## Architecture

项目目前处于早期开发阶段，用户正在学习 Gemini API 的各种功能：
- 基础文本生成
- 多模态输入（图片、视频、文档）
- 函数调用和结构化输出
- 流式响应
- 上下文缓存
