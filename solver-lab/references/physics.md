# 物理参考 — 公式库、量纲与口径

物理层是 SOLID_GEOMETRY 没有、本 skill 新增的模块：39 条高中公式注册成表，每条声明变量量纲，**求值前校验单位、求值后回代**。

## 1. spec 格式

```jsonc
{
  "domain": "physics",
  "task": "physics.formula",
  "givens": {
    "id": "kinematics.velocity",     // 公式 id（见下表）
    "target": "v",                   // 要求的量（公式变量之一）
    "knowns": {                      // 已知量：{ value, unit }
      "v0": { "value": 36, "unit": "km/h" },
      "a":  { "value": 2,  "unit": "m/s²" },
      "t":  { "value": 3,  "unit": "s" }
    }
  }
}
```

- `unit` 可省略 → 用公式声明单位（此时 value 按公式单位理解）；
- 单位制自动换算：`km/h` → `m/s`（×1000/3600），`g`→`kg`、`km`→`m`、`min`→`s`、`kN`→`N` 等；
- 量纲真冲突（如加速度给成 `m`）→ 整体失败，`summary` 说明"单位不一致"及原因，**不出数字**。

## 2. 单位解析能力

- 基础单位：`m, s, kg, A, K, mol, cd`（及中文别名 米/秒/千克）；
- 复合单位：`m/s`、`m/s²`、`N·m`、`N·m²/kg²`、`Ω·m`、`kg·m/s`；
- 上标写法：`m/s^2`、`m/s²`、`m^3`、`m³`；
- 乘号写法：`·`、`*`、`×`；
- 前缀：`k, m, μ/n, c, M, G, T, p, n`（千米 km、毫秒 ms、微法 μF、纳秒 ns……）；
- 角度：`°` / `deg` 按度处理（`sin` 等三角函数求值时角度按度，非弧度）；
- 无量纲量（摩擦系数 μ、折射率 n）：单位写 `1` 或省略。

## 3. 公式注册表

### 运动学

| id | 名称 | 公式 | 变量（单位） |
|---|---|---|---|
| `kinematics.velocity` | 速度与时间 | v = v₀ + a·t | v(m/s), v₀(m/s), a(m/s²), t(s) |
| `kinematics.displacement` | 位移与时间 | s = v₀·t + ½·a·t² | s(m), v₀, a, t |
| `kinematics.velocity-displacement` | 速度与位移 | v² = v₀² + 2·a·s | v, v₀, a, s |
| `kinematics.average` | 平均速度 | s = (v₀+v)·t/2 | s, v₀, v, t |
| `kinematics.free-fall` | 自由落体 | v = g·t；h = ½·g·t²；v² = 2·g·h | v, h(m), t, g(m/s²) |
| `kinematics.projectile` | 平抛运动 | x = v₀·t；y = ½·g·t² | x(m), y(m), v₀, t, g |

### 力学

| id | 名称 | 公式 | 变量（单位） |
|---|---|---|---|
| `mechanics.newton` | 牛顿第二定律 | F = m·a | F(N), m(kg), a |
| `mechanics.weight` | 重力 | G = m·g | G(N), m, g |
| `mechanics.friction` | 滑动摩擦力 | f = μ·N | f(N), μ(1), N(N) |
| `mechanics.hooke` | 胡克定律 | F = k·x | F(N), k(N/m), x(m) |
| `mechanics.work` | 功 | W = F·s | W(J), F(N), s(m) |
| `mechanics.power` | 功率 | P = W/t | P(W), W(J), t(s) |
| `mechanics.power-velocity` | 功率与速度 | P = F·v | P(W), F(N), v(m/s) |
| `mechanics.kinetic` | 动能 | Ek = ½·m·v² | Ek(J), m, v |
| `mechanics.potential` | 重力势能 | Ep = m·g·h | Ep(J), m, g, h(m) |
| `mechanics.momentum` | 动量 | p = m·v | p(kg·m/s), m, v |
| `mechanics.impulse` | 动量定理 | F·t = m·v − m·v₀ | F, t, m, v, v₀ |
| `mechanics.centripetal` | 向心力 | F = m·v²/r | F, m, v, r(m) |
| `mechanics.gravitation` | 万有引力 | F = G·M·m/r² | F, G(N·m²/kg²), M(kg), m, r |

### 电磁学

| id | 名称 | 公式 | 变量（单位） |
|---|---|---|---|
| `em.ohm` | 欧姆定律 | I = U/R | I(A), U(V), R(Ω) |
| `em.resistance` | 电阻定律 | R = ρ·L/S | R(Ω), ρ(Ω·m), L(m), S(m²) |
| `em.series` | 串联电阻 | R = R₁ + R₂ | R, R₁, R₂ (Ω) |
| `em.parallel` | 并联电阻 | 1/R = 1/R₁ + 1/R₂ | R, R₁, R₂ (Ω) |
| `em.power` | 电功率 | P = U·I | P(W), U(V), I(A) |
| `em.joule-heat` | 焦耳热 | Q = I²·R·t | Q(J), I, R, t |
| `em.work` | 电流做功 | W = U·I·t | W(J), U, I, t |
| `em.coulomb` | 库仑定律 | F = k·q₁·q₂/r² | F(N), k(N·m²/C²), q₁/q₂(C), r(m) |
| `em.field-force` | 电场力 | F = q·E | F(N), q(C), E(N/C) |
| `em.field-uniform` | 匀强电场 | E = U/d | E(V/m), U(V), d(m) |
| `em.lorentz` | 洛伦兹力 | F = q·v·B | F(N), q(C), v, B(T) |
| `em.ampere-force` | 安培力 | F = B·I·L | F(N), B(T), I(A), L(m) |
| `em.flux` | 磁通量 | Φ = B·S | Φ(Wb), B(T), S(m²) |
| `em.faraday` | 法拉第电磁感应 | E = ΔΦ/Δt | emf(V), ΔΦ(Wb), Δt(s) |
| `em.capacitance` | 电容 | C = Q/U | C(F), Q(C), U(V) |

### 光学

| id | 名称 | 公式 | 变量（单位） |
|---|---|---|---|
| `optics.snell` | 折射定律 | n₁·sin i = n₂·sin r | n₁/n₂(1), i/r(°) |
| `optics.critical` | 全反射临界角 | sin C = 1/n | C(°), n(1) |
| `optics.lens` | 透镜成像公式 | 1/u + 1/v = 1/f | u/v/f(m) |
| `optics.magnification` | 放大率 | k = \|v\|/u | k(1), u, v |
| `optics.refractive-speed` | 折射率与光速 | n = c/v | n(1), c/v(m/s) |

## 4. 多解与代入串

- `target` 缺省时自动选公式主变量（如 `kinematics.velocity` → `v`）；
- 一元二次型目标（如 `v² = v₀² + 2as` 求 v）返回数组 `value: [正, 负]`，summary 用"或"连接；
- `answer.result.substitution` 是代入串（如 `v = 10 + 2×3`），数值求值器支持 `+ − × ÷ ^`、括号、`sin/cos/tan`（角度按度）、`√`；
- `answer.result.note` 提示特殊情形（如分母为零、结果为负的物理含义）。

**多子句公式**（`；` 分隔，如自由落体 `v = g·t；h = ½·g·t²；v² = 2·g·h`）：缺失量检测按**目标所在子句**判定——求 v 只需 g/t，不会误报缺少 h。求解实现的是主子句路径（自由落体求 v 走 v = g·t）；经替代路径反解（如由 g、h 求 v 走 v² = 2gh）暂不支持，会以致命值错误明确拒绝，不编造结果。

## 5. 常数

`CONSTANTS = { g: 9.8, G: 6.67e-11, k: 9e9, c: 3e8 }`，题目给重力加速度时以题目为准，未给且公式需要时可在 knowns 里显式传 `g`。

## 6. 自检

- 注册期：39 条公式全部过量纲审计（等式两边量纲相等）；
- 求值后：把解代回公式重算，与声明值比较（回代校验）；
- 单位换算：`convertQuantity` 可单独使用，如 `72 km/h → 20 m/s`。
