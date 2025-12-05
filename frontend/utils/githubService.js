import { Octokit } from '@octokit/core';

export default class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  // 1. 获取文件树
  async getFileTree(owner, repo) {
    const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });
    return data;
  }

  // 2. 获取文件内容
  async getFileContent(owner, repo, path) {
    const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path
    });
    // 内容是 Base64 编码的，需要解码
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return '';
  }

  // 3. 提交代码并创建 PR
  async createPullRequest(owner, repo, baseBranch, newBranch, title, description, changes) {
    console.log(`[GitHub] 开始创建分支: ${newBranch}`);

    // a. 获取基础分支的引用 (ref)
    const { data: baseRef } = await this.octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner,
      repo,
      ref: `heads/${baseBranch}`
    });

    // b. 创建新的分支
    await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: baseRef.object.sha // 基于主分支的 SHA
    });

    // c. 创建 Blobs (文件内容)
    const filesToCommit = [];
    for (const change of changes) {
      const { data: blob } = await this.octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content: change.content,
        encoding: 'utf-8'
      });
      filesToCommit.push({
        path: change.path,
        mode: '100644', // 文件模式
        type: 'blob',
        sha: blob.sha
      });
    }

    // d. 获取当前分支的 Tree SHA
    const { data: currentTree } = await this.octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
        owner,
        repo,
        tree_sha: baseRef.object.sha
    });

    // e. 创建新的 Tree (包含所有修改)
    const { data: newTree } = await this.octokit.request('POST /repos/{owner}/{repo}/git/trees', {
      owner,
      repo,
      base_tree: currentTree.sha,
      tree: filesToCommit
    });

    // f. 创建 Commit
    const { data: commit } = await this.octokit.request('POST /repos/{owner}/{repo}/git/commits', {
      owner,
      repo,
      message: title,
      tree: newTree.sha,
      parents: [baseRef.object.sha]
    });

    // g. 更新分支引用 (将新分支指向新 Commit)
    await this.octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
      owner,
      repo,
      ref: `heads/${newBranch}`,
      sha: commit.sha,
      force: true
    });

    // h. 创建 Pull Request
    const { data: pr } = await this.octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title,
      body: description,
      head: newBranch,
      base: baseBranch
    });

    return pr.html_url;
  }
}
