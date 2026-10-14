---
title: 'DAG 有向无环图与拓扑排序'
publishDate: '2026-07-12T23:00:00'
description: '介绍有向无环图（DAG）的概念与性质，讲解拓扑排序的两种经典实现——Kahn 算法（BFS）与 DFS 回溯，并给出完整的 Go 代码实现、复杂度分析及实际应用场景。'
tags:
  - 'Go语言'
  - '算法'
  - '图论'
  - 'DAG'
  - '拓扑排序'
  - '笔记'
  - '后端'
comment: true
---

## 什么是 DAG

**DAG**（Directed Acyclic Graph，有向无环图）是一种特殊的有向图，它满足两个条件：

1. **有向**：每条边都有方向，从起点指向终点
2. **无环**：图中不存在从某个顶点出发，沿着边方向最终又回到该顶点的路径

```plain
    ┌───┐     ┌───┐     ┌───┐
    │ A │ ──▶ │ B │ ──▶ │ D │
    └───┘     └───┘     └───┘
      │         │         ▲
      │         ▼         │
    ┌───┐     ┌───┐       │
    │ C │ ──▶ │ E │ ──────┘
    └───┘     └───┘
```

上图就是一个典型的 DAG：边有方向，且无论从哪个节点出发都无法回到自身。

### DAG 的关键性质

- **拓扑序存在**：DAG 一定存在至少一种拓扑排序
- **可检测环**：如果一个有向图能完成拓扑排序，则它是 DAG；反之存在环
- **最长路径可解**：在 DAG 上求最长路径是多项式可解的（一般图上是 NP-hard）
- **偏序关系**：DAG 天然表示元素间的偏序（partial order）关系

## 什么是拓扑排序

**拓扑排序**（Topological Sort）是将 DAG 的所有顶点排成一个线性序列，使得对图中的任意一条有向边 `(u, v)`，`u` 在序列中都出现在 `v` 之前。

简单来说：**如果 A 指向 B，那么 A 必须排在 B 前面。**

### 经典应用场景

| 场景         | 依赖关系                           |
| ------------ | ---------------------------------- |
| 课程安排     | 课程 B 的先修课是课程 A            |
| 编译依赖     | 模块 B 依赖模块 A 的编译产物       |
| 任务调度     | 任务 B 必须在任务 A 完成后才能开始 |
| 包管理       | 包 B 依赖包 A，安装时需先装 A      |
| 数据处理管道 | ETL 任务间的执行先后               |

> [!note]
> 拓扑排序的结果**不唯一**。一个 DAG 可能有多种合法的拓扑序列。

## 算法一：Kahn 算法（BFS）

Kahn 算法的核心思想是**不断移除入度为 0 的节点**：

1. 计算所有节点的入度
2. 将入度为 0 的节点入队
3. 每次从队列取出一个节点，加入结果序列
4. 将该节点的所有邻居入度减 1，若邻居入度变为 0 则入队
5. 重复直到队列为空

如果最终结果序列包含所有节点，说明是 DAG；否则图中存在环。

### Go 实现

```go
package main

import "fmt"

// Graph 表示有向图（邻接表 + 入度表）
type Graph struct {
	nodes    []string          // 节点列表（保序）
	adjList  map[string][]string // 邻接表
	inDegree map[string]int    // 入度表
}

// NewGraph 创建一个空图
func NewGraph() *Graph {
	return &Graph{
		adjList:  make(map[string][]string),
		inDegree: make(map[string]int),
	}
}

// AddEdge 添加一条有向边 from -> to
func (g *Graph) AddEdge(from, to string) {
	// 首次出现的节点初始化入度
	if _, ok := g.inDegree[from]; !ok {
		g.inDegree[from] = 0
		g.nodes = append(g.nodes, from)
	}
	if _, ok := g.inDegree[to]; !ok {
		g.inDegree[to] = 0
		g.nodes = append(g.nodes, to)
	}

	g.adjList[from] = append(g.adjList[from], to)
	g.inDegree[to]++
}

// TopologicalSortKahn 使用 Kahn 算法进行拓扑排序
// 返回排序结果和是否存在环
func (g *Graph) TopologicalSortKahn() ([]string, bool) {
	// 复制入度表，避免修改原始数据
	inDegree := make(map[string]int, len(g.inDegree))
	for k, v := range g.inDegree {
		inDegree[k] = v
	}

	// 初始化队列：所有入度为 0 的节点入队
	queue := []string{}
	for _, node := range g.nodes {
		if inDegree[node] == 0 {
			queue = append(queue, node)
		}
	}

	result := []string{}
	for len(queue) > 0 {
		// 出队
		curr := queue[0]
		queue = queue[1:]
		result = append(result, curr)

		// 遍历邻居，入度减 1
		for _, neighbor := range g.adjList[curr] {
			inDegree[neighbor]--
			if inDegree[neighbor] == 0 {
				queue = append(queue, neighbor)
			}
		}
	}

	// 若结果包含所有节点，说明是 DAG
	if len(result) == len(g.nodes) {
		return result, true
	}
	// 否则存在环
	return result, false
}

func main() {
	g := NewGraph()
	// 构建上图对应的 DAG
	g.AddEdge("A", "B")
	g.AddEdge("A", "C")
	g.AddEdge("B", "D")
	g.AddEdge("B", "E")
	g.AddEdge("C", "E")
	g.AddEdge("E", "D")

	result, ok := g.TopologicalSortKahn()
	if !ok {
		fmt.Println("图中存在环，无法进行拓扑排序")
		return
	}
	fmt.Println("Kahn 拓扑排序结果:", result)
	// 输出示例: [A B C E D] 或 [A C B E D] 等（不唯一）
}
```

### 复杂度分析

| 维度       | 复杂度       |
| ---------- | ------------ |
| 时间复杂度 | \(O(V + E)\) |
| 空间复杂度 | \(O(V + E)\) |

其中 \(V\) 是顶点数，\(E\) 是边数。每个节点和每条边各被处理一次。

## 算法二：DFS 深度优先回溯

DFS 方法的核心思想是**后序遍历的逆序**：

1. 对每个未访问的节点执行 DFS
2. 在 DFS 递归返回时（即节点的所有邻居都已访问完毕），将节点压入栈
3. 最终栈的弹出顺序就是拓扑排序结果

### 环检测

在 DFS 过程中维护三种状态：

- **0（未访问）**：节点尚未被访问
- **1（访问中）**：节点正在被访问（在当前递归栈中）
- **2（已完成）**：节点及其所有后继都已访问完毕

如果在 DFS 中遇到状态为 `1` 的节点，说明**存在环**（当前递归路径上出现了回头边）。

### Go 实现

```go
package main

import "fmt"

const (
	unvisited = 0 // 未访问
	visiting  = 1 // 访问中（在当前递归栈中）
	done      = 2 // 已完成
)

// DFSGraph 基于 DFS 的有向图
type DFSGraph struct {
	nodes   []string
	adjList map[string][]string
}

func NewDFSGraph() *DFSGraph {
	return &DFSGraph{
		adjList: make(map[string][]string),
	}
}

func (g *DFSGraph) AddEdge(from, to string) {
	if _, ok := g.adjList[from]; !ok {
		g.nodes = append(g.nodes, from)
	}
	if _, ok := g.adjList[to]; !ok {
		g.nodes = append(g.nodes, to)
	}
	g.adjList[from] = append(g.adjList[from], to)
}

// TopologicalSortDFS 使用 DFS 进行拓扑排序
// 返回排序结果和是否存在环
func (g *DFSGraph) TopologicalSortDFS() ([]string, bool) {
	state := make(map[string]int, len(g.nodes))
	stack := []string{} // 用 slice 模拟栈，最终需反转

	// 从后向前遍历，保证结果与 BFS 的节点顺序风格一致
	// dfs 函数返回 false 表示检测到环
	var dfs func(node string) bool
	dfs = func(node string) bool {
		state[node] = visiting

		for _, neighbor := range g.adjList[node] {
			if state[neighbor] == visiting {
				// 遇到访问中的节点 → 存在环
				return false
			}
			if state[neighbor] == unvisited {
				if !dfs(neighbor) {
					return false
				}
			}
		}

		state[node] = done
		// 后序压栈
		stack = append(stack, node)
		return true
	}

	// 对所有未访问节点执行 DFS
	for _, node := range g.nodes {
		if state[node] == unvisited {
			if !dfs(node) {
				return nil, false
			}
		}
	}

	// 反转栈得到拓扑排序
	result := make([]string, len(stack))
	for i, v := range stack {
		result[len(stack)-1-i] = v
	}
	return result, true
}

func main() {
	g := NewDFSGraph()
	g.AddEdge("A", "B")
	g.AddEdge("A", "C")
	g.AddEdge("B", "D")
	g.AddEdge("B", "E")
	g.AddEdge("C", "E")
	g.AddEdge("E", "D")

	result, ok := g.TopologicalSortDFS()
	if !ok {
		fmt.Println("图中存在环，无法进行拓扑排序")
		return
	}
	fmt.Println("DFS 拓扑排序结果:", result)
}
```

### 复杂度分析

| 维度       | 复杂度                      |
| ---------- | --------------------------- |
| 时间复杂度 | \(O(V + E)\)                |
| 空间复杂度 | \(O(V)\)（递归栈 + 状态表） |

## 两种算法对比

| 对比维度 | Kahn 算法（BFS）               | DFS 算法                           |
| -------- | ------------------------------ | ---------------------------------- |
| 核心思想 | 逐步删除入度为 0 的节点        | 后序遍历的逆序                     |
| 实现方式 | 迭代 + 队列                    | 递归 + 栈                          |
| 环检测   | 结果节点数 < 总节点数则有环    | 递归中遇到 `visiting` 状态则有环   |
| 输出特性 | 倾向于输出"层级靠前"的节点优先 | 倾向于输出深层依赖链尾端的节点优先 |
| 适合场景 | 需要按"层级"输出、并行调度     | 需要检测环、求关键路径             |
| 递归深度 | 无递归，适合大规模图           | 深图可能栈溢出                     |

> [!tip]
> 如果需要**字典序最小的拓扑排序**，只需将 Kahn 算法中的普通队列替换为**优先队列**（最小堆），每次取出编号最小的入度为 0 的节点即可。

## 实战：课程表问题

LeetCode 207「课程表」是拓扑排序的经典应用：

> 你这个学期必须选修 `numCourses` 门课程，记为 `0` 到 `numCourses - 1`。给你一个数组 `prerequisites`，其中 `prerequisites[i] = [a, b]` 表示如果要选课程 `a` 必须**先选**课程 `b`。判断是否可能完成所有课程的学习。

```go
func canFinish(numCourses int, prerequisites [][]int) bool {
	// 构建邻接表和入度表
	adjList := make([][]int, numCourses)
	inDegree := make([]int, numCourses)

	for _, pre := range prerequisites {
		course, req := pre[0], pre[1]
		adjList[req] = append(adjList[req], course)
		inDegree[course]++
	}

	// Kahn 算法
	queue := []int{}
	for i := 0; i < numCourses; i++ {
		if inDegree[i] == 0 {
			queue = append(queue, i)
		}
	}

	count := 0
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		count++

		for _, neighbor := range adjList[curr] {
			inDegree[neighbor]--
			if inDegree[neighbor] == 0 {
				queue = append(queue, neighbor)
			}
		}
	}

	return count == numCourses
}
```

## DAG 的更多应用

### 关键路径（Critical Path）

在项目管理中，DAG 用于表示任务依赖关系。**关键路径**是从起点到终点的最长路径，决定了项目的最短完成时间。计算关键路径需要先做拓扑排序，再按拓扑序动态规划求最长路径。

```go
// CriticalPath 计算关键路径长度（基于拓扑排序 + DP）
// edges[i] = {from, to, weight}
func CriticalPath(n int, edges [][]int) int {
	adjList := make([][]int, n)
	inDegree := make([]int, n)
	weight := make(map[[2]int]int)

	for _, e := range edges {
		from, to, w := e[0], e[1], e[2]
		adjList[from] = append(adjList[from], to)
		inDegree[to]++
		weight[[2]int{from, to}] = w
	}

	// 拓扑排序
	queue := []int{}
	for i := 0; i < n; i++ {
		if inDegree[i] == 0 {
			queue = append(queue, i)
		}
	}

	dist := make([]int, n)
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		for _, next := range adjList[curr] {
			w := weight[[2]int{curr, next}]
			if dist[curr]+w > dist[next] {
				dist[next] = dist[curr] + w
			}
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	maxDist := 0
	for _, d := range dist {
		if d > maxDist {
			maxDist = d
		}
	}
	return maxDist
}
```

### 其他典型应用

- **Git 提交历史**：Git 的 commit DAG 天然是有向无环图
- **Spark/DAG 调度**：大数据计算引擎的任务调度
- **区块链 DAG**：IOTA 等项目用 DAG 替代传统链式结构
- **依赖注入容器**：Spring 等框架用拓扑排序决定 Bean 的初始化顺序

## 总结

| 要点       | 说明                                              |
| ---------- | ------------------------------------------------- |
| DAG 定义   | 有向 + 无环的图，一定存在拓扑序                   |
| 拓扑排序   | 将 DAG 节点排成线性序列，满足所有边的方向约束     |
| Kahn 算法  | BFS 思路，不断移除入度为 0 的节点，天然支持环检测 |
| DFS 算法   | 后序遍历逆序，通过三色标记法检测环                |
| 时间复杂度 | 两种算法均为 \(O(V+E)\)                           |
| 核心应用   | 任务调度、依赖解析、课程安排、关键路径            |

拓扑排序是图论中最实用的算法之一，理解了"入度为 0 先处理"和"后序逆序"这两个核心思想，就能轻松应对各种依赖关系问题。
