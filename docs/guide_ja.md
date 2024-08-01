# Firebase Genkit アプリを Firebase Functions へデプロイする

備考: 以下英語記事の翻訳版なので、日本語として言い回し変なところあるかもですが、ご了承ください。
https://medium.com/@yukinagae/deploying-your-firebase-genkit-application-with-firebase-functions-99c7d0044964

---

この投稿では、Firebase Genkit アプリケーションを Firebase Functions にデプロイする手順をステップバイステップで説明します。

まずは、以下のリポジトリをクローンして、実際に手を動かしてみましょう：

```bash
git clone https://github.com/yukinagae/genkit-firebase-functions-sample.git
```

Firebase Genkit に不慣れな方は、まず [Firebase Genkit 入門](https://zenn.dev/cureapp/articles/ab5382ce510c8c) をご覧ください。Firebase Genkit の基本概念を理解するための基礎を提供します。

## デプロイの準備

アプリケーションをデプロイする前に、以下の準備手順を完了してください：

1. **Firebase プロジェクトを作成する**：
   Firebase コンソールに移動します。`Create a project` をクリックし、プロンプトに従って新しい Firebase プロジェクトを作成します。

2. **Blaze プランに切り替える**：
   Firebase Functions をデプロイするには、`Blaze (従量課金制) プラン` が必要です。Firebase コンソールでプロジェクトを選択し、左側のサイドバーセクションに移動してプランを変更します。

3. **Firebase プロジェクトをローカルに設定する**：
   プロジェクトのルートディレクトリにある `.firebaserc` ファイルを更新し、Firebase プロジェクト名を含めます：

```json
{
  "projects": {
    "default": "your_project_name"
  }
}
```

## ローカルエミュレーター

Firebase Functions のローカル開発とテストを容易にするために、Firebase Emulator Suite を使用します。以下の手順に従って、ローカルで関数を実行します：

エミュレーターを使用して Firebase Functions をローカルで実行するには、OpenAI API キーを環境変数として設定し、エミュレーターを起動します：

```bash
$ export OPENAI_API_KEY=your_api_key

$ npm run emulator
# または
$ GENKIT_ENV=dev firebase emulators:start --inspect-functions
```

エミュレーターで関数をテストするには、有効なトークン（このプロジェクトでは `token1234`）を使用して以下の curl コマンドを実行します：

```bash
$ curl -X POST -H "Content-Type: application/json" \
-H "Authorization: Bearer token1234" \
-d '{"data":{"url":"https://firebase.blog/posts/2024/04/next-announcements/","lang":"English"}}' \
http://127.0.0.1:5001/[your_project_name]/us-central1/summarizeFlow
{"result":"Firebase announced new features at Cloud Next '24, including Firestore vector search, Vertex AI SDKs, and public preview of Gemini integration."}
```

無効なトークンを使用する場合：

```bash
$ curl -X POST -H "Content-Type: application/json" \
-H "Authorization: Bearer invalid_token" \
-d '{"data":{"url":"https://firebase.blog/posts/2024/04/next-announcements/","lang":"English"}}' \
http://127.0.0.1:5001/[your_project_name]/us-central1/summarizeFlow
Unauthorized
```

トークンの検証は、`onFlow` メソッド内の `authPolicy` を通じて実装されています：

```typescript
authPolicy: {
  async policy() {},
  // Bearer トークンを使用してアクセスを制限
  async provider(req, res, next) {
    const token = req.headers.authorization?.split(/[Bb]earer /)[1];
    // ダミートークン
    if (token && token === "token1234") {
      next();
    } else {
      throw new Error("Unauthorized");
    }
  },
},
```

この実装は本番環境には適していないかもしれませんが、アプリケーションのテスト目的には十分です。

認証が不要なシナリオでは、以下のように noAuth() を使用します：

```typescript
import { noAuth } from "@genkit-ai/firebase/functions";

authPolicy: noAuth(),
```

## デプロイ

Firebase に認証してプロジェクトにアクセスするには、Firebase CLI のログインコマンドを使用します：

```bash
$ firebase login
```

Firebase Functions を使用する際に OpenAI API キーを安全に保管するために、Google Cloud Secret Manager にシークレットとして保存します：

```bash
$ firebase functions:secrets:set OPENAI_API_KEY
? Enter a value for OPENAI_API_KEY [input is hidden]
```

OpenAI API キーが正しくシークレットとして保存されていることを確認するには、次のコマンドを使用します：

```bash
$ firebase functions:secrets:access OPENAI_API_KEY
your_api_key
```

API キーを安全に保管した後、アプリケーションを Firebase Functions にデプロイする準備が整います：

```bash
$ npm run deploy
```

![Firebase GUI - your function](https://raw.githubusercontent.com/yukinagae/genkit-firebase-functions-sample/main/docs/1.png)

Cloud Functions ダッシュボードでは、`VARIABLES` セクションに `OPENAI_API_KEY` というシークレット値が指定されていることに気づくでしょう。

注意: Cloud Functions 内のシークレット値は、デプロイ後に適用され、デプロイ前には適用されません。

![Cloud Functions GUI - variables](https://raw.githubusercontent.com/yukinagae/genkit-firebase-functions-sample/main/docs/2.png)

デプロイした関数をテストするには、以下の `curl` コマンドを実行します：

```bash
$ curl -X POST -H "Content-Type: application/json" \
-H "Authorization: Bearer token1234" \
-d '{"data":{"url":"https://firebase.blog/posts/2024/04/next-announcements/","lang":"English"}}' \
https://summarizeflow-[your_function_id]-uc.a.run.app
{"result":"Firebase announced new features at Cloud Next '24, including Firestore vector search, Vertex AI SDKs, and public preview of Gemini integration."}
```

`[your_function_id]` を Firebase コンソールの Functions ダッシュボードで確認できる Firebase プロジェクトの値に置き換えてください。

---

Firebase Genkit と Firebase Functions の統合に興味がある開発者の方には、以下のサンプルプロジェクトをお勧めします：

https://github.com/yukinagae/genkit-firebase-functions-sample

このプロジェクトは、Firebase Genkit と Firebase Functions の組み合わせを実際に体験できる実践的なガイドとして役立ちます。
