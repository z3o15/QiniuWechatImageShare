# 自动上传功能使用指南

## 快速开始

### 1. 环境配置

1. **复制配置文件**
   ```bash
   copy .env.example .env
   ```

2. **编辑配置文件**
   打开 `.env` 文件，填入以下配置：
   ```env
   # GitHub配置（必需）
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   GITHUB_USERNAME=your_username
   GITHUB_REPOSITORY=your_image_repo
   
   # 推送Plus配置（可选）
   PUSHPLUS_TOKEN=your_pushplus_token
   ```

### 2. 获取GitHub Token

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 设置Token名称，如："Image Host Service"
4. 选择权限：勾选 `repo` (完整仓库访问权限)
5. 点击 "Generate token"
6. 复制生成的Token到 `.env` 文件

### 3. 创建GitHub仓库

1. 在GitHub上创建新的**公开**仓库
2. 仓库名建议：`image-host` 或 `images`
3. 将仓库名填入 `.env` 文件

### 4. 获取推送Plus Token（可选）

1. 访问 [推送Plus官网](http://www.pushplus.plus/)
2. 微信扫码登录
3. 复制Token到 `.env` 文件

## 启动服务

### Windows用户（推荐）

双击运行 `start-scheduler.bat` 文件，程序会：
- 自动检查环境
- 安装依赖
- 启动定时服务

### 命令行用户

```bash
# 安装依赖
npm install

# 启动定时服务
npm run scheduler
```

## 测试功能

### 1. 创建测试文件

在桌面创建一个测试文件，文件名格式：`meet测试20241220.txt`
（将日期替换为当天日期）

### 2. 运行测试

双击运行 `test-scheduler.bat` 或执行：
```bash
npm run scheduler:test
```

### 3. 查看结果

- **控制台输出**：显示详细的执行日志和上传链接
- **系统通知**：Windows托盘通知
- **微信推送**：如果配置了推送Plus，会收到微信消息

## 文件命名规则

### 正确格式

文件名必须：
- 以 `meet` 开始（不区分大小写）
- 以当天日期 `YYYYMMDD` 结束
- 中间可以包含任意内容

### 示例

假设今天是2024年12月20日：

✅ **正确的文件名：**
```
meet-会议记录20241220.pdf
meetingNotes20241220.docx
meet项目讨论20241220.txt
meet20241220.jpg
MEET-重要会议20241220.pptx
```

❌ **错误的文件名：**
```
meeting20241219.pdf          # 日期不是当天
document20241220.pdf         # 不以meet开始
meet-notes.pdf               # 没有日期后缀
meet-20241220-old.pdf        # 日期不在末尾
```

## 定时任务说明

- **执行时间**：每天上午9:00
- **检查目录**：当前用户的桌面文件夹
- **文件类型**：支持所有文件类型（图片、文档、视频等）
- **上传位置**：GitHub仓库的 `meet-files/` 目录下

## 通知功能

### 系统通知

- 服务启动通知
- 文件上传成功/失败通知
- 错误提醒

### 微信推送（需配置推送Plus）

- **服务启动**：发送启动确认消息
- **上传成功**：显示文件列表和访问链接
- **上传失败**：显示失败原因和解决建议
- **无文件**：提醒文件命名规则

## 常见问题

### Q: 为什么没有找到文件？
A: 请检查：
- 文件是否在桌面文件夹
- 文件名是否以 `meet` 开始
- 文件名是否以当天日期结束
- 日期格式是否正确（YYYYMMDD）

### Q: 上传失败怎么办？
A: 请检查：
- GitHub Token是否正确且有效
- 网络连接是否正常
- 仓库是否存在且有写入权限
- 文件大小是否超过25MB

### Q: 没有收到微信推送？
A: 请检查：
- 推送Plus Token是否正确
- 是否关注了推送Plus公众号
- 网络是否能访问推送Plus服务

### Q: 如何停止服务？
A: 在运行窗口按 `Ctrl+C` 或直接关闭窗口

### Q: 如何修改执行时间？
A: 编辑 `src/autoUploadScheduler.js` 文件中的 cron 表达式：
```javascript
// 当前：每天9:00
cron.schedule('0 9 * * *', () => {

// 改为每天8:30
cron.schedule('30 8 * * *', () => {

// 改为每2小时执行一次
cron.schedule('0 */2 * * *', () => {
```

## 安全提醒

1. **保护Token**：不要将 `.env` 文件提交到代码仓库
2. **定期轮换**：建议定期更新GitHub Token
3. **权限最小化**：只给Token必要的权限
4. **监控使用**：定期检查仓库大小和API使用情况

## 技术支持

如果遇到问题，请：
1. 查看控制台错误日志
2. 检查 `.env` 配置是否正确
3. 确认网络连接正常
4. 验证GitHub Token权限

---

**祝您使用愉快！** 🎉