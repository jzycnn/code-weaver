"use client"; // 告诉 Next.js 这是客户端组件，可以使用 state 和事件

import { useState } from 'react';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  // 定义状态：空闲，加载中，成功，错误
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]); // 模拟日志输出

  const handleSubmit = async () => {
    setStatus('loading');
    setResult(null);
    setLogs(['连接 CodeWeaver Agent...', '分析仓库结构...', 'Gemini 正在规划修改路径...']);
    
    try {
      // 向后端服务器发送请求
      const res = await fetch('http://localhost:5000/api/weave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, prompt }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult(data.data);
        setStatus('success');
        setLogs(prev => [...prev, '代码生成完毕', 'PR 创建成功! 🎉']);
      } else {
        throw new Error(data.error || '未知错误');
      }
    } catch (e: any) {
      setStatus('error');
      setLogs(prev => [...prev, `错误: 任务执行失败，请检查后端日志和 Token 权限。`]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CodeWeaver AI 魔法工作室
          </h1>
          <p className="text-gray-400 mt-2">用自然语言驱动您的 GitHub 仓库开发。</p>
        </div>

        {/* Input Area */}
        <div className="grid gap-4 bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">GitHub 仓库 URL</label>
            <input 
              type="text" 
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="例如：[https://github.com/username/project](https://github.com/username/project)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">你想让 AI 做什么？ (Prompt)</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：在根目录下创建一个 hello.txt 文件，内容是 'Hello World'，并修改 README.md 在顶部添加一个标题。"
              className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <button 
            onClick={handleSubmit}
            disabled={status === 'loading' || !repoUrl || !prompt}
            className={`w-full py-3 rounded-lg font-bold transition-all ${
              status === 'loading' 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
            }`}
          >
            {status === 'loading' ? 'AI 正在编码中...' : '启动 AI 魔法 (生成并创建 PR)'}
          </button>
        </div>

        {/* Status & Logs */}
        {status !== 'idle' && (
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
              <span className={`w-2 h-2 rounded-full ${status === 'loading' ? 'bg-green-400 animate-pulse' : status === 'success' ? 'bg-green-400' : 'bg-red-500'}`}></span>
              执行日志
            </h3>
            <div className="space-y-2 font-mono text-sm text-gray-400 overflow-y-auto max-h-40">
              {logs.map((log, i) => (
                <div key={i}>&gt; {log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Result Area */}
        {status === 'success' && result && (
          <div className="bg-green-900/20 border border-green-800 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-green-400 mb-4">AI 任务完成! 🚀</h2>
            <div className="space-y-4">
              <p>AI 已为您创建了一个包含修改的 Pull Request (PR):</p>
              <a 
                href={result.prUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                查看 GitHub PR 链接
              </a>
              
              <div className="mt-4">
                <h4 className="font-semibold text-gray-300 mb-2">修改文件概览:</h4>
                <ul className="list-disc list-inside text-gray-400">
                  {result.changes.map((file: any, i: number) => (
                    <li key={i}>**{file.path}** (已修改或创建)</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}