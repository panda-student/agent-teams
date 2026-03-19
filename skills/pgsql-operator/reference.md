# PostgreSQL 操作详细指南

## 一、数据库连接

### 环境变量配置

#### .env 文件位置
数据库配置默认从项目根目录的 `.env` 文件读取。

#### .env 文件内容
在项目根目录创建 `.env` 文件：
```env
# PostgreSQL 数据库连接配置
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# 可选：连接池配置
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=30
```

#### DATABASE_URL 格式说明
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=[模式]
```

**示例：**
```env
# 本地开发环境
DATABASE_URL="postgresql://postgres:123456@localhost:5432/mydb?schema=public"

# 生产环境
DATABASE_URL="postgresql://admin:secure_password@prod-db.example.com:5432/production_db?schema=public"

# Docker 环境
DATABASE_URL="postgresql://postgres:password@postgres:5432/mydb?schema=public"
```

### 连接测试

#### 方法1：使用 Prisma CLI
```bash
# 测试数据库连接
npx prisma db pull

# 查看数据库信息
npx prisma db execute --stdin <<< "SELECT version();"
```

#### 方法2：使用脚本文件
```bash
# 创建测试脚本
TEMP_FILE=$(mktemp)
cat > $TEMP_FILE << 'EOF'
SELECT version();
SELECT current_database();
SELECT current_user;
EOF

# 执行测试
npx prisma db execute --file $TEMP_FILE

# 清理
rm -f $TEMP_FILE
```

### 常见连接问题

#### 问题1：找不到 .env 文件
**错误信息**：`Environment variable not found: DATABASE_URL`

**解决方案**：
```bash
# 检查 .env 文件是否存在
ls -la .env

# 如果不存在，创建 .env 文件
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/mydb"' > .env
```

#### 问题2：连接被拒绝
**错误信息**：`Connection refused`

**解决方案**：
```bash
# 检查 PostgreSQL 服务是否运行
# Linux/Mac
sudo systemctl status postgresql

# Windows
# 检查服务管理器中 PostgreSQL 服务状态

# 检查端口是否开放
netstat -an | grep 5432
```

#### 问题3：认证失败
**错误信息**：`authentication failed for user`

**解决方案**：
```bash
# 检查用户名和密码是否正确
# 检查 pg_hba.conf 配置
sudo cat /etc/postgresql/*/main/pg_hba.conf
```

---

## 二、脚本执行流程（推荐）

### 为什么使用脚本文件？
- ✅ **批量执行**：支持大量 SQL 指令
- ✅ **逻辑统一**：所有操作通过脚本文件执行
- ✅ **命令简洁**：只需一条命令执行整个脚本
- ✅ **易于调试**：可以预览和检查 SQL 内容
- ✅ **安全可控**：执行前可以审查所有操作

### 脚本执行步骤

#### 步骤1：生成临时 SQL 脚本
```bash
# 创建临时脚本文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)
```

#### 步骤2：写入 SQL 语句
```bash
# 写入单条 SQL
echo "SELECT * FROM users WHERE id = 1;" > $TEMP_FILE

# 写入多条 SQL（批量操作）
cat > $TEMP_FILE << 'EOF'
-- 查询用户
SELECT * FROM users WHERE status = 'active';

-- 更新状态
UPDATE users SET last_login = NOW() WHERE id = 1;

-- 插入日志
INSERT INTO logs (user_id, action, created_at) VALUES (1, 'login', NOW());
EOF
```

#### 步骤3：预览和确认
```bash
# 显示脚本内容供用户确认
cat $TEMP_FILE
```

#### 步骤4：执行脚本
```bash
# 执行 SQL 脚本
npx prisma db execute --file $TEMP_FILE
```

#### 步骤5：清理临时文件
```bash
# 删除临时脚本
rm -f $TEMP_FILE
```

### 完整示例
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入 SQL
cat > $TEMP_FILE << 'EOF'
-- 批量操作示例
BEGIN;

-- 插入用户
INSERT INTO users (name, email) VALUES ('张三', 'zhang@example.com');

-- 更新统计
UPDATE statistics SET user_count = user_count + 1;

-- 记录日志
INSERT INTO logs (action, created_at) VALUES ('user_created', NOW());

COMMIT;
EOF

# 3. 预览确认
echo "即将执行的 SQL："
cat $TEMP_FILE
read -p "确认执行？(y/n): " confirm

# 4. 执行
if [ "$confirm" = "y" ]; then
    npx prisma db execute --file $TEMP_FILE
    echo "执行成功！"
fi

# 5. 清理
rm -f $TEMP_FILE
```

---

## 三、数据查询操作

### 基础查询
```sql
SELECT * FROM users WHERE id = 1;
```

执行方式：
```bash
echo "SELECT * FROM users WHERE id = 1;" | npx prisma db execute --stdin
```

### 复杂查询
```sql
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC;
```

## 三、数据操作

### 插入数据
```sql
INSERT INTO users (name, email, created_at)
VALUES ('张三', 'zhangsan@example.com', NOW());
```

### 更新数据
```sql
UPDATE users
SET name = '李四', updated_at = NOW()
WHERE id = 1;
```

### 删除数据
```sql
DELETE FROM users WHERE id = 1;
```

**注意**：删除操作需要用户确认！

## 四、数据库管理

### 创建表
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 创建索引
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 查看表结构
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

## 五、安全最佳实践

### 1. 参数化查询
避免 SQL 注入：
```javascript
// ❌ 错误
const sql = `SELECT * FROM users WHERE name = '${userName}'`;

// ✅ 正确
const sql = 'SELECT * FROM users WHERE name = $1';
const params = [userName];
```

### 2. 事务处理
```sql
BEGIN;
  INSERT INTO orders (user_id, total) VALUES (1, 100.00);
  UPDATE users SET balance = balance - 100.00 WHERE id = 1;
COMMIT;
```

### 3. 权限最小化
- 只授予必要的权限
- 避免使用超级用户
- 定期审计权限

## 六、性能优化

### 查询优化
- 使用 EXPLAIN ANALYZE 分析查询
- 创建合适的索引
- 避免 SELECT *

### 索引优化
```sql
-- 查看索引使用情况
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 七、备份与恢复

### 备份数据库
```bash
npx prisma db pull
npx prisma migrate dev --name backup
```

### 恢复数据库
```bash
npx prisma migrate reset
npx prisma db push
```

## 八、常见问题

### Q1: 连接超时
**A**: 检查网络连接和防火墙设置

### Q2: 权限不足
**A**: 检查数据库用户权限

### Q3: 查询慢
**A**: 使用 EXPLAIN ANALYZE 分析，创建索引

## 九、工具推荐

- **Prisma Studio**: 可视化数据库管理
  ```bash
  npx prisma studio
  ```

- **Prisma Migrate**: 数据库迁移工具
  ```bash
  npx prisma migrate dev --name init
  ```
