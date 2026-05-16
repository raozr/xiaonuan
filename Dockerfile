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
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/child-pc/package.json ./apps/child-pc/
COPY apps/mini-program/package.json ./apps/mini-program/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/skills/package.json ./packages/skills/

# 安装依赖（挂载 ffmpeg-static 下载缓存，避免重复从 GitHub 下载）
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=cache,id=ffmpeg-static,target=/root/.cache/ffmpeg-static \
    pnpm install --frozen-lockfile

# 复制所有源代码
COPY . .

# 生成 Prisma 客户端
RUN pnpm db:generate

# 构建所有项目
RUN pnpm build

# 第二阶段：运行阶段
FROM node:22-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 从构建阶段复制必要文件
# 注意：在 monorepo 中，运行 gateway 需要 workspace 中的其它 package
COPY --from=build /app ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动网关服务
CMD ["pnpm", "--filter", "@xiaonuan/gateway", "start"]
