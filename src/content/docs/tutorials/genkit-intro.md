---
title: 'Genkit 入门教程'
description: 'Google Genkit (Go) 框架入门：模型集成、结构化输出、流程定义、调试与 CLI 使用'
order: 1
tags:
  - genkit
  - go
  - ai
---

## 1. 简介

- 教程：https://genkit.org.cn/docs/go/overview/
- 是什么：Genkit 是 Google 推出的开源框架，用于构建全栈、AI 驱动和智能代理应用。它提供了一个统一的接口，用于集成来自众多模型提供商的 AI 模型，让您可以根据需求选用最合适的模型。通过针对多模态内容、结构化输出、工具调用和智能代理工作流的精简 API，快速构建并部署生产级的 AI 驱动和智能代理应用（如聊天机器人、自动化系统、推荐系统等）。

### 核心功能

Genkit 提供的一些关键功能包括：

- [文本和图像生成](https://genkit.org.cn/docs/go/models/)
- [类型安全的结构化数据生成](https://genkit.org.cn/docs/models#structured-output)
- [工具调用](https://genkit.org.cn/docs/go/tool-calling/)
- [提示词模板](https://genkit.org.cn/docs/go/dotprompt/)
- [持久化聊天接口](https://genkit.org.cn/docs/go/chat/)
- [AI 工作流](https://genkit.org.cn/docs/go/flows/)
- [AI 驱动的数据检索 (RAG)](https://genkit.org.cn/docs/go/rag/)

Genkit 专为多种语言环境下的服务端部署而设计，同时通过专用的辅助工具和[客户端 SDK](https://genkit.org.cn/docs/js/deployment/firebase/) 提供无缝的客户端集成。

|                        |                                                              |
| ---------------------- | ------------------------------------------------------------ |
| **广泛的 AI 模型支持** | 使用统一的接口与来自 [Google](https://genkit.org.cn/docs/go/integrations/google-genai/)、[OpenAI](https://genkit.org.cn/docs/go/integrations/openai/)、[Anthropic](https://genkit.org.cn/docs/go/integrations/anthropic/)、[Ollama](https://genkit.org.cn/docs/go/integrations/ollama/) 等提供商的数百个模型进行集成。探索、比较并使用最适合您需求的模型。 |
| **简化的 AI 开发**     | 利用简化的 API 构建 AI 功能，支持[结构化输出](https://genkit.org.cn/docs/models#structured-output)、[智能体工具调用](https://genkit.org.cn/docs/go/tool-calling/)、[上下文感知生成](https://genkit.org.cn/docs/go/rag/)、[多模态输入/输出](https://genkit.org.cn/docs/models#multimodal-input)等。Genkit 处理了 AI 开发的复杂性，让您能够更快地构建和迭代。 |
| **支持 Web 和移动端**  | 使用专用的[客户端 SDK](https://genkit.org.cn/docs/js/deployment/firebase/) 和辅助工具，与 Next.js、React、Angular、iOS 和 Android 等框架及平台无缝集成。 |
| **跨语言支持**         | 使用最适合您项目的语言进行构建。Genkit 提供 JavaScript/TypeScript、Go、Python 和 Dart SDK，并在所有支持的语言中提供一致的 API 和功能。 |
| **随处部署**           | 将 AI 逻辑部署到任何支持您所选编程语言的环境中，例如 [Cloud Functions for Firebase](https://genkit.org.cn/docs/js/deployment/firebase/)、[Google Cloud Run](https://genkit.org.cn/docs/go/deployment/cloud-run/) 或[第三方平台](https://genkit.org.cn/docs/go/deployment/any-platform/)（无论是否使用 Google 服务）。 |
| **开发者工具**         | 使用专门构建的本地 [CLI 和开发人员 UI](https://genkit.org.cn/docs/go/devtools/) 加速 AI 开发。针对单个输入或数据集测试提示词（prompts）和流程，比较不同模型的输出，通过详细的执行追踪进行调试，并利用即时视觉反馈快速迭代提示词。 |
| **生产监控**           | 利用全面的生产监控，自信地交付 AI 功能。在[专用仪表板](https://genkit.org.cn/docs/go/observability/getting-started/)中跟踪模型性能、请求量、延迟和错误率。通过详细的观测指标快速识别问题，并确保您的 AI 功能在实际使用中达到质量和性能目标。 |

## 2. Quickstart

### 1. 前置

- Go 1.24 或更高版本（[下载并安装](https://golang.ac.cn/doc/install)）
- Genkit CLI：`curl -sL cli.genkit.dev | bash` 或者 NPM `npm install -g genkit-cli`
  - 这使您能够访问本地开发工具，包括开发者 UI (Developer UI)。
- 模型 API 密钥：默认是 gemini 模型，可从 Google AI Studio 获取 API 密钥，其他模型也支持在 `github.com/firebase/genkit/go/plugins/compat_oai` 这个包

### 2. 第一个程序

- 初始化项目：

  ```shell
  mkdir genkit-intro && cd genkit-intro

  go mod init example/genkit-intro

  # 安装 Go 版 Genkit 软件包
  go get github.com/firebase/genkit/go
  ```

- main.go

  ```go
  package main

  import (
  	"context"
  	"encoding/json"
  	"fmt"
  	"log"
  	"net/http"
  	"os"
  	"path/filepath"
  	"strings"

  	"github.com/firebase/genkit/go/ai"
  	"github.com/firebase/genkit/go/genkit"
  	"github.com/firebase/genkit/go/plugins/compat_oai"
  	"github.com/firebase/genkit/go/plugins/server"
  )

  // RecipeInput Define input schema
  type RecipeInput struct {
  	Ingredient          string `json:"ingredient" jsonschema:"description=Main ingredient or cuisine type"`
  	DietaryRestrictions string `json:"dietaryRestrictions,omitempty" jsonschema:"description=Any dietary restrictions"`
  }

  // Recipe Define output schema
  type Recipe struct {
  	Title        string   `json:"title"`
  	Description  string   `json:"description"`
  	PrepTime     string   `json:"prepTime"`
  	CookTime     string   `json:"cookTime"`
  	Servings     int      `json:"servings"`
  	Ingredients  []string `json:"ingredients"`
  	Instructions []string `json:"instructions"`
  	Tips         []string `json:"tips,omitempty"`
  }

  func main() {
  	// 先加载 .env，否则下面的配置和 HTTPS_PROXY 都读不到
  	loadDotEnv()

  	ctx := context.Background()

  	// 自定义模型：任何 OpenAI 兼容接口都可以，配置见项目根目录 .env
  	provider := envOr("CUSTOM_MODEL_PROVIDER", "custom")
  	modelID := envOr("CUSTOM_MODEL_ID", "gpt-4o-mini")
  	baseURL := os.Getenv("CUSTOM_API_BASE_URL")
  	apiKey := os.Getenv("CUSTOM_API_KEY")

  	switch {
  	case baseURL == "":
  		log.Fatal("缺少 CUSTOM_API_BASE_URL：请在项目根目录的 .env 里填写中转站地址")
  	case apiKey == "":
  		log.Fatal("缺少 CUSTOM_API_KEY：请在项目根目录的 .env 里填写密钥")
  	}
  	log.Printf("模型 %s/%s @ %s", provider, modelID, baseURL)

  	// Initialize Genkit with the OpenAI-compatible plugin
  	g := genkit.Init(ctx,
  		genkit.WithPlugins(&compat_oai.OpenAICompatible{
  			Provider: provider,
  			APIKey:   apiKey,
  			BaseURL:  baseURL,
  		}),
  		genkit.WithDefaultModel(provider+"/"+modelID))

  	// Define a recipe generator flow
  	recipeFlow := genkit.DefineFlow(g, "recipeGeneratorFlow", func(ctx context.Context, input *RecipeInput) (*Recipe, error) {
  		// Create a prompt based on the input
  		dietaryRestrictions := input.DietaryRestrictions
  		if dietaryRestrictions == "" {
  			dietaryRestrictions = "none"
  		}

  		prompt := fmt.Sprintf(`Create a recipe with the following requirements:
               Main ingredient: %s
               Dietary restrictions: %s`, input.Ingredient, dietaryRestrictions)

  		// Generate structured recipe data using the same schema
  		recipe, _, err := genkit.GenerateData[Recipe](ctx, g,
  			ai.WithPrompt(prompt),
  		)
  		if err != nil {
  			return nil, fmt.Errorf("failed to generate recipe: %w", err)
  		}

  		return recipe, nil
  	})
  	// Run the flow once to test it.
  	// 失败不再终止进程：上游偶发 5xx，接口不可达时也需要能起服务。
  	recipe, err := recipeFlow.Run(ctx, &RecipeInput{
  		Ingredient:          "avocado",
  		DietaryRestrictions: "vegetarian",
  	})
  	if err != nil {
  		log.Printf("warn: 启动自检失败，服务仍会启动: %v", err)
  	} else {
  		// Print the structured recipe
  		recipeJSON, _ := json.MarshalIndent(recipe, "", "  ")
  		fmt.Println("Sample recipe generated:")
  		fmt.Println(string(recipeJSON))
  	}

  	// Start a server to serve the flow and keep the app running for the Developer UI
  	mux := http.NewServeMux()
  	mux.HandleFunc("POST /recipeGeneratorFlow", genkit.Handler(recipeFlow))

  	log.Println("Starting server on http://localhost:3400")
  	log.Println("Flow available at: POST http://localhost:3400/recipeGeneratorFlow")
  	log.Fatal(server.Start(ctx, "127.0.0.1:3400", mux))
  }

  // envOr returns the environment variable or fallback when it is empty.
  func envOr(key, fallback string) string {
  	if v := os.Getenv(key); v != "" {
  		return v
  	}
  	return fallback
  }

  // loadDotEnv reads the nearest .env, walking up from the working directory, and
  // sets each key in the process environment. Variables already present in the
  // real environment always win, so `FOO=bar go run .` overrides the file.
  func loadDotEnv() {
  	dir, err := os.Getwd()
  	if err != nil {
  		return
  	}
  	for range 4 {
  		path := filepath.Join(dir, ".env")
  		if data, err := os.ReadFile(path); err == nil {
  			applyDotEnv(string(data))
  			log.Printf("已加载 %s", path)
  			return
  		}
  		parent := filepath.Dir(dir)
  		if parent == dir {
  			return
  		}
  		dir = parent
  	}
  }

  // applyDotEnv parses the subset of dotenv syntax the project uses: blank lines,
  // `#` comments, an optional `export ` prefix, and optionally quoted values.
  func applyDotEnv(content string) {
  	for _, line := range strings.Split(content, "\n") {
  		line = strings.TrimSpace(line)
  		if line == "" || strings.HasPrefix(line, "#") {
  			continue
  		}
  		key, value, ok := strings.Cut(strings.TrimPrefix(line, "export "), "=")
  		if !ok {
  			continue
  		}
  		key = strings.TrimSpace(key)
  		value = strings.TrimSpace(value)
  		if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
  			value = value[1 : len(value)-1]
  		}
  		if key == "" || os.Getenv(key) != "" {
  			continue
  		}
  		os.Setenv(key, value)
  	}
  }
  ```

- 此代码示例：

  - 使用带有 JSON 模式标签的 Go 结构体定义可重用的输入和输出模式
  - 使用自定义模型，从 .env 中获取模型配置
  - 定义一个 Genkit 流程，根据您的输入生成结构化食谱
  - 使用示例输入运行流程，并打印结构化的结果

- 为什么要使用 Flow？

  - **类型安全的输入和输出**：为您的数据定义明确的架构。
  - **与开发者 UI 集成**：可视化测试和调试流程。
  - **轻松作为 API 部署**：将流程部署为 HTTP 端点。
  - **内置追踪与可观测性**：监控性能并调试问题。

### 3. 运行

- 运行：`go run .`，会看到 JSON 格式的结构化食谱输出，随后服务器会在 `http://localhost:3400` 启动。服务器将持续运行，以 HTTP 端点的形式为您的流程提供服务，并启用开发者 UI。

## 3. 调试

### 1. HTTP 调试

```bash
curl -s -X POST "http://localhost:3400/recipeGeneratorFlow" \
  -H "Content-Type: application/json" \
  -d '{"data": {"ingredient": "tomato", "dietaryRestrictions": "vegan"}}' \
  | jq .result
```

### 2. 开发者 UI 调试

- 根目录启动：`genkit start -- go run .`

- 默认：http://localhost:4000

- 在 flow 中选择 recipeGeneratorFlow

  ```json
  {
    "ingredient": "avocado",
    "dietaryRestrictions": "vegetarian"
  }
  ```

- run 后可以看到追踪效果

## 4. genkit cli

### 1. 命令行界面 (CLI)

```shell
genkit --help
```

CLI 支持多种命令，以方便开发 Genkit 项目：

- `genkit start -- <运行代码的命令>`：启动开发者 UI 并将其连接到正在运行的代码进程。
- `genkit flow:run <flowName>`：运行指定的流。您的运行时必须已在单独的终端中运行，并设置了 `GENKIT_ENV=dev` 环境变量。
- `genkit eval:flow <flowName>`：评估特定的流。您的运行时必须已在单独的终端中运行，并设置了 `GENKIT_ENV=dev` 环境变量。

```shell
genkit start -- go run .
genkit start -- go run main.go
```

- 您也可以在启动命令中添加 `-o` 选项，以自动在默认浏览器标签页中打开开发者 UI。

```shell
genkit start -o -- <command to run your code>
```

### 2. 分析

Genkit CLI 和开发者 UI 使用来自 Google 的 Cookie 和类似技术，以提供和提升服务质量，并分析使用情况。[了解更多](https://policies.google.com/technologies/cookies)。

如需退出分析，您可以运行以下命令：

```shell
genkit config set analyticsOptOut true
```

您可以通过运行以下命令查看当前设置：

```shell
genkit config get analyticsOptOut
```
