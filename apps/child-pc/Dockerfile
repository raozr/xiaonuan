# 使用 Node.js 22 作为基础镜像
FROM node:22-alpine AS base

# 安装 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 设置工作目录
WORKDIR /app

# 第一阶段：安装依赖并构建
FROM base AS build

# 复制配置文件（child-pc 不依赖 workspace 中的其他包，但 lockfile 是 monorepo 级别的）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/child-pc/package.json ./apps/child-pc/

# 安装依赖（跳过 postinstall 避免下载 ffmpeg-static 等不必要的二进制文件）
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# 复制所有源代码
COPY . .

# 构建 child-pc
RUN pnpm --filter @xiaonuan/child-pc build

# 第二阶段：运行阶段
FROM node:22-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=build /app ./

# 切换到项目目录运行（standalone server.js 依赖项目根目录作为 cwd）
WORKDIR /app/apps/child-pc

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动 child-pc 服务（standalone 模式必须用 node server.js，不能用 next start）
CMD ["node", ".next/standalone/apps/child-pc/server.js"]
