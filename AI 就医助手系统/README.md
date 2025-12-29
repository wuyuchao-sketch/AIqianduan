
  # AI 就医助手系统

  This is a code bundle for AI 就医助手系统. The original project is available at https://www.figma.com/design/ojxcfOweH6h3NM0jtrvc4W/AI-%E5%B0%B1%E5%8C%BB%E5%8A%A9%E6%89%8B%E7%B3%BB%E7%BB%9F.

  ## 新增功能

  ### AI病例总结功能
  - 在医生端界面集成了AI病例总结面板
  - 调用MedicalSummaryController接口
  - 支持流式生成病例总结

  详细使用说明请参考：[MEDICAL_SUMMARY_USAGE.md](./MEDICAL_SUMMARY_USAGE.md)

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## 后端服务

  确保后端Spring Boot服务运行在 `http://localhost:8070` 端口。
  