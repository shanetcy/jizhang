# 记账

个人记账 PWA，支持欧元 / 马币 / 美元，数据只存在手机本机。

在线使用：https://shanetcy.github.io/jizhang/
（手机浏览器打开后“添加到主屏幕”，可离线使用）

## 开发

```sh
npm install
npm run dev      # 本地开发，手机同一 Wi-Fi 可访问
npm run deploy   # 构建并发布到 GitHub Pages
```

## 共同账本（Firebase）

- 配置写在 `src/firebase-config.ts`，安全规则在 `firestore.rules`（改了要复制到 Firebase 控制台发布）
- 本地测试可以用 Firebase 模拟器，不碰真实数据：
  ```sh
  npx firebase emulators:start --only auth,firestore --project demo-jizhang   # 需要 Java
  VITE_FIREBASE_EMULATOR=1 npm run dev
  ```

计划和设计说明见 [PLAN.md](PLAN.md)。
