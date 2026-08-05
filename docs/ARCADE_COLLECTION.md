# Axirune Arcade Collection

Axirune Arcade 是一个真实运行的浏览器应用集合：20 款 Classic
Collection 短篇作品之外，0.6 版新增独立四幕旗舰战役 River Oath。21
款作品拥有独立名称、规则程序、状态与交互闭环。它们借鉴早期家用
主机与横版街机“规则清晰、反馈直接、难度逐级提升”的设计方法，但
角色、世界、关卡、数值曲线、程序、界面、图像与音频均由本项目
原创或取得明确授权。

River Oath 的三英雄、四关、十二波、Boss、道具、分支、独立引擎及
素材来源记录在 [`RIVER_OATH.md`](RIVER_OATH.md)。本文件以下目录仍专门
描述稳定的 20 款 Classic Collection，因此其 18+2 统计保持不变。

这组作品同时验证一条重要工程边界：Axirune 负责生成经过类型检查和权限验证的规则合同；宿主 TypeScript 引擎负责高频模拟；Canvas 负责绘制状态。网站不依赖大模型才能启动或游玩，也不把宿主实现包装成语言自身的能力。

## 职责边界

一次 Classic World 会经历以下链路：

1. 浏览器读取对应的 `.axi` 源码。
2. Axirune 编译器生成 Execution Capsule（`.axc`）。
3. 宿主独立校验 Capsule 的结构、完整性、Checked IR 与 authority manifest。
4. 只有验证成功且权限清单为空的 Capsule 才能执行。
5. Axirune 程序根据 `stage`、`score`、`streak` 等输入返回有界规则合同。
6. TypeScript 引擎在固定时间步中消费合同与显式输入，推进物理、碰撞、实体、计分和阶段状态。
7. Canvas 读取当前状态并绘制；React 负责作品选择、规则编辑器、HUD 和控制按钮。

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Axirune | 规则输入校验、难度参数、节奏、重力、敌方速度、生成间隔、奖励与阶段合同 | 每帧物理、碰撞检测、Canvas 绘制、浏览器事件循环 |
| Capsule 验证层 | 内容与语义摘要、IR 完整性、权限清单、预算和错误关闭 | 自动授予宿主能力 |
| TypeScript 引擎 | 固定步进、Seed RNG、输入消费、状态机、实体生命周期、碰撞和快照 | 临时向规则程序增加网络、文件或模型能力 |
| React / Canvas | 导航、编辑器、HUD、键盘与触屏适配、状态呈现 | 决定规则合同或伪造 Capsule 验证结果 |

规则程序不会在每个动画帧重新编译。它在会话开始及相应的 stage、wave、round 或 turn 转换点重新求值；实时循环继续使用最近一次验证通过的合同。规则求值失败时，宿主保留错误并停止应用未经验证的新合同。

## 版权与发布边界

可以借鉴的是抽象机制和通用节奏，例如移动、跳跃、反弹、波次、收集、路线规划、回合推进、逐阶段加速与检查点。下列具体表达必须原创或拥有可核验的授权：

- 游戏名称、副标题、Logo 和宣传文案；
- 角色名称、轮廓、比例、服装、配色、动作与背景设定；
- 敌人、首领、道具、载具和能力图标；
- 地图几何、关卡路线、障碍位置、隐藏内容、生成序列和数值表；
- Sprite、模型、贴图、背景、特效、字体、HUD、菜单与动画帧；
- 音乐旋律、编曲、录音、采样和音效；
- 剧情、对白、教程、成就、规则说明和源代码。

仅改变颜色、尺寸或名称不足以形成独立作品。公开页面、下载包和源代码中都不得包含未经授权的第三方游戏素材、提取数据、关卡数据或反编译代码。每项资产应保留作者、来源、许可证、生成或制作过程以及文件哈希；游戏名称发布前还应完成商标和近似商业印象检索。免责声明不能替代原创设计或授权。

## 20 款作品与规则路径

Catalog 使用八个稳定的引擎族描述控制面和固定步进频率。18 款紧凑作品复用 `src/arcade/classics/micro-engine.ts` 的确定性状态框架；Vector Siege 与 Prism Bastion 使用各自经过专门测试的引擎。`18 + 2` 是实现分层，不表示 18 款拥有相同规则或仅更换外观。

| # | 作品 | 层级 | 引擎族 / 频率 | Axirune 规则源码 |
| ---: | --- | --- | --- | --- |
| 01 | Aetherstep Foundry | Shared | `platform-field` / 120 Hz | `apps/arcade/classics/aetherstep-foundry.axi` |
| 02 | Bastion Treads | Shared | `projectile-field` / 60 Hz | `apps/arcade/classics/bastion-treads.axi` |
| 03 | Sunwake Corsairs | Shared | `projectile-field` / 60 Hz | `apps/arcade/classics/sunwake-corsairs.axi` |
| 04 | Vector Siege | Flagship | `projectile-field` / 60 Hz | `apps/arcade/vector-siege.axi` |
| 05 | Emberglass Atlas | Shared | `grid-field` / 20 Hz | `apps/arcade/classics/emberglass-atlas.axi` |
| 06 | Moonthread Ronin | Shared | `platform-field` / 120 Hz | `apps/arcade/classics/moonthread-ronin.axi` |
| 07 | Alloy Tempest | Shared | `projectile-field` / 60 Hz | `apps/arcade/classics/alloy-tempest.axi` |
| 08 | Chromaline Circuit | Shared | `lane-field` / 60 Hz | `apps/arcade/classics/chromaline-circuit.axi` |
| 09 | Dustcoil Courier | Shared | `lane-field` / 60 Hz | `apps/arcade/classics/dustcoil-courier.axi` |
| 10 | Prism Stack | Shared | `falling-grid` / 30 Hz | `apps/arcade/classics/prism-stack.axi` |
| 11 | Glyph Current | Shared | `collection-field` / 60 Hz | `apps/arcade/classics/glyph-current.axi` |
| 12 | Vault Cartographer | Shared | `grid-field` / 20 Hz | `apps/arcade/classics/vault-cartographer.axi` |
| 13 | Sparkcell Siege | Shared | `projectile-field` / 60 Hz | `apps/arcade/classics/sparkcell-siege.axi` |
| 14 | Neon Coil | Shared | `grid-field` / 20 Hz | `apps/arcade/classics/neon-coil.axi` |
| 15 | Prism Bastion | Flagship | `ricochet-field` / 120 Hz | `apps/arcade/prism-break.axi` |
| 16 | Orbit Foundry | Shared | `arena-field` / 60 Hz | `apps/arcade/classics/orbit-foundry.axi` |
| 17 | Lumen Labyrinth | Shared | `grid-field` / 20 Hz | `apps/arcade/classics/lumen-labyrinth.axi` |
| 18 | Harbor Brawl | Shared | `arena-field` / 60 Hz | `apps/arcade/classics/harbor-brawl.axi` |
| 19 | Circuit Strikers | Shared | `arena-field` / 60 Hz | `apps/arcade/classics/circuit-strikers.axi` |
| 20 | Signal Bloom | Shared | `collection-field` / 60 Hz | `apps/arcade/classics/signal-bloom.axi` |

### 八个引擎族

| 引擎族 | 固定步进 | 标准控制 | Catalog 中的作品 |
| --- | ---: | --- | --- |
| `projectile-field` | 60 Hz | 双轴移动、主/副动作、暂停 | Bastion Treads、Sunwake Corsairs、Vector Siege、Alloy Tempest、Sparkcell Siege |
| `ricochet-field` | 120 Hz | 横轴、发射、能力、暂停 | Prism Bastion |
| `grid-field` | 20 Hz | 双轴移动、主动作、暂停 | Emberglass Atlas、Vault Cartographer、Neon Coil、Lumen Labyrinth |
| `lane-field` | 60 Hz | 双轴移动、主动作、暂停 | Chromaline Circuit、Dustcoil Courier |
| `platform-field` | 120 Hz | 横轴、跳跃、主动作、暂停 | Aetherstep Foundry、Moonthread Ronin |
| `falling-grid` | 30 Hz | 横轴、旋转、软降、硬降、暂停 | Prism Stack |
| `collection-field` | 60 Hz | 双轴移动、主动作、暂停 | Glyph Current、Signal Bloom |
| `arena-field` | 60 Hz | 双轴移动、主/副动作、暂停 | Orbit Foundry、Harbor Brawl、Circuit Strikers |

引擎族是输入和调度合同，不是玩法模板。每款作品仍有自己的初始化状态、目标、状态转换、规则程序、视觉方向和机制专属测试。

## Capsule 与零权限运行

18 款 Shared 作品返回 `axirune-arcade/classic/1` 合同，并分别拥有唯一的源码、space 和 Capsule 内容摘要。两款 Flagship 使用自己的规则 schema。网站展示的 `contentId`、`semanticDigest`、Capsule 字节数和 trace 长度来自真实编译及执行结果，而不是静态标签。

Arcade 的规则层必须满足以下条件：

- Capsule 完整性和 Checked IR 验证通过；
- authority manifest 与 IR 推导结果一致；
- capabilities、tools、permissions 和 sandbox 请求均为空；
- 不调用网络、文件系统、MCP、模型、Prompt 或 Agent；
- 同一规则输入得到相同合同；
- 合同字段经过 schema、范围和有限数校验；
- 新源码只有在重新编译和验证后才会替换当前合同。

这是一种“无外部权限的确定性规则模块”，不是由生成式服务临时决定游戏结果。

## 键盘、指针与触屏

网页统一支持方向键或 `WASD` 移动、`Space` 主动作、`Shift` 副动作、`P` 暂停，并按不同引擎族解释动作。触屏布局提供方向区、主动作和副动作按钮；需要位置输入的作品还能读取 Canvas 指针坐标。Pointer capture 与 cancel/leave 处理用于避免触控离开按钮后产生粘滞输入。

每款作品必须显示可读的控制提示，并提供开始、暂停/继续、重新开始和退出路径。重新开始恢复相同的初始 Seed，因此既适合玩家重试，也适合自动化重放。

## 确定性与快照

确定性条件是：相同规则合同、初始 Seed、固定时间步和输入序列产生相同状态。引擎状态显式保存 tick、阶段、分数、生命、随机数状态、玩家、实体、投射物、粒子、棋盘和输入锁存信息；模拟逻辑不从渲染帧率推导游戏时间。

Shared 引擎通过 `snapshotClassicWorld` 生成带 schema 的 JSON 安全快照，并由 `restoreClassicWorld` 校验和恢复。恢复后的状态继续消费相同输入时，必须与未中断的原状态完全一致。两款 Flagship 保持各自的快照与回放合同，并由专属测试覆盖。

核心验证命令：

```sh
npm test -- tests/arcade tests/language/classic-world-rules.test.ts tests/language/arcade-rules.test.ts
```

## Benchmark

Classic benchmark 只测状态推进，不测 Canvas 绘制或浏览器合成。它以固定 Seed 和固定输入脚本遍历 18 款 Shared 作品，记录 step throughput、确定性双回放摘要、最终状态和实体峰值；两款 Flagship 在同一 JSON 报告中明确列为独立实现，避免把不同引擎的数字混为一组。

工具链构建会生成 benchmark 所需的 `dist-toolchain` JavaScript：

```sh
npm run build:toolchain
```

报告默认写入 stdout，也可用 `--out` 生成网站发布 JSON：

```sh
node scripts/benchmark-classics.mjs \
  --steps 6000 --warmup 600 --seed 0x4a17c0de --pretty \
  --out public/classics-benchmark-results.json
```

报告 schema 为 `axirune-benchmark/classics/1`。契约测试验证 18 个实测项、2 个独立 Flagship 项、20 个唯一 ID、摘要一致性和实体上限：

```sh
npx vitest run tests/arcade/classics-benchmark-contract.test.ts
```

throughput 受 Node 版本、CPU、电源策略和后台负载影响，只适合在固定环境中做回归比较；确定性摘要和边界结果才应跨重复运行保持一致。

## 发布验收标准

“Catalog 中存在一张卡片”不等于作品完成。发布声明必须由 20 款逐项证据支持，不能只抽查部分作品。

### 自动化门槛

每款作品必须满足：

1. ID、名称、规则路径、引擎族和固定步进与 Catalog 一致；
2. `.axi` 能编译、验证并返回本作品 schema，且 20 个内容摘要互不混用；
3. authority manifest 为空，篡改或错配的 Capsule 被拒绝；
4. 玩家输入产生可观察状态变化，而不是仅播放预制动画；
5. 回放覆盖得分或进度、受击或失败、阶段完成或明确里程碑、重新开始；
6. 同一 Seed 和输入的两次回放得到相同快照；
7. 快照往返后继续运行仍与原状态一致；
8. 至少一个机制专属断言，不能只依赖通用 tick 测试；
9. 长回放中所有数值有限，实体数量不超过声明上限；
10. 规则参数改变会引起预期的可观察行为变化，证明 `.axi` 不是装饰文件。

### 浏览器门槛

每款作品还必须在真实浏览器中逐项通过：

- 从自己的卡片进入可操作场景，且 Capsule 验证证据可见；
- 键盘完成一次有效动作，移动触屏完成一次有效动作；
- HUD、游戏状态与 Canvas 画面随操作变化；
- 能达到一次得分/进度事件和一次失败、完成或里程碑状态；
- 暂停冻结状态，重新开始恢复初始条件；
- 桌面和移动视口均无裁切、遮挡或不可点击控件；
- 无未捕获异常、失败资源请求、外部网络请求或重复动画循环；
- 开始、游玩中和终局分别保留桌面与移动截图作为发布证据。

自动化 benchmark 证明引擎可重复且有边界；浏览器验收证明用户确实能够完成交互闭环。两者都通过，才能把某一项计入“20 款可玩作品”。
