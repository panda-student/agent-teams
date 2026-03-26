/**
 * Agent Teams - 工具函数
 *
 * 提供通用的工具函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * 获取ISO时间戳
 * @returns {string} ISO格式时间戳
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 安全读取JSON文件
 * @param {string} filePath - 文件路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的数据或默认值
 */
function readJSON(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`读取JSON失败: ${filePath}`, error.message);
  }
  return defaultValue;
}

/**
 * 安全写入JSON文件
 * @param {string} filePath - 文件路径
 * @param {*} data - 数据
 * @param {boolean} pretty - 是否美化输出
 */
function writeJSON(filePath, data, pretty = true) {
  ensureDir(path.dirname(filePath));
  const content = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 安全读取YAML文件（简化版，只支持基本解析）
 * @param {string} filePath - 文件路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的数据或默认值
 */
function readYAML(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return parseSimpleYAML(content);
    }
  } catch (error) {
    console.error(`读取YAML失败: ${filePath}`, error.message);
  }
  return defaultValue;
}

/**
 * 简单YAML解析器（支持嵌套对象和数组）
 * @param {string} content - YAML内容
 * @returns {object} 解析后的对象
 */
function parseSimpleYAML(content) {
  const lines = content.split('\n');
  const root = {};
  const stack = [{ obj: root, indent: -1, key: null, isArray: false }];
  let currentArrayItem = null;
  let currentArrayItemIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const top = stack[stack.length - 1];
    currentArrayItem = null;

    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();

      if (Array.isArray(top.obj)) {
        if (value.includes(': ')) {
          const colonIndex = value.indexOf(': ');
          const key = value.slice(0, colonIndex);
          const val = value.slice(colonIndex + 2);
          const newObj = { [key]: parseValue(val) };
          top.obj.push(newObj);
          currentArrayItem = newObj;
          currentArrayItemIndent = indent;

          const nextLine = lines[i + 1] || '';
          const nextIndent = nextLine.search(/\S/);
          if (nextIndent > indent && !nextLine.trim().startsWith('-')) {
            stack.push({ obj: newObj, indent: indent, key: null, isArray: false });
          }
        } else {
          top.obj.push(parseValue(value));
        }
      }
      continue;
    }

    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      let targetObj = top.obj;
      if (currentArrayItem && indent > currentArrayItemIndent && !Array.isArray(top.obj)) {
        targetObj = top.obj;
      }

      if (value === '' || value.startsWith('|')) {
        const nextLine = lines[i + 1] || '';
        const nextIndent = nextLine.search(/\S/);
        if (nextLine.trim().startsWith('-')) {
          targetObj[key] = [];
          stack.push({ obj: targetObj[key], indent: indent, key: key, isArray: true });
        } else if (nextIndent > indent) {
          targetObj[key] = {};
          stack.push({ obj: targetObj[key], indent: indent, key: key, isArray: false });
        } else {
          targetObj[key] = value === '|' ? '' : parseValue(value);
        }
      } else {
        targetObj[key] = parseValue(value);
      }
    }
  }

  return root;
}

/**
 * 解析YAML值
 * @param {string} value - 字符串值
 * @returns {*} 解析后的值
 */
function parseValue(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(item => parseValue(item.trim()));
  }

  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;

  return value;
}

/**
 * 对象转YAML字符串（简化版）
 * @param {object} obj - 对象
 * @param {number} indent - 缩进级别
 * @returns {string} YAML字符串
 */
function toYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${spaces}${key}: null`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${spaces}${key}: []`);
      } else {
        lines.push(`${spaces}${key}:`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const itemLines = [];
            for (const [k, v] of Object.entries(item)) {
              if (v === null || v === undefined) continue;
              if (Array.isArray(v)) {
                if (v.length === 0) {
                  itemLines.push(`${k}: []`);
                } else if (v.every(x => typeof x === 'string' || typeof x === 'number')) {
                  itemLines.push(`${k}: [${v.map(x => formatYAMLValue(x)).join(', ')}]`);
                } else {
                  const subLines = [`${k}:`];
                  for (const subItem of v) {
                    if (typeof subItem === 'object' && subItem !== null) {
                      subLines.push(`  - ${JSON.stringify(subItem)}`);
                    } else {
                      subLines.push(`  - ${formatYAMLValue(subItem)}`);
                    }
                  }
                  itemLines.push(subLines.join('\n' + spaces + '    '));
                }
              } else if (typeof v === 'object') {
                itemLines.push(`${k}: ${JSON.stringify(v)}`);
              } else {
                itemLines.push(`${k}: ${formatYAMLValue(v)}`);
              }
            }
            lines.push(`${spaces}  - ${itemLines.join('\n' + spaces + '    ')}`);
          } else {
            lines.push(`${spaces}  - ${formatYAMLValue(item)}`);
          }
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${spaces}${key}:`);
      lines.push(toYAML(value, indent + 1));
    } else {
      lines.push(`${spaces}${key}: ${formatYAMLValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * 格式化YAML值
 * @param {*} value - 值
 * @returns {string} 格式化后的字符串
 */
function formatYAMLValue(value) {
  if (typeof value === 'string') {
    if (/[:#\[\]{}|>]/.test(value) || value.includes('\n')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value === null) return 'null';
  return String(value);
}

/**
 * 安全写入YAML文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 数据
 */
function writeYAML(filePath, data) {
  ensureDir(path.dirname(filePath));
  const content = `# 自动生成 - ${getTimestamp()}\n\n` + toYAML(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 追加写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 */
function appendFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content + '\n', 'utf-8');
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {string|null} 文件内容或null
 */
function readFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
  }
  return null;
}

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 列出目录中的文件
 * @param {string} dirPath - 目录路径
 * @param {string} pattern - 文件模式（简化版，仅支持扩展名）
 * @returns {string[]} 文件列表
 */
function listFiles(dirPath, pattern = null) {
  try {
    if (!fs.existsSync(dirPath)) return [];

    const files = fs.readdirSync(dirPath);
    if (pattern) {
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        return files.filter(f => f.endsWith(ext));
      }
      return files.filter(f => f.includes(pattern));
    }
    return files;
  } catch (error) {
    console.error(`列出目录失败: ${dirPath}`, error.message);
    return [];
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`删除文件失败: ${filePath}`, error.message);
  }
}

/**
 * 计算简单校验和
 * @param {string} content - 内容
 * @returns {string} 校验和
 */
function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

module.exports = {
  generateId,
  getTimestamp,
  ensureDir,
  readJSON,
  writeJSON,
  readYAML,
  writeYAML,
  appendFile,
  readFile,
  writeFile,
  listFiles,
  deleteFile,
  checksum,
  parseSimpleYAML,
  toYAML
};
