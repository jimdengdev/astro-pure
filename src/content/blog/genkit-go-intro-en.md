---
title: '[Part 1] Genkit Go Quickstart: Setup, Flows, and Debugging'
description: 'A hands-on intro to the Genkit Go framework: setup, your first flow, wiring an OpenAI-compatible model, plus HTTP and Developer UI debugging and CLI usage.'
publishDate: '2026-10-12'
tags:
  - Genkit
  - Go
  - AI
  - Agent
series: 'genkit-go'
language: 'English'
link: 'genkit-go-intro'
---

## 1. Introduction

- Tutorial: <https://genkit.org.cn/docs/go/overview/>
- What it is: Genkit is an open-source framework from Google for building full-stack, AI-powered and agentic applications. It provides a unified interface for integrating AI models from many model providers, so you can pick the model that fits your needs. With streamlined APIs for multimodal content, structured outputs, tool calling and agentic workflows, you can quickly build and deploy production-ready AI-powered and agentic applications such as chatbots, automations and recommendation systems.

### Key Capabilities

Genkit ships with a set of core capabilities:

- [Text and image generation](https://genkit.org.cn/docs/go/models/)
- [Type-safe, structured data generation](https://genkit.org.cn/docs/models#structured-output)
- [Tool calling](https://genkit.org.cn/docs/go/tool-calling/)
- [Prompt templating](https://genkit.org.cn/docs/go/dotprompt/)
- [Persisted chat interfaces](https://genkit.org.cn/docs/go/chat/)
- [AI workflows](https://genkit.org.cn/docs/go/flows/)
- [AI-powered data retrieval (RAG)](https://genkit.org.cn/docs/go/rag/)

Genkit is designed for server-side deployment in multiple language environments, while dedicated helper tools and the [client SDK](https://genkit.org.cn/docs/js/deployment/firebase/) provide seamless client-side integration.

| Capability                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Broad AI model support**    | Integrate hundreds of models from [Google](https://genkit.org.cn/docs/go/integrations/google-genai/), [OpenAI](https://genkit.org.cn/docs/go/integrations/openai/), [Anthropic](https://genkit.org.cn/docs/go/integrations/anthropic/), [Ollama](https://genkit.org.cn/docs/go/integrations/ollama/) and other providers through a unified interface. Explore, compare and use the model that best fits your needs.                        |
| **Simplified AI development** | Build AI features with streamlined APIs that support [structured output](https://genkit.org.cn/docs/models#structured-output), [agentic tool calling](https://genkit.org.cn/docs/go/tool-calling/), [context-aware generation](https://genkit.org.cn/docs/go/rag/) and [multimodal input/output](https://genkit.org.cn/docs/models#multimodal-input). Genkit handles the complexity of AI development so you can build and iterate faster. |
| **Web and mobile ready**      | Use dedicated [client SDKs](https://genkit.org.cn/docs/js/deployment/firebase/) and helper tools to integrate seamlessly with frameworks and platforms such as Next.js, React, Angular, iOS and Android.                                                                                                                                                                                                                                   |
| **Cross-language support**    | Build with the language that suits your project. Genkit provides JavaScript/TypeScript, Go, Python and Dart SDKs, with consistent APIs and capabilities across all supported languages.                                                                                                                                                                                                                                                    |
| **Deploy anywhere**           | Deploy your AI logic to any environment that supports your chosen language, such as [Cloud Functions for Firebase](https://genkit.org.cn/docs/js/deployment/firebase/), [Google Cloud Run](https://genkit.org.cn/docs/go/deployment/cloud-run/) or [third-party platforms](https://genkit.org.cn/docs/go/deployment/any-platform/) — with or without Google services.                                                                      |
| **Developer tools**           | Speed up AI development with a purpose-built local [CLI and Developer UI](https://genkit.org.cn/docs/go/devtools/). Test prompts and flows against a single input or a dataset, compare outputs across models, debug through detailed execution traces, and iterate on prompts with instant visual feedback.                                                                                                                               |
| **Production monitoring**     | Ship AI features with confidence using comprehensive production monitoring. Track model performance, request volume, latency and error rates in a [dedicated dashboard](https://genkit.org.cn/docs/go/observability/getting-started/). Spot issues quickly with detailed observability metrics and make sure your AI features meet their quality and performance targets in real-world usage.                                              |

## 2. Quickstart

### 1. Prerequisites

- Go 1.24 or later ([download and install](https://golang.ac.cn/doc/install))
- Genkit CLI: `curl -sL cli.genkit.dev | bash` or via NPM `npm install -g genkit-cli`
  - This gives you access to the local developer tools, including the Developer UI.
- A model API key: the default is a Gemini model, and you can get an API key from Google AI Studio. Other models are also supported through the `github.com/firebase/genkit/go/plugins/compat_oai` package.

### 2. Your First Program

Initialize the project:

```shell
mkdir genkit-intro && cd genkit-intro

go mod init example/genkit-intro

# Install the Genkit Go package
go get github.com/firebase/genkit/go
```

main.go:

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
	// Load .env first, otherwise the config below and HTTPS_PROXY won't be picked up
	loadDotEnv()

	ctx := context.Background()

	// Custom model: any OpenAI-compatible endpoint works; see .env in the project root
	provider := envOr("CUSTOM_MODEL_PROVIDER", "custom")
	modelID := envOr("CUSTOM_MODEL_ID", "gpt-4o-mini")
	baseURL := os.Getenv("CUSTOM_API_BASE_URL")
	apiKey := os.Getenv("CUSTOM_API_KEY")

	switch {
	case baseURL == "":
		log.Fatal("Missing CUSTOM_API_BASE_URL: set the proxy endpoint in the project's .env")
	case apiKey == "":
		log.Fatal("Missing CUSTOM_API_KEY: set the API key in the project's .env")
	}
	log.Printf("Model %s/%s @ %s", provider, modelID, baseURL)

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
	// Don't kill the process on failure: upstream 5xx errors happen intermittently,
	// and the server should still start when the API is unreachable.
	recipe, err := recipeFlow.Run(ctx, &RecipeInput{
		Ingredient:          "avocado",
		DietaryRestrictions: "vegetarian",
	})
	if err != nil {
		log.Printf("warn: startup self-check failed, server will still start: %v", err)
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
			log.Printf("Loaded %s", path)
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

What this example does:

- Defines reusable input and output schemas with Go structs that carry JSON schema tags.
- Uses a custom model, reading the model config from `.env`.
- Defines a Genkit flow that generates a structured recipe from your input.
- Runs the flow with sample input and prints the structured result.

Why use flows?

- **Type-safe input and output**: define explicit schemas for your data.
- **Developer UI integration**: test and debug flows visually.
- **Easy to deploy as an API**: expose flows as HTTP endpoints.
- **Built-in tracing and observability**: monitor performance and debug issues.

### 3. Run It

Run `go run .` and you will see a structured recipe printed as JSON, after which the server starts on `http://localhost:3400`. The server keeps running, serving your flow as an HTTP endpoint and enabling the Developer UI.

## 3. Debugging

### 1. Debug over HTTP

```bash
curl -s -X POST "http://localhost:3400/recipeGeneratorFlow" \
  -H "Content-Type: application/json" \
  -d '{"data": {"ingredient": "tomato", "dietaryRestrictions": "vegan"}}' \
  | jq .result
```

### 2. Debug with the Developer UI

Start it from the project root:

```shell
genkit start -- go run .
```

Default address: <http://localhost:4000>

Select `recipeGeneratorFlow` in the flow list and provide:

```json
{
  "ingredient": "avocado",
  "dietaryRestrictions": "vegetarian"
}
```

Click run and you will see the trace of the execution.

## 4. Genkit CLI

### 1. Command-Line Interface (CLI)

```shell
genkit --help
```

The CLI supports several commands to make developing Genkit projects easier:

- `genkit start -- <command to run your code>`: starts the Developer UI and connects it to the running code process.
- `genkit flow:run <flowName>`: runs the given flow. Your runtime must already be running in a separate terminal with the `GENKIT_ENV=dev` environment variable set.
- `genkit eval:flow <flowName>`: evaluates the given flow. Your runtime must already be running in a separate terminal with the `GENKIT_ENV=dev` environment variable set.

```shell
genkit start -- go run .
genkit start -- go run main.go
```

You can also pass the `-o` flag to the start command to open the Developer UI automatically in your default browser tab.

```shell
genkit start -o -- <command to run your code>
```

### 2. Analytics

The Genkit CLI and Developer UI use cookies and similar technologies from Google to provide and improve the quality of the service and to analyze usage. [Learn more](https://policies.google.com/technologies/cookies).

To opt out of analytics, run:

```shell
genkit config set analyticsOptOut true
```

You can check the current setting by running:

```shell
genkit config get analyticsOptOut
```
