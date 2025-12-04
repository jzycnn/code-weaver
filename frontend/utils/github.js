const { Octokit } = require("octokit");

class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  // 获取仓库的文件树结构
  async getFileTree(owner, repo, branch = 'main') {
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner, repo, ref: `heads/${branch}`,
    });
    const commitSha = refData.object.sha;
    const { data: commitData } = await this.octokit.rest.git.getCommit({
      owner, repo, commit_sha: commitSha,
    });
    const { data: treeData } = await this.octokit.rest.git.getTree({
      owner, repo, tree_sha: commitData.tree.sha, recursive: '1',
    });
    return { tree: treeData.tree };
  }

  // 获取单个文件的内容
  async getFileContent(owner, repo, path) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner, repo, path,
      });
      // GitHub API 返回的是 Base64 编码，需要解码
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (e) {
      return null;
    }
  }

  // 创建分支，提交代码，并创建 PR
  async createPullRequest(owner, repo, baseBranch, newBranchName, title, description, changes) {
    // 1. 获取基础分支的最新 SHA
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner, repo, ref: `heads/${baseBranch}`,
    });
    const baseSha = refData.object.sha;

    // 2. 为每个修改或新增的文件创建 Blob
    const treeItems = [];
    for (const file of changes) {
      const { data: blob } = await this.octokit.rest.git.createBlob({
        owner, repo, content: file.content, encoding: 'utf-8',
      });
      treeItems.push({
        path: file.path,
        mode: '100644', // 文件模式
        type: 'blob',
        sha: blob.sha,
      });
    }

    // 3. 创建新的 Tree (文件目录结构)
    const { data: tree } = await this.octokit.rest.git.createTree({
      owner, repo, base_tree: baseSha, tree: treeItems,
    });

    // 4. 创建 Commit
    const { data: newCommit } = await this.octokit.rest.git.createCommit({
      owner, repo, message: title, tree: tree.sha, parents: [baseSha],
    });

    // 5. 创建新分支 (引用到新的 Commit)
    await this.octokit.rest.git.createRef({
      owner, repo, ref: `refs/heads/${newBranchName}`, sha: newCommit.sha,
    });

    // 6. 创建 Pull Request (PR)
    const { data: pr } = await this.octokit.rest.pulls.create({
      owner, repo, title, body: description, head: newBranchName, base: baseBranch,
    });

    return pr.html_url;
  }
}

module.exports = GitHubService;