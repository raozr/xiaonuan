# 使用 Node.js 22 作为基础镜像
FROM node:22-alpine AS base

# 设置工作目录
WORKDIR /app

# 第一阶段：安装依赖并构建
FROM base AS build

# 安装 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 复制配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/child-pc/package.json ./apps/child-pc/

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# 复制所有源代码
COPY . .

# 构建 child-pc
RUN APP_ENV=docker pnpm --filter @xiaonuan/child-pc build

# 第二阶段：运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

# 复制 monorepo 根目录依赖（next 在根 node_modules 中）
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

# 复制 child-pc 应用
COPY --from=build /app/apps/child-pc ./apps/child-pc

# 复制 standalone 所需的静态文件和公共资源
COPY --from=build /app/apps/child-pc/.next/static ./apps/child-pc/.next/standalone/apps/child-pc/.next/static
COPY --from=build /app/apps/child-pc/public ./apps/child-pc/.next/standalone/apps/child-pc/public

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV PATH="/app/node_modules/.bin:$PATH"

# 暴露端口
EXPOSE 3000

# 直接用 node 运行 next
WORKDIR /app/apps/child-pc
CMD ["node", ".next/standalone/apps/child-pc/server.js"]
