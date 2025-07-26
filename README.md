# GitHub图床服务

一个基于GitHub仓库的图床服务，支持上传图片到GitHub仓库并获取访问链接。支持自动定时上传桌面文件并推送通知。

## 功能特性

- 📤 **Base64图片上传**：支持直接上传base64编码的图片
- 📁 **本地文件上传**：支持上传本地图片文件
- 🔍 **文件存在检查**：检查文件是否已存在于仓库中
- 🏷️ **唯一文件名生成**：自动生成带时间戳的唯一文件名
- 🔒 **安全认证**：使用GitHub Personal Access Token进行身份验证
- ⏰ **定时自动上传**：每天9点自动检查桌面文件夹并上传符合条件的文件
- 📱 **微信推送通知**：支持推送Plus微信通知上传结果
- 🎯 **智能文件识别**：自动识别以meet开始、当天日期结束的文件

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填入你的GitHub配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_USERNAME=your_github_username
GITHUB_REPOSITORY=your_repository_name
PORT=3005

# 推送Plus配置（可选）
PUSHPLUS_TOKEN=your_pushplus_token
```

### 3. 获取GitHub Personal Access Token

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token"
3. 选择权限：`repo` (完整仓库访问权限)
4. 复制生成的token到 `.env` 文件中

### 4. 创建GitHub仓库

1. 在GitHub上创建一个新的公开仓库（用作图床）
2. 将仓库名填入 `.env` 文件的 `GITHUB_REPOSITORY` 字段

## 自动上传功能

### 功能说明

自动上传功能会在每天上午9:00检查桌面文件夹，查找符合命名规则的文件并自动上传到GitHub图床。

### 文件命名规则

文件名必须满足以下格式：
- 以 `meet` 开始
- 以当天日期 `YYYYMMDD` 结束
- 中间可以包含任意内容

**示例：**
```
meet-会议记录20241220.pdf     ✅ 符合规则
meetingNotes20241220.docx     ✅ 符合规则
meet20241220.txt              ✅ 符合规则
meeting20241219.pdf           ❌ 日期不是当天
document20241220.pdf          ❌ 不以meet开始
meet-notes.pdf                ❌ 没有日期后缀
```

### 启动自动上传服务

#### Windows用户（推荐）

```bash
# 启动定时服务
start-scheduler.bat

# 测试功能
test-scheduler.bat
```

#### 命令行方式

```bash
# 安装依赖
npm install

# 启动定时服务
npm run scheduler

# 测试模式（立即执行一次）
npm run scheduler:test

# 开发模式（自动重启）
npm run scheduler:dev
```

### 推送Plus配置

1. 访问 [推送Plus官网](http://www.pushplus.plus/)
2. 微信扫码登录获取Token
3. 将Token添加到 `.env` 文件：
   ```env
   PUSHPLUS_TOKEN=your_pushplus_token
   ```

### 通知功能

- **系统通知**：Windows系统托盘通知
- **微信推送**：通过推送Plus发送详细的上传结果
- **控制台日志**：详细的执行日志和上传链接

## 使用方法

### 基本用法

```javascript
const GitHubImageHostService = require('./src/githubImageHostService');

// 初始化服务
const imageHost = new GitHubImageHostService(
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_USERNAME,
    process.env.GITHUB_REPOSITORY
);

// 上传base64图片
const imageUrl = await imageHost.uploadBase64Image(base64Data, 'my-image.jpg');

// 上传本地文件
const imageUrl2 = await imageHost.uploadFile('./local-image.jpg', 'uploaded-image.jpg');

// 检查文件是否存在
const exists = await imageHost.fileExists('my-image.jpg');

// 生成唯一文件名
const uniqueName = imageHost.generateUniqueFilename('image.jpg', 'photos');
```

### Express.js 集成示例

```javascript
const express = require('express');
const GitHubImageHostService = require('./src/githubImageHostService');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 初始化GitHub图床服务
const imageHost = new GitHubImageHostService(
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_USERNAME,
    process.env.GITHUB_REPOSITORY
);

// 上传图片接口
app.post('/api/upload', async (req, res) => {
    try {
        const { base64Data, filename } = req.body;
        
        if (!base64Data) {
            return res.status(400).json({ error: '缺少图片数据' });
        }
        
        // 生成唯一文件名
        const uniqueFilename = filename ? 
            imageHost.generateUniqueFilename(filename) : 
            imageHost.generateUniqueFilename('image.jpg');
        
        // 上传图片
        const imageUrl = await imageHost.uploadBase64Image(base64Data, uniqueFilename);
        
        if (imageUrl) {
            res.json({ success: true, url: imageUrl, filename: uniqueFilename });
        } else {
            res.status(500).json({ error: '图片上传失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('GitHub图床服务运行在 http://localhost:3000');
});
```

## API 文档

### GitHubImageHostService

#### 构造函数

```javascript
new GitHubImageHostService(token, username, repository)
```

- `token` (string): GitHub Personal Access Token
- `username` (string): GitHub用户名
- `repository` (string): GitHub仓库名

#### 方法

##### uploadBase64Image(base64Data, filename)

上传base64编码的图片到GitHub仓库。

- `base64Data` (string): base64编码的图片数据
- `filename` (string): 目标文件名
- 返回: `Promise<string|null>` - 图片URL或null（失败时）

##### uploadFile(filePath, filename)

上传本地文件到GitHub仓库。

- `filePath` (string): 本地文件路径
- `filename` (string): 目标文件名
- 返回: `Promise<string|null>` - 图片URL或null（失败时）

##### fileExists(filename)

检查文件是否已存在于仓库中。

- `filename` (string): 文件名
- 返回: `Promise<boolean>` - 是否存在

##### generateUniqueFilename(originalFilename, prefix)

生成唯一的文件名。

- `originalFilename` (string): 原始文件名
- `prefix` (string): 前缀，默认为 'images'
- 返回: `string` - 唯一文件名

## 故障排除

### 常见问题

**1. GitHub Token权限不足**
```
❌ 401 Unauthorized
```
**解决方案**：
- 确保Token具有 `repo` 权限
- 检查Token是否过期
- 重新生成Token

**2. 仓库不存在或无权访问**
```
❌ 404 Not Found
```
**解决方案**：
- 确保仓库名称正确
- 确保仓库存在且可访问
- 检查用户名是否正确

**3. 网络连接问题**
```
❌ Network Error
```
**解决方案**：
- 检查网络连接
- 确认GitHub服务状态
- 尝试使用代理

### 获取帮助

如果遇到其他问题：
1. 查看 [USAGE.md](./USAGE.md) 详细使用指南
2. 查看 [PROJECT.md](./PROJECT.md) 技术文档
3. 检查控制台错误信息
4. 确认所有配置项都已正确填写

## 注意事项

1. **仓库限制**：GitHub仓库有大小限制，建议定期清理不需要的图片
2. **访问速度**：GitHub在某些地区访问可能较慢，建议配合CDN使用
3. **Token安全**：请妥善保管GitHub Token，不要提交到代码仓库
4. **文件大小**：建议单个文件不超过25MB
5. **仓库类型**：建议使用公开仓库，私有仓库的图片链接需要认证才能访问
6. **定期测试**：定期运行测试确保服务正常运行

## 许可证

MIT License
