# GitHub图床服务项目

## 项目概述

这是一个基于GitHub仓库的图床服务，提供图片上传、管理和访问功能。通过GitHub API将图片存储在GitHub仓库中，并提供HTTP访问链接。

## 项目结构

```
github-image-host/
├── src/                          # 核心源码
│   └── githubImageHostService.js # GitHub图床服务类
├── example/                      # 示例和测试
│   ├── server.js                # Express服务器示例
│   ├── test.js                  # 功能测试脚本
│   └── public/                  # Web界面
│       └── index.html           # 测试界面
├── .env.example                 # 环境变量配置示例
├── .gitignore                   # Git忽略文件
├── package.json                 # 项目配置和依赖
├── README.md                    # 使用说明
├── PROJECT.md                   # 项目文档（本文件）
├── install.bat                  # Windows安装脚本
└── start.bat                    # Windows启动脚本
```

## 核心功能

### 1. GitHubImageHostService 类

基础的GitHub图床服务类。

### 2. AutoUploadScheduler 类

自动上传调度器，提供定时任务功能。

### 3. PushPlusService 类

推送Plus微信通知服务。

### GitHubImageHostService 类

主要的服务类，提供以下功能：

1. **图片上传**
   - `uploadBase64Image(base64Data, filename)` - 上传base64编码的图片
   - `uploadFile(filePath, filename)` - 上传本地文件

2. **文件管理**
   - `fileExists(filename)` - 检查文件是否存在
   - `deleteFile(filename)` - 删除文件
   - `listFiles(path)` - 列出指定路径下的文件

3. **工具方法**
   - `generateUniqueFilename(originalFilename, prefix)` - 生成唯一文件名
   - `getRepositoryInfo()` - 获取仓库信息

### AutoUploadScheduler 类

自动上传调度器的主要功能：

1. **定时任务管理**
   - `start()` - 启动定时任务（每天9:00执行）
   - `runOnce()` - 手动执行一次任务
   - `executeUploadTask()` - 执行上传任务的核心逻辑

2. **文件检测**
   - `scanDesktopFiles()` - 扫描桌面文件夹
   - `isTargetFile(filename)` - 检查文件是否符合命名规则
   - `getTodayDateString()` - 获取当天日期字符串

3. **文件上传**
   - `uploadFile(fileInfo)` - 上传单个文件到GitHub图床
   - 自动生成唯一文件名
   - 错误处理和重试机制

4. **通知服务**
   - `sendNotification()` - 发送系统通知
   - 集成推送Plus微信推送
   - 详细的上传结果报告

### PushPlusService 类

微信推送服务的主要功能：

1. **消息发送**
   - `sendMessage(title, content, template)` - 发送推送消息
   - `sendUploadNotification()` - 发送上传结果通知
   - `sendStartupNotification()` - 发送服务启动通知

2. **消息格式化**
   - `buildSuccessContent()` - 构建成功消息内容
   - `buildFailContent()` - 构建失败消息内容
   - `buildMixedContent()` - 构建混合结果消息
   - `buildNoFileContent()` - 构建无文件消息

3. **模板支持**
   - HTML格式消息
   - 富文本样式
   - 链接和格式化支持

### API 接口

示例服务器提供以下REST API：

- `GET /health` - 健康检查
- `GET /api/repository-info` - 获取仓库信息
- `POST /api/upload-base64` - 上传base64图片
- `POST /api/upload-file` - 上传本地文件
- `GET /api/file-exists/:filename` - 检查文件存在性
- `DELETE /api/file/:filename` - 删除文件
- `GET /api/files` - 列出文件
- `POST /api/generate-filename` - 生成唯一文件名

## 配置说明

### 环境变量

在 `.env` 文件中配置以下变量：

```env
# GitHub配置（必需）
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_USERNAME=your_github_username
GITHUB_REPOSITORY=your_repository_name

# 服务器配置
PORT=3000

# 推送Plus配置（可选）
PUSHPLUS_TOKEN=your_pushplus_token
```

### 自动上传配置

#### 文件命名规则

自动上传功能会检测符合以下规则的文件：
- 文件名以 `meet` 开始（不区分大小写）
- 文件名以当天日期 `YYYYMMDD` 结束
- 中间可以包含任意内容

#### 定时任务配置

- **执行时间**：每天上午9:00（Asia/Shanghai时区）
- **检查目录**：当前用户的桌面文件夹
- **上传目录**：GitHub仓库的 `meet-files/` 目录
- **文件类型**：支持所有文件类型

#### 通知配置

- **系统通知**：Windows托盘通知
- **微信推送**：通过推送Plus发送详细结果
- **控制台日志**：详细的执行日志和链接

### GitHub Token 权限

需要创建一个具有以下权限的Personal Access Token：
- `repo` - 完整的仓库访问权限

## 使用方法

### 1. 快速开始（Windows）

#### 基础图床服务

```bash
# 运行安装脚本
install.bat

# 编辑 .env 文件，填入你的GitHub配置

# 启动Web服务
start.bat
```

#### 自动上传服务

```bash
# 创建演示文件
create-demo-file.bat

# 测试上传功能
test-scheduler.bat

# 启动定时服务
start-scheduler.bat
```

### 2. 手动安装

```bash
# 安装依赖
npm install

# 复制配置文件
copy .env.example .env

# 编辑 .env 文件

# 运行基础测试
npm test

# 启动Web服务
npm start

# 启动自动上传服务
npm run scheduler

# 测试自动上传功能
npm run scheduler:test
```

### 3. 编程使用

```javascript
const GitHubImageHostService = require('./src/githubImageHostService');

// 初始化服务
const imageHost = new GitHubImageHostService(
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_USERNAME,
    process.env.GITHUB_REPOSITORY
);

// 上传图片
const imageUrl = await imageHost.uploadBase64Image(base64Data, 'my-image.jpg');
console.log('图片URL:', imageUrl);
```

## 最佳实践

### 1. 仓库设置
- 建议使用专门的公开仓库作为图床
- 仓库名可以是 `image-host` 或 `images` 等
- 确保仓库是公开的，这样图片链接才能被外部访问

### 2. 文件组织
- 使用有意义的前缀组织文件，如 `photos/`, `avatars/`, `thumbnails/`
- 文件名包含时间戳和随机字符，避免冲突
- 定期清理不需要的图片文件

### 3. 安全考虑
- 妥善保管GitHub Token，不要提交到代码仓库
- 定期轮换Token
- 监控仓库的使用情况和大小

### 4. 性能优化
- 对于大量图片，考虑使用CDN加速访问
- 压缩图片以减少存储空间
- 批量操作时注意GitHub API的速率限制

## 限制和注意事项

1. **文件大小限制**：GitHub单个文件最大25MB
2. **仓库大小限制**：GitHub仓库建议不超过1GB
3. **API速率限制**：GitHub API有请求频率限制
4. **访问速度**：在某些地区GitHub访问可能较慢
5. **可用性**：依赖GitHub服务的可用性

## 故障排除

### 常见问题

1. **Token权限不足**
   - 确保Token具有 `repo` 权限
   - 检查Token是否过期

2. **仓库不存在**
   - 确保仓库名正确
   - 确保仓库是公开的或Token有访问权限

3. **网络连接问题**
   - 检查网络连接
   - 确认能访问 api.github.com

4. **文件上传失败**
   - 检查文件大小是否超限
   - 确认base64数据格式正确

### 调试方法

1. 运行测试脚本：`npm test`
2. 检查服务健康状态：访问 `/health` 接口
3. 查看控制台日志输出
4. 使用Web界面进行交互式测试

## 扩展开发

### 添加新功能

1. 在 `GitHubImageHostService` 类中添加新方法
2. 在示例服务器中添加对应的API接口
3. 更新Web界面以支持新功能
4. 添加相应的测试用例

### 集成到其他项目

1. 复制 `src/githubImageHostService.js` 文件
2. 安装依赖：`npm install axios`
3. 配置环境变量
4. 在代码中引入和使用服务类

## 许可证

MIT License - 详见 LICENSE 文件
