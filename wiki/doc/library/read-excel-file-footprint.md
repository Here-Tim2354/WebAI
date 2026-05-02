---
aliases:
  - read-excel-file footprint
  - Excel 转 CSV 库痕迹
---

# read-excel-file 外部库痕迹

这篇笔记整理 `read-excel-file` 在 WebAI 中的实际用途。

## 落点

代码入口：

- `src/lib/attachments.ts`

依赖入口：

- `package.json`
- `package-lock.json`

## 解决的问题

`Phase 4.4` 中，Excel `.xlsx` 不再按 Office 转 PDF 处理，而是直接转换为 CSV。

当前链路是：

1. 上传 `.xlsx`
2. 服务端用 `read-excel-file/universal` 读取工作簿
3. 过滤空行
4. 生成 CSV Buffer
5. 用 `text/csv` 保存到 `message_attachments` 私有 bucket
6. metadata 保留原始 `.xlsx` 文件名和 MIME，用于 UI 提示“已转换”

## 当前取舍

- 只支持 `.xlsx`
- 不支持老 `.xls`
- 不依赖本机 Microsoft Office
- 不依赖 LibreOffice / soffice
- 空表会直接返回上传错误，避免保存 `0 B` 的空 CSV

## 与其他附件转换的关系

- `.xlsx`：`read-excel-file` -> CSV -> Storage 保存 CSV
- Word / PPT：`libreoffice-convert` -> PDF -> Storage 保存 PDF
- PDF / 文本 / Markdown / CSV：直接保存原文件内容

## 后续需要回归

- 多 sheet 文件
- 日期、数字、中文单元格
- 空表错误提示
- 较大表格的转换耗时
- 历史消息恢复后的文件名、大小和“已转换”提示
