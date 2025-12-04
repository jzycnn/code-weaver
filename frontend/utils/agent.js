// 引入 OpenAI 库，它用于连接 DeepSeek API
const OpenAI = require("openai").default;

class Agent {
  // 构造函数接收 DeepSeek Key 和 Base URL
  constructor(deepseekApiKey, deepseekBaseUrl, githubService) {
    this.openai = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: deepseekBaseUrl, // 指定 DeepSeek 的 API 地址
    });
    // 使用 DeepSeek 的强大编程模型
    this.model = "deepseek-coder"; 
    this.gh = githubService;
  }

  // 核心运行函数
  async run(owner, repo, userPrompt) {
    console.log(`[Agent] 开始分析 ${owner}/${repo} 使用 DeepSeek...`);

    // 1. 获取项目结构
    const { tree } = await this.gh.getFileTree(owner, repo);
    const fileList = tree.filter(t => t.type === 'blob').map(t => t.path).join('\n');
    
    // 2. 第一阶段：规划 (Planning) - 让 AI 决定要看哪些文件
    const planSystemPrompt = `
    你是 CodeWeaver AI。你的任务是根据用户的需求，决定需要读取哪些文件来完成任务。
    你必须**只返回 JSON 格式的文件路径数组**，例如: ["src/app.js", "package.json"]。
    `;
    
    const planUserPrompt = `
    用户任务: "${userPrompt}"
    
    当前仓库文件列表:
    ${fileList}
    
    请列出你必须读取内容的具体文件路径。
    `;

    // 调用 DeepSeek API 进行规划
    const planCompletion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: planSystemPrompt },
        { role: "user", content: planUserPrompt }
      ],
      // DeepSeek 也支持 JSON 模式，确保输出格式正确
      response_format: { type: "json_object" }, 
      temperature: 0.1,
    });

    const planResultText = planCompletion.choices[0].message.content;
    const filesToRead = JSON.parse(this.cleanJson(planResultText));
    console.log(`[Agent] 决定读取文件:`, filesToRead);

    // 3. 读取文件内容，作为上下文
    let contextCode = "";
    for (const path of filesToRead) {
      const content = await this.gh.getFileContent(owner, repo, path);
      contextCode += `\n--- FILE: ${path} ---\n${content}\n`;
    }

    // 4. 第二阶段：编码 (Coding) - 让 AI 生成修改后的代码
    const codeSystemPrompt = `
    你是一个高级全栈工程师 CodeWeaver。
    你的任务是根据用户需求和提供的代码上下文，生成修改后的完整代码。

    你必须严格使用以下 XML 格式输出每一个被修改或新创建的文件：
    
    <file path="path/to/filename.ext">
    这里是完整的新代码
    </file>
    
    最后，必须提供 PR 的标题和描述，使用以下 JSON 格式嵌套在 <pr_meta> 标签中：
    <pr_meta>
    {"title": "简洁的 PR 标题", "description": "详细的修改描述，解释你做了什么"}
    </pr_meta>
    `;

    const codeUserPrompt = `
    任务: "${userPrompt}"
    
    相关代码上下文:
    ${contextCode}
    
    请开始生成修改。
    `;

    // 调用 DeepSeek API 进行编码
    const codeCompletion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: codeSystemPrompt },
        { role: "user", content: codeUserPrompt }
      ],
      temperature: 0.2,
    });

    const rawResponse = codeCompletion.choices[0].message.content;
    
    // 5. 解析 AI 的输出
    const changes = this.parseResponse(rawResponse);
    const meta = this.parseMeta(rawResponse);
    
    // 6. 提交代码并创建 PR
    const branchName = `ai-feature-${Date.now()}`;
    
    const prUrl = await this.gh.createPullRequest(
      owner, repo, 'main', branchName, meta.title, meta.description, changes
    );

    return { prUrl, changes, meta };
  }

  // 辅助函数：清理 JSON 格式的输出
  cleanJson(text) {
    return text.replace(/```json/g, '').replace(/```/g, '').replace(/```/g, '').trim();
  }

  // 辅助函数：解析 XML 格式的修改文件 (此函数不变)
  parseResponse(text) {
    const changes = [];
    const regex = /<file path="(.*?)">([\s\S]*?)<\/file>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      changes.push({
        path: match[1],
        content: match[2].trim()
      });
    }
    return changes;
  }

  // 辅助函数：解析 PR 的元数据 (此函数不变)
  parseMeta(text) {
    const regex = /<pr_meta>([\s\S]*?)<\/pr_meta>/;
    const match = text.match(regex);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) { return { title: "AI Update", description: "Automated changes by CodeWeaver" }; }
    }
    return { title: "AI Update", description: "Automated changes by CodeWeaver" };
  }
}

module.exports = Agent;