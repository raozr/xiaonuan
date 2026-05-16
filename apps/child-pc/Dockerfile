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

# 复制配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/child-pc/package.json ./apps/child-pc/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/skills/package.json ./packages/skills/

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

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动 child-pc 服务
CMD ["pnpm", "--filter", "@xiaonuan/child-pc", "start"]
