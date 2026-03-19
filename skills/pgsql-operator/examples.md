# PostgreSQL 操作示例

## 示例 1：使用脚本文件查询用户列表（推荐）

### 用户指令
```
查询所有用户，按创建时间倒序排列
```

### 生成的临时脚本
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入 SQL
cat > $TEMP_FILE << 'EOF'
SELECT id, name, email, created_at
FROM users
ORDER BY created_at DESC;
EOF

# 3. 执行脚本
npx prisma db execute --file $TEMP_FILE

# 4. 清理临时文件
rm -f $TEMP_FILE
```

---

## 示例 2：批量插入用户（脚本方式）

### 用户指令
```
批量插入3个用户：张三、李四、王五
```

### 生成的临时脚本
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入批量 SQL
cat > $TEMP_FILE << 'EOF'
-- 批量插入用户
BEGIN;

INSERT INTO users (name, email, created_at) VALUES 
  ('张三', 'zhangsan@example.com', NOW()),
  ('李四', 'lisi@example.com', NOW()),
  ('王五', 'wangwu@example.com', NOW());

-- 记录操作日志
INSERT INTO logs (action, count, created_at) 
VALUES ('batch_insert_users', 3, NOW());

COMMIT;
EOF

# 3. 预览确认
echo "即将执行的 SQL："
cat $TEMP_FILE

# 4. 执行脚本
npx prisma db execute --file $TEMP_FILE

# 5. 清理临时文件
rm -f $TEMP_FILE
```

---

## 示例 3：复杂事务操作（脚本方式）

### 用户指令
```
创建订单并扣减库存
```

### 生成的临时脚本
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入事务 SQL
cat > $TEMP_FILE << 'EOF'
-- 订单创建事务
BEGIN;

-- 创建订单
INSERT INTO orders (user_id, total_amount, status, created_at)
VALUES (1, 299.00, 'pending', NOW())
RETURNING id;

-- 扣减库存
UPDATE products 
SET stock = stock - 1 
WHERE id = 101 AND stock > 0;

-- 记录订单日志
INSERT INTO order_logs (order_id, action, created_at)
VALUES (currval('orders_id_seq'), 'created', NOW());

COMMIT;
EOF

# 3. 预览确认
echo "即将执行的事务操作："
cat $TEMP_FILE

# 4. 执行脚本
npx prisma db execute --file $TEMP_FILE

# 5. 清理临时文件
rm -f $TEMP_FILE
```

---

## 示例 4：数据迁移脚本

### 用户指令
```
将所有未激活用户迁移到归档表
```

### 生成的临时脚本
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入迁移 SQL
cat > $TEMP_FILE << 'EOF'
-- 数据迁移脚本
BEGIN;

-- 创建归档表（如果不存在）
CREATE TABLE IF NOT EXISTS users_archive (
  id INTEGER,
  name VARCHAR(100),
  email VARCHAR(255),
  archived_at TIMESTAMP DEFAULT NOW()
);

-- 迁移未激活用户
INSERT INTO users_archive (id, name, email)
SELECT id, name, email 
FROM users 
WHERE status = 'inactive';

-- 删除已迁移用户
DELETE FROM users 
WHERE status = 'inactive';

-- 记录迁移日志
INSERT INTO migration_logs (table_name, records_moved, migrated_at)
VALUES ('users', (SELECT COUNT(*) FROM users_archive), NOW());

COMMIT;
EOF

# 3. 预览确认
echo "即将执行的迁移操作："
cat $TEMP_FILE

# 4. 执行脚本
npx prisma db execute --file $TEMP_FILE

# 5. 清理临时文件
rm -f $TEMP_FILE
```

---

## 示例 5：性能优化脚本

### 用户指令
```
为用户表创建索引并分析性能
```

### 生成的临时脚本
```bash
# 1. 创建临时文件
TEMP_FILE=$(mktemp /tmp/pgsql_operator_XXXXXX.sql)

# 2. 写入优化 SQL
cat > $TEMP_FILE << 'EOF'
-- 性能优化脚本

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 分析表
ANALYZE users;

-- 查看索引使用情况
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE tablename = 'users'
ORDER BY idx_scan DESC;
EOF

# 3. 执行脚本
npx prisma db execute --file $TEMP_FILE

# 4. 清理临时文件
rm -f $TEMP_FILE
```

---

## 示例 6：使用 Prisma Studio（可视化工具）

### 用户指令
```
打开数据库可视化工具
```

### 执行命令
```bash
npx prisma studio
```

---

## 常见错误示例

### ❌ 错误：SQL 注入风险
```sql
-- 危险！直接拼接用户输入
SELECT * FROM users WHERE name = '${userName}';
```

### ✅ 正确：使用脚本文件
```bash
# 使用参数化查询或脚本文件
TEMP_FILE=$(mktemp)
cat > $TEMP_FILE << EOF
SELECT * FROM users WHERE name = '$escaped_user_name';
EOF
npx prisma db execute --file $TEMP_FILE
rm -f $TEMP_FILE
```

### ❌ 错误：忘记清理临时文件
```bash
# 危险！临时文件会累积
TEMP_FILE="/tmp/query.sql"
echo "SELECT * FROM users;" > $TEMP_FILE
npx prisma db execute --file $TEMP_FILE
# 忘记删除临时文件
```

### ✅ 正确：始终清理临时文件
```bash
# 使用 trap 确保清理
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo "SELECT * FROM users;" > $TEMP_FILE
npx prisma db execute --file $TEMP_FILE
# 自动清理（trap 机制）
```

---

## 脚本执行优势总结

### ✅ 批量操作
- 支持大量 SQL 语句
- 事务处理更简单
- 减少网络往返

### ✅ 逻辑统一
- 所有操作通过脚本执行
- 代码更清晰易读
- 便于维护和调试

### ✅ 命令简洁
- 只需一条命令执行整个脚本
- 减少重复输入
- 降低出错概率

### ✅ 安全可控
- 执行前可以预览所有操作
- 支持事务回滚
- 临时文件自动清理

