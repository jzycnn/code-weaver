require('dotenv').config(); // 加载 .env 文件中的配置
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const GitHubService = require('./github');
const Agent = require('./agent');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 初始化服务
const ghService = new GitHubService(process.env.GITHUB_TOKEN);
// 将 DeepSeek 的 Key 和 URL 传递给 Agent 
const agent = new Agent(
    process.env.DEEPSEEK_API_KEY, 
    process.env.DEEPSEEK_BASE_URL, 
    ghService
);

app.post('/api/weave', async (req, res) => {
  const { repoUrl, prompt } = req.body;
  
  // 简单解析仓库 URL
  const parts = repoUrl.split('/');
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];

  try {
    const result = await agent.run(owner, repo, prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("AI 任务执行失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CodeWeaver Backend (DeepSeek) 服务器已启动，运行在端口 ${PORT}`);
});