// 引入 Agent 和 GitHubService 类
import Agent from '../../../utils/agent.js';
import GitHubService from '../../../utils/githubService.js';
import { NextResponse } from 'next/server';

// ⚠️ 注意：Vercel 环境不需要 .env 文件，而是直接从环境变量读取
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 检查所有必要的环境变量是否已设置
if (!DEEPSEEK_API_KEY || !GITHUB_TOKEN || !DEEPSEEK_BASE_URL) {
  throw new Error("Missing required environment variables for API execution.");
}

// 初始化服务（只执行一次）
const ghService = new GitHubService(GITHUB_TOKEN);
const agent = new Agent(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, ghService);

// 对应 POST /api/weave 请求的函数
export async function POST(request) {
  try {
    const body = await request.json();
    const { repoUrl, prompt } = body;
    
    // 简单解析仓库 URL：https://github.com/owner/repo
    const parts = repoUrl.split('/');
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];

    // 运行 AI Agent 任务
    const result = await agent.run(owner, repo, prompt);

    // 返回 JSON 响应
    return NextResponse.json({ success: true, data: result }, { status: 200 });

  } catch (error) {
    console.error("Vercel Serverless Function 执行失败:", error);
    
    // 返回 500 错误响应
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}